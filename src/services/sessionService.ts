// Тренування від старту до завершення (SPEC.md, розділи 5, 6, 11).
// Кожна зміна одразу пишеться в БД — якщо апка закриється, нічого не втратиться.

import { getExercise } from '@/data/exercises';
import { loadHistorySets } from '@/data/history';
import { getRoutine, listRoutineExercises, listRoutineSets, type RoutineSetRow } from '@/data/routines';
import * as data from '@/data/sessions';
import { getSettings } from '@/data/settings';
import { buildPrefill, lastPerformance } from '@/domain/performance';
import { planFinish, staleSessionFinishAt } from '@/domain/session';
import { canCompleteSet, roundWeight } from '@/domain/sets';
import type { ExerciseType, HistorySet, SessionSource, SetKind, SetValues, TargetSet } from '@/domain/types';

import { ActiveSessionError, inTransaction, UserError, type Deps } from './deps';

export const SESSION_TITLES: Record<Exclude<SessionSource, 'routine'>, string> = {
  single_exercise: 'Окрема вправа',
  catch_up: 'День пропущених',
  free: 'Вільне тренування',
};

// ---------- Старт у чотирьох режимах ----------

/** День програми. Вправи з skipRoutineExerciseIds («не встигну») одразу прибрані, але лишаються слотами. */
export function startRoutine(
  deps: Deps,
  routineId: string,
  options: { skipRoutineExerciseIds?: readonly string[] } = {},
): string {
  return inTransaction(deps, (d) => {
    assertNoActiveSession(d);
    const routine = getRoutine(d.db, routineId);
    if (!routine) throw new UserError('Програму не знайдено.');

    const slots = listRoutineExercises(d.db, [routineId]);
    const setsBySlot = groupBy(listRoutineSets(d.db, slots.map((s) => s.id)), (s) => s.routineExerciseId);
    const history = loadHistorySets(d.db, slots.map((s) => s.exerciseId));
    const skip = new Set(options.skipRoutineExerciseIds ?? []);

    const sessionId = createSession(d, 'routine', routine.name, { folderId: routine.folderId, routineId });
    slots.forEach((slot, position) => {
      addExerciseRow(d, sessionId, slot.exerciseId, {
        position,
        routineExerciseId: slot.id,
        targets: (setsBySlot.get(slot.id) ?? []).map(toTarget),
        restSec: slot.restSec,
        skipped: skip.has(slot.id),
        history,
      });
    });
    return sessionId;
  });
}

/** Окрема вправа. Якщо вже є активне тренування — вправа додається в нього. */
export function startSingleExercise(
  deps: Deps,
  exerciseId: string,
): { sessionId: string; sessionExerciseId: string; addedToActive: boolean } {
  return inTransaction(deps, (d) => {
    const active = data.getActiveSession(d.db);
    const sessionId = active?.id ?? createSession(d, 'single_exercise', SESSION_TITLES.single_exercise);
    const sessionExerciseId = addExercise(d, sessionId, exerciseId);
    return { sessionId, sessionExerciseId, addedToActive: active !== undefined };
  });
}

/** День пропущених: цілі беруться зі слоту, який був пропущений. */
export function startCatchUp(
  deps: Deps,
  items: readonly { exerciseId: string; targets?: TargetSet[]; restSec?: number }[],
): string {
  if (items.length === 0) throw new UserError('Додай хоча б одну вправу.');
  return inTransaction(deps, (d) => {
    assertNoActiveSession(d);
    const history = loadHistorySets(d.db, items.map((i) => i.exerciseId));
    const sessionId = createSession(d, 'catch_up', SESSION_TITLES.catch_up);
    items.forEach((item, position) => {
      addExerciseRow(d, sessionId, item.exerciseId, { position, targets: item.targets, restSec: item.restSec, history });
    });
    return sessionId;
  });
}

/** Порожнє тренування, вправи додаються по ходу. */
export function startFree(deps: Deps): string {
  return inTransaction(deps, (d) => {
    assertNoActiveSession(d);
    return createSession(d, 'free', SESSION_TITLES.free);
  });
}

// ---------- Вправи в сесії ----------

export function addExercise(deps: Deps, sessionId: string, exerciseId: string): string {
  return inTransaction(deps, (d) => {
    requireSession(d, sessionId);
    return addExerciseRow(d, sessionId, exerciseId, { position: data.nextSessionExercisePosition(d.db, sessionId) });
  });
}

