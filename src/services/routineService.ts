// Програми і вкладка «Тренування» (SPEC.md, розділ 10б).

import { CONFIG } from '@/config';
import { getExercise, listExercises } from '@/data/exercises';
import { getActiveFolder, getFolder, listFolders } from '@/data/folders';
import { loadHistorySessions, loadHistorySets } from '@/data/history';
import * as data from '@/data/routines';
import { getActiveSession } from '@/data/sessions';
import { getSettings } from '@/data/settings';
import { positionsFrom } from '@/data/util';
import { buildPrefill, lastPerformance, type LastPerformance, type PrefillSet } from '@/domain/performance';
import { nextRoutine } from '@/domain/rotation';
import { roundWeight } from '@/domain/sets';
import type { ExerciseType, Mechanic, SetKind, TargetSet } from '@/domain/types';

import { getBacklog, getCatchUpPlan } from './backlogService';
import { inTransaction, UserError, type Deps } from './deps';
import { estimateExercise } from './estimates';
import { groupBy, toTarget } from './sessionService';

// ---------- Конструктор програми ----------

export interface RoutineSetDraft {
  kind: SetKind;
  weightKg?: number;
  repsMin?: number;
  repsMax?: number;
  durationSec?: number;
  distanceM?: number;
}

export interface RoutineExerciseDraft {
  /** Є — існуюча вправа програми (зберігає свій id). */
  id?: string;
  exerciseId: string;
  /** Немає — 150 с для базових, 90 с для ізоляції. */
  restSec?: number;
  note?: string;
  sets: RoutineSetDraft[];
}

export interface RoutineDraft {
  id?: string;
  folderId: string;
  name: string;
  note?: string;
  exercises: RoutineExerciseDraft[];
}

/** Створити або оновити програму цілком. Історія тренувань при цьому не змінюється. */
export function saveRoutine(deps: Deps, draft: RoutineDraft): string {
  const name = draft.name.trim();
  if (!name) throw new UserError('Вкажи назву програми.');
  if (draft.exercises.length === 0) throw new UserError('Додай хоча б одну вправу.');
  if (draft.exercises.some((e) => e.sets.length === 0)) {
    throw new UserError('У кожної вправи має бути хоча б один підхід.');
  }
  for (const s of draft.exercises.flatMap((e) => e.sets)) {
    if (s.repsMin !== undefined && s.repsMax !== undefined && s.repsMax < s.repsMin) {
      throw new UserError('Діапазон повторів: спершу менше число, потім більше (8–10).');
    }
  }

  return inTransaction(deps, (d) => {
    const now = d.now();
    if (!getFolder(d.db, draft.folderId)) throw new UserError('Папку не знайдено.');

    let routineId = draft.id;
    if (routineId) {
      const existing = data.getRoutine(d.db, routineId);
      if (!existing) throw new UserError('Програму не знайдено.');
      const fields: Parameters<typeof data.updateRoutine>[2] = { name, note: draft.note ?? null };
      if (existing.folderId !== draft.folderId) {
        fields.folderId = draft.folderId;
        fields.position = data.nextRoutinePosition(d.db, draft.folderId);
      }
      data.updateRoutine(d.db, routineId, fields, now);
    } else {
      routineId = d.newId();
      data.insertRoutine(
        d.db,
        { id: routineId, folderId: draft.folderId, name, position: data.nextRoutinePosition(d.db, draft.folderId), note: draft.note ?? null },
        now,
      );
    }

    const existingSlots = new Map(data.listRoutineExercises(d.db, [routineId]).map((s) => [s.id, s]));
    const keptIds: string[] = [];
    draft.exercises.forEach((e, position) => {
      const exercise = getExercise(d.db, e.exerciseId);
      if (!exercise || exercise.deletedAt !== null) throw new UserError('Вправу не знайдено.');
      const restSec = e.restSec ?? (exercise.mechanic === 'compound' ? CONFIG.REST_COMPOUND_SEC : CONFIG.REST_ISOLATION_SEC);

      let slotId = e.id && existingSlots.has(e.id) ? e.id : undefined;
      if (slotId) {
        data.updateRoutineExercise(d.db, slotId, { exerciseId: e.exerciseId, position, restSec, note: e.note ?? null }, now);
      } else {
        slotId = d.newId();
        data.insertRoutineExercise(
          d.db,
          { id: slotId, routineId: routineId!, exerciseId: e.exerciseId, position, restSec, note: e.note ?? null },
          now,
        );
      }
      keptIds.push(slotId);
      data.softDeleteRoutineSets(d.db, [slotId], now);
      data.insertRoutineSets(
        d.db,
        e.sets.map((s, setPosition) => ({
          id: d.newId(),
          routineExerciseId: slotId!,
          position: setPosition,
          kind: s.kind,
          weightKg: s.weightKg === undefined ? null : roundWeight(s.weightKg),
          repsMin: s.repsMin ?? null,
          repsMax: s.repsMax ?? s.repsMin ?? null,
          durationSec: s.durationSec ?? null,
          distanceM: s.distanceM ?? null,
        })),
        now,
      );
    });

    const removed = [...existingSlots.keys()].filter((id) => !keptIds.includes(id));
    for (const id of removed) data.updateRoutineExercise(d.db, id, { deletedAt: now }, now);
    data.softDeleteRoutineSets(d.db, removed, now);
    return routineId;
  });
}