/** Замінити вправу (наприклад, тренажер зайнятий). Слот програми зберігається; історія піде на нову вправу. */
export function replaceExercise(deps: Deps, sessionExerciseId: string, newExerciseId: string): void {
  inTransaction(deps, (d) => {
    const row = requireSessionExercise(d, sessionExerciseId);
    requireExercise(d, newExerciseId);
    const now = d.now();
    data.softDeleteSets(d.db, data.listSets(d.db, [row.id]).map((s) => s.id), now);
    data.updateSessionExercise(d.db, row.id, { exerciseId: newExerciseId, skipped: false }, now);
    insertPrefill(d, row.id, newExerciseId, row.targetsSnapshot ?? undefined, loadHistorySets(d.db, [newExerciseId]));
  });
}

/** Прибрати вправу. Слот програми лишається як «заплановано і не зроблено» — для пропущених. */
export function skipExercise(deps: Deps, sessionExerciseId: string): void {
  inTransaction(deps, (d) => {
    const row = requireSessionExercise(d, sessionExerciseId);
    const now = d.now();
    data.softDeleteSets(d.db, data.listSets(d.db, [row.id]).map((s) => s.id), now);
    if (row.routineExerciseId) data.updateSessionExercise(d.db, row.id, { skipped: true }, now);
    else data.softDeleteSessionExercises(d.db, [row.id], now);
  });
}

/** Повернути прибрану вправу-слот. */
export function restoreExercise(deps: Deps, sessionExerciseId: string): void {
  inTransaction(deps, (d) => {
    const row = requireSessionExercise(d, sessionExerciseId);
    if (!row.skipped) return;
    data.updateSessionExercise(d.db, row.id, { skipped: false }, d.now());
    insertPrefill(d, row.id, row.exerciseId, row.targetsSnapshot ?? undefined, loadHistorySets(d.db, [row.exerciseId]));
  });
}

/** Перемістити вправу на нове місце (індекс серед вправ сесії). */
export function moveExercise(deps: Deps, sessionExerciseId: string, toIndex: number): void {
  inTransaction(deps, (d) => {
    const row = requireSessionExercise(d, sessionExerciseId);
    const ordered = data.listSessionExercises(d.db, row.sessionId).filter((e) => e.id !== row.id);
    ordered.splice(Math.max(0, Math.min(toIndex, ordered.length)), 0, row);
    const now = d.now();
    ordered.forEach((e, position) => {
      if (e.position !== position) data.updateSessionExercise(d.db, e.id, { position }, now);
    });
  });
}

// ---------- Підходи ----------

/** «+ Підхід»: копіює цифри останнього підходу. */
export function addSet(deps: Deps, sessionExerciseId: string): string {
  return inTransaction(deps, (d) => {
    const row = requireSessionExercise(d, sessionExerciseId);
    const sets = data.listSets(d.db, [row.id]);
    const last = sets[sets.length - 1];
    const id = d.newId();
    data.insertSets(
      d.db,
      [
        {
          id,
          sessionExerciseId: row.id,
          position: sets.length,
          kind: 'working',
          weightKg: last?.weightKg ?? null,
          reps: last?.reps ?? null,
          durationSec: last?.durationSec ?? null,
          distanceM: last?.distanceM ?? null,
          rpe: null,
          completed: false,
          completedAt: null,
        },
      ],
      d.now(),
    );
    return id;
  });
}

export function removeSet(deps: Deps, setId: string): void {
  inTransaction(deps, (d) => {
    const set = requireSet(d, setId);
    const now = d.now();
    data.softDeleteSets(d.db, [set.id], now);
    data.listSets(d.db, [set.sessionExerciseId]).forEach((s, position) => {
      if (s.position !== position) data.updateSet(d.db, s.id, { position }, now);
    });
  });
}

export type SetPatch = { [K in keyof SetValues]?: number | null } & { kind?: SetKind };

/** Змінити цифри або тип підходу. Якщо виконаний підхід став неповним — галочка знімається. */
export function updateSet(deps: Deps, setId: string, patch: SetPatch): void {
  inTransaction(deps, (d) => {
    const set = requireSet(d, setId);
    const fields: Parameters<typeof data.updateSet>[2] = {};
    if (patch.kind !== undefined) fields.kind = patch.kind;
    if ('weightKg' in patch) fields.weightKg = patch.weightKg == null ? null : roundWeight(patch.weightKg);
    if ('reps' in patch) fields.reps = patch.reps ?? null;
    if ('durationSec' in patch) fields.durationSec = patch.durationSec ?? null;
    if ('distanceM' in patch) fields.distanceM = patch.distanceM ?? null;

    if (set.completed) {
      const merged = { ...set, ...fields };
      if (!canCompleteSet(values(merged), exerciseType(d, set.sessionExerciseId))) {
        fields.completed = false;
        fields.completedAt = null;
      }
    }
    data.updateSet(d.db, set.id, fields, d.now());
  });
}

/** Позначити підхід виконаним. Без обов'язкових полів — помилка з поясненням. */
export function completeSet(deps: Deps, setId: string): void {
  inTransaction(deps, (d) => {
    const set = requireSet(d, setId);
    if (set.completed) return;
    const type = exerciseType(d, set.sessionExerciseId);
    if (!canCompleteSet(values(set), type)) throw new UserError(missingFieldsMessage(type));
    const now = d.now();
    data.updateSet(d.db, set.id, { completed: true, completedAt: now }, now);
  });
}

export function uncompleteSet(deps: Deps, setId: string): void {
  inTransaction(deps, (d) => {
    const set = requireSet(d, setId);
    data.updateSet(d.db, set.id, { completed: false, completedAt: null }, d.now());
  });
}

// ---------- Завершення ----------

/** «Завершити»: невиконані підходи і порожні вправи прибираються (слоти програми лишаються). */
export function finishSession(deps: Deps, sessionId: string, finishedAt?: number): void {
  inTransaction(deps, (d) => {
    const session = requireSession(d, sessionId);
    if (session.status !== 'active') throw new UserError('Тренування вже завершене.');
    const exercises = data.listSessionExercises(d.db, sessionId);
    const setsByExercise = groupBy(data.listSets(d.db, exercises.map((e) => e.id)), (s) => s.sessionExerciseId);
    const plan = planFinish(
      exercises.map((e) => ({
        id: e.id,
        routineExerciseId: e.routineExerciseId ?? undefined,
        sets: setsByExercise.get(e.id) ?? [],
      })),
    );
    const now = d.now();
    data.softDeleteSets(d.db, plan.deleteSetIds, now);
    data.softDeleteSessionExercises(d.db, plan.deleteExerciseIds, now);
    data.updateSession(d.db, sessionId, { status: 'finished', finishedAt: finishedAt ?? now }, now);
  });
}

/** «Скасувати»: тренування ігнорується всюди. */
export function discardSession(deps: Deps, sessionId: string): void {
  inTransaction(deps, (d) => {
    requireSession(d, sessionId);
    data.updateSession(d.db, sessionId, { status: 'discarded' }, d.now());
  });
}

/** Видалити завершене тренування з історії. Рекорди і пропущені перераховуються самі. */
export function deleteSession(deps: Deps, sessionId: string): void {
  inTransaction(deps, (d) => {
    requireSession(d, sessionId);
    data.updateSession(d.db, sessionId, { deletedAt: d.now() }, d.now());
  });
}

/**
 * Для екрана запуску: чи є незавершене тренування і чи не забуте воно (старше 6 год).
 * staleFinishAt — час, яким запропонувати завершити.
 */
export function getActiveSessionState(deps: Deps): { sessionId: string; title: string; staleFinishAt: number | null } | null {
  const active = data.getActiveSession(deps.db);
  if (!active) return null;
  const exercises = data.listSessionExercises(deps.db, active.id);
  const completedAts = data
    .listSets(deps.db, exercises.map((e) => e.id))
    .filter((s) => s.completed && s.completedAt !== null)
    .map((s) => s.completedAt as number);
  return {
    sessionId: active.id,
    title: active.title,
    staleFinishAt: staleSessionFinishAt(active.startedAt, completedAts, deps.now()),
  };
}

// ---------- Внутрішнє ----------

function assertNoActiveSession(d: Deps) {
  const active = data.getActiveSession(d.db);
  if (active) throw new ActiveSessionError(active.id);
}

function createSession(
  d: Deps,
  source: SessionSource,
  title: string,
  extra: { folderId?: string; routineId?: string } = {},
): string {
  const id = d.newId();
  const now = d.now();
  data.insertSession(d.db, { id, source, title, startedAt: now, ...extra }, now);
  return id;
}