/** Чернетка для редагування існуючої програми. */
export function getRoutineDraft(deps: Deps, routineId: string): RoutineDraft | null {
  const routine = data.getRoutine(deps.db, routineId);
  if (!routine) return null;
  const slots = data.listRoutineExercises(deps.db, [routineId]);
  const setsBySlot = groupBy(data.listRoutineSets(deps.db, slots.map((s) => s.id)), (s) => s.routineExerciseId);
  return {
    id: routine.id,
    folderId: routine.folderId,
    name: routine.name,
    note: routine.note ?? undefined,
    exercises: slots.map((s) => ({
      id: s.id,
      exerciseId: s.exerciseId,
      restSec: s.restSec,
      note: s.note ?? undefined,
      sets: (setsBySlot.get(s.id) ?? []).map(toSetDraft),
    })),
  };
}

export function duplicateRoutine(deps: Deps, routineId: string): string {
  const draft = getRoutineDraft(deps, routineId);
  if (!draft) throw new UserError('Програму не знайдено.');
  return saveRoutine(deps, {
    ...draft,
    id: undefined,
    name: `${draft.name} (копія)`,
    exercises: draft.exercises.map((e) => ({ ...e, id: undefined })),
  });
}

export function moveRoutine(deps: Deps, routineId: string, folderId: string): void {
  inTransaction(deps, (d) => {
    if (!data.getRoutine(d.db, routineId)) throw new UserError('Програму не знайдено.');
    if (!getFolder(d.db, folderId)) throw new UserError('Папку не знайдено.');
    data.updateRoutine(d.db, routineId, { folderId, position: data.nextRoutinePosition(d.db, folderId) }, d.now());
  });
}

export function reorderRoutines(deps: Deps, folderId: string, orderedIds: readonly string[]): void {
  inTransaction(deps, (d) => {
    const positions = positionsFrom(orderedIds);
    const now = d.now();
    for (const r of data.listRoutines(d.db, folderId)) {
      const position = positions.get(r.id);
      if (position !== undefined && position !== r.position) data.updateRoutine(d.db, r.id, { position }, now);
    }
  });
}

/** Видалити програму. Історія, рекорди і «минулого разу» не змінюються. */
export function deleteRoutine(deps: Deps, routineId: string): void {
  inTransaction(deps, (d) => {
    if (!data.getRoutine(d.db, routineId)) throw new UserError('Програму не знайдено.');
    data.updateRoutine(d.db, routineId, { deletedAt: d.now() }, d.now());
  });
}

// ---------- Картка програми ----------

export interface RoutineView {
  id: string;
  name: string;
  folderId: string;
  note?: string;
  exercises: {
    routineExerciseId: string;
    exerciseId: string;
    name: string;
    type: ExerciseType;
    mechanic: Mechanic;
    restSec: number;
    note?: string;
    targets: TargetSet[];
    last: LastPerformance | null;
    /** Підходи програми з кг минулого разу (поки вправу не робили — стартові кг програми). */
    display: PrefillSet[];
  }[];
  estimatedSec: number;
}