function addExerciseRow(
  d: Deps,
  sessionId: string,
  exerciseId: string,
  options: {
    position: number;
    routineExerciseId?: string;
    targets?: TargetSet[];
    restSec?: number;
    skipped?: boolean;
    history?: readonly HistorySet[];
  },
): string {
  requireExercise(d, exerciseId);
  const id = d.newId();
  data.insertSessionExercise(
    d.db,
    {
      id,
      sessionId,
      exerciseId,
      position: options.position,
      routineExerciseId: options.routineExerciseId ?? null,
      skipped: options.skipped ?? false,
      targetsSnapshot: options.targets && options.targets.length > 0 ? options.targets : null,
      restSec: options.restSec ?? null,
    },
    d.now(),
  );
  if (!options.skipped) {
    insertPrefill(d, id, exerciseId, options.targets, options.history ?? loadHistorySets(d.db, [exerciseId]));
  }
  return id;
}

/** Підставляє підходи з минулого разу (або з програми, якщо історії ще немає). */
function insertPrefill(
  d: Deps,
  sessionExerciseId: string,
  exerciseId: string,
  targets: TargetSet[] | undefined,
  history: readonly HistorySet[],
) {
  const prefill = buildPrefill({
    last: lastPerformance(exerciseId, history),
    targets,
    setCountSource: getSettings(d.db).prefillSetCount,
  });
  data.insertSets(
    d.db,
    prefill.map((p) => ({
      id: d.newId(),
      sessionExerciseId,
      position: p.position,
      kind: p.kind,
      weightKg: p.weightKg ?? null,
      reps: p.reps ?? null,
      durationSec: p.durationSec ?? null,
      distanceM: p.distanceM ?? null,
      rpe: null,
      completed: false,
      completedAt: null,
    })),
    d.now(),
  );
}

function requireSession(d: Deps, id: string) {
  const s = data.getSession(d.db, id);
  if (!s) throw new UserError('Тренування не знайдено.');
  return s;
}

function requireSessionExercise(d: Deps, id: string) {
  const row = data.getSessionExercise(d.db, id);
  if (!row) throw new UserError('Вправу в тренуванні не знайдено.');
  return row;
}

function requireSet(d: Deps, id: string) {
  const set = data.getSet(d.db, id);
  if (!set) throw new UserError('Підхід не знайдено.');
  return set;
}

function requireExercise(d: Deps, id: string) {
  const e = getExercise(d.db, id);
  if (!e || e.deletedAt !== null) throw new UserError('Вправу не знайдено.');
  return e;
}

function exerciseType(d: Deps, sessionExerciseId: string): ExerciseType {
  const row = data.exerciseOfSessionExercise(d.db, sessionExerciseId);
  if (!row) throw new UserError('Вправу не знайдено.');
  return row.type;
}

function values(s: { weightKg: number | null; reps: number | null; durationSec: number | null; distanceM: number | null }): SetValues {
  return {
    weightKg: s.weightKg ?? undefined,
    reps: s.reps ?? undefined,
    durationSec: s.durationSec ?? undefined,
    distanceM: s.distanceM ?? undefined,
  };
}

function missingFieldsMessage(type: ExerciseType): string {
  switch (type) {
    case 'bodyweight_reps':
      return 'Вкажи кількість повторів.';
    case 'duration':
      return 'Вкажи час.';
    case 'distance_duration':
      return 'Вкажи дистанцію і час.';
    case 'assisted_bodyweight':
      return 'Вкажи допомогу (кг) і повтори.';
    default:
      return 'Вкажи вагу і повтори.';
  }
}

export function toTarget(s: RoutineSetRow): TargetSet {
  const t: TargetSet = { position: s.position, kind: s.kind };
  if (s.weightKg !== null) t.weightKg = s.weightKg;
  if (s.repsMin !== null) t.repsMin = s.repsMin;
  if (s.repsMax !== null) t.repsMax = s.repsMax;
  if (s.durationSec !== null) t.durationSec = s.durationSec;
  if (s.distanceM !== null) t.distanceM = s.distanceM;
  return t;
}

export function groupBy<T, K>(items: readonly T[], key: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = map.get(k);
    if (list) list.push(item);
    else map.set(k, [item]);
  }
  return map;
}