export function getRoutineView(deps: Deps, routineId: string): RoutineView | null {
  const routine = data.getRoutine(deps.db, routineId);
  if (!routine) return null;
  const slots = data.listRoutineExercises(deps.db, [routineId]);
  const setsBySlot = groupBy(data.listRoutineSets(deps.db, slots.map((s) => s.id)), (s) => s.routineExerciseId);
  const history = loadHistorySets(deps.db, slots.map((s) => s.exerciseId));
  const catalog = new Map(listExercises(deps.db).map((e) => [e.id, e]));
  const setCountSource = getSettings(deps.db).prefillSetCount;

  const exercises = slots.map((s) => {
    const e = catalog.get(s.exerciseId);
    const targets = (setsBySlot.get(s.id) ?? []).map(toTarget);
    const last = lastPerformance(s.exerciseId, history);
    return {
      routineExerciseId: s.id,
      exerciseId: s.exerciseId,
      name: e?.name ?? 'Вправа',
      type: e?.type ?? ('weight_reps' as const),
      mechanic: e?.mechanic ?? ('isolation' as const),
      restSec: s.restSec,
      note: s.note ?? undefined,
      targets,
      last,
      display: buildPrefill({ last, targets, setCountSource: 'template' }),
      estimatedSec: estimateExercise({
        exerciseId: s.exerciseId,
        mechanic: e?.mechanic ?? 'isolation',
        targets,
        restSec: s.restSec,
        history,
        setCountSource,
      }),
    };
  });

  return {
    id: routine.id,
    name: routine.name,
    folderId: routine.folderId,
    note: routine.note ?? undefined,
    exercises: exercises.map(({ estimatedSec: _e, ...rest }) => rest),
    estimatedSec: exercises.reduce((sum, e) => sum + e.estimatedSec, 0),
  };
}

// ---------- Вкладка «Тренування» ----------

export interface WorkoutTabView {
  activeSession: { id: string; title: string; startedAt: number } | null;
  folders: {
    id: string;
    name: string;
    isActive: boolean;
    routines: { id: string; name: string; exerciseNames: string[] }[];
  }[];
  /** «Наступне: Push» з активної папки. */
  next: { routineId: string; name: string } | null;
  backlogCount: number;
  /** «День пропущених, ~55 хв» — коли пропущених ≥ 4. */
  catchUp: { estimatedMin: number } | null;
}

export function getWorkoutTab(deps: Deps): WorkoutTabView {
  const folders = listFolders(deps.db);
  const routines = data.allRoutinesQuery(deps.db).all();
  const slots = data.listRoutineExercises(deps.db, routines.map((r) => r.id));
  const names = new Map(listExercises(deps.db).map((e) => [e.id, e.name]));
  const slotsByRoutine = groupBy(slots, (s) => s.routineId);
  const routinesByFolder = groupBy(routines, (r) => r.folderId);

  const active = getActiveFolder(deps.db);
  let next: WorkoutTabView['next'] = null;
  if (active) {
    const id = nextRoutine(data.rotationRoutines(deps.db, active.id), loadHistorySessions(deps.db), active.id);
    const routine = id ? routines.find((r) => r.id === id) : undefined;
    if (routine) next = { routineId: routine.id, name: routine.name };
  }

  const backlogCount = getBacklog(deps).length;
  let catchUp: WorkoutTabView['catchUp'] = null;
  if (backlogCount >= CONFIG.CATCHUP_MIN_ITEMS) {
    catchUp = { estimatedMin: Math.ceil(getCatchUpPlan(deps).totalSec / 60) };
  }

  const session = getActiveSession(deps.db);
  return {
    activeSession: session ? { id: session.id, title: session.title, startedAt: session.startedAt } : null,
    folders: folders.map((f) => ({
      id: f.id,
      name: f.name,
      isActive: f.isActive,
      routines: (routinesByFolder.get(f.id) ?? []).map((r) => ({
        id: r.id,
        name: r.name,
        exerciseNames: (slotsByRoutine.get(r.id) ?? []).map((s) => names.get(s.exerciseId) ?? 'Вправа'),
      })),
    })),
    next,
    backlogCount,
    catchUp,
  };
}

function toSetDraft(row: data.RoutineSetRow): RoutineSetDraft {
  const out: RoutineSetDraft = { kind: row.kind };
  if (row.weightKg !== null) out.weightKg = row.weightKg;
  if (row.repsMin !== null) out.repsMin = row.repsMin;
  if (row.repsMax !== null) out.repsMax = row.repsMax;
  if (row.durationSec !== null) out.durationSec = row.durationSec;
  if (row.distanceM !== null) out.distanceM = row.distanceM;
  return out;
}
