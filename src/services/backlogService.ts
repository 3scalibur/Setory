// Пропущені вправи, день пропущених і «маю N хвилин» (SPEC.md, розділи 8–9).

import { CONFIG } from '@/config';
import { insertDismissals, listDismissals } from '@/data/backlog';
import { hiddenExerciseIds, listExercises, type ExerciseRow } from '@/data/exercises';
import { loadHistorySessions, loadHistorySets } from '@/data/history';
import { getRoutine, listRoutineExercises, listRoutineSets } from '@/data/routines';
import { getSettings } from '@/data/settings';
import { computeBacklog, type BacklogItem } from '@/domain/backlog';
import { fitRoutineToBudget, muscleLastTrained, suggestCatchUp } from '@/domain/catchUp';
import { DAY_MS } from '@/domain/sets';
import type { Mechanic, MuscleGroup, TargetSet } from '@/domain/types';

import { inTransaction, UserError, type Deps } from './deps';
import { estimateExercise } from './estimates';
import { groupBy, toTarget } from './sessionService';

export interface BacklogEntry extends BacklogItem {
  name: string;
  primaryMuscles: MuscleGroup[];
  mechanic: Mechanic;
}

export function getBacklog(deps: Deps): BacklogEntry[] {
  const now = deps.now();
  const sessions = loadHistorySessions(deps.db, now - 2 * CONFIG.BACKLOG_EXPIRY_DAYS * DAY_MS);
  const items = computeBacklog(sessions, listDismissals(deps.db), now, { hiddenExerciseIds: hiddenExerciseIds(deps.db) });
  const catalog = catalogMap(deps);
  return items.flatMap((item) => {
    const e = catalog.get(item.exerciseId);
    return e ? [{ ...item, name: e.name, primaryMuscles: e.primaryMuscles, mechanic: e.mechanic }] : [];
  });
}

/** «Прибрати» з пропущених. Новий пропуск після цього — вправа з'явиться знову. */
export function dismissFromBacklog(deps: Deps, exerciseIds: readonly string[]): void {
  inTransaction(deps, (d) => {
    insertDismissals(d.db, exerciseIds.map((exerciseId) => ({ id: d.newId(), exerciseId })), d.now());
  });
}

export interface CatchUpPlanItem {
  exerciseId: string;
  name: string;
  estimatedSec: number;
  targets?: TargetSet[];
  restSec?: number;
}

/** Пропозиція дня пропущених під заданий час. Користувач редагує її перед стартом. */
export function getCatchUpPlan(
  deps: Deps,
  timeBudgetMin: number = CONFIG.CATCHUP_DEFAULT_BUDGET_MIN,
  options: { maxItems?: number; excludeExerciseIds?: readonly string[] } = {},
): { items: CatchUpPlanItem[]; totalSec: number; backlogCount: number } {
  const backlog = getBacklog(deps);
  const exclude = new Set(options.excludeExerciseIds ?? []);
  const pool = backlog.filter((b) => !exclude.has(b.exerciseId));
  const history = loadHistorySets(deps.db, pool.map((b) => b.exerciseId));
  const setCountSource = getSettings(deps.db).prefillSetCount;
  const catalog = catalogMap(deps);

  const estimated = new Map(
    pool.map((b) => [
      b.exerciseId,
      estimateExercise({ exerciseId: b.exerciseId, mechanic: b.mechanic, targets: b.targets, restSec: b.restSec, history, setCountSource }),
    ]),
  );
  const lastTrained = muscleLastTrained(loadHistorySessions(deps.db), (id) => catalog.get(id)?.primaryMuscles);
  const plan = suggestCatchUp(
    pool.map((b) => ({
      exerciseId: b.exerciseId,
      mechanic: b.mechanic,
      primaryMuscles: b.primaryMuscles,
      missCount: b.missCount,
      firstMissedAt: b.firstMissedAt,
      estimatedSec: estimated.get(b.exerciseId)!,
    })),
    lastTrained,
    { timeBudgetMin, now: deps.now(), maxItems: options.maxItems },
  );

  const byId = new Map(pool.map((b) => [b.exerciseId, b]));
  return {
    items: plan.items.map((i) => {
      const b = byId.get(i.exerciseId)!;
      return { exerciseId: i.exerciseId, name: b.name, estimatedSec: i.estimatedSec, targets: b.targets, restSec: b.restSec };
    }),
    totalSec: plan.totalSec,
    backlogCount: backlog.length,
  };
}

export interface RoutineBudgetSlot {
  routineExerciseId: string;
  exerciseId: string;
  name: string;
  estimatedSec: number;
  inBacklog: boolean;
  /** false → «не встигну». */
  fits: boolean;
}

/** «Маю N хвилин» перед стартом програми: що вміщається, а що ні, і що можна додати з пропущених. */
export function getRoutineBudgetPlan(
  deps: Deps,
  routineId: string,
  timeBudgetMin: number,
): { slots: RoutineBudgetSlot[]; plannedSec: number; fullSec: number; suggestions: CatchUpPlanItem[] } {
  const routine = getRoutine(deps.db, routineId);
  if (!routine) throw new UserError('Програму не знайдено.');
  const slots = listRoutineExercises(deps.db, [routineId]);
  const setsBySlot = groupBy(listRoutineSets(deps.db, slots.map((s) => s.id)), (s) => s.routineExerciseId);
  const history = loadHistorySets(deps.db, slots.map((s) => s.exerciseId));
  const setCountSource = getSettings(deps.db).prefillSetCount;
  const catalog = catalogMap(deps);
  const inBacklog = new Set(getBacklog(deps).map((b) => b.exerciseId));

  const estimates = slots.map((s) => {
    const e = catalog.get(s.exerciseId);
    return {
      routineExerciseId: s.id,
      exerciseId: s.exerciseId,
      name: e?.name ?? 'Вправа',
      mechanic: e?.mechanic ?? 'isolation',
      inBacklog: inBacklog.has(s.exerciseId),
      estimatedSec: estimateExercise({
        exerciseId: s.exerciseId,
        mechanic: e?.mechanic ?? 'isolation',
        targets: (setsBySlot.get(s.id) ?? []).map(toTarget),
        restSec: s.restSec,
        history,
        setCountSource,
      }),
    };
  });
  const plan = fitRoutineToBudget(estimates, timeBudgetMin);
  const suggestions =
    plan.leftoverSec > 0
      ? getCatchUpPlan(deps, Math.floor(plan.leftoverSec / 60), {
          maxItems: 2,
          excludeExerciseIds: slots.map((s) => s.exerciseId),
        }).items
      : [];

  return {
    slots: plan.slots.map(({ mechanic: _mechanic, ...s }) => s),
    plannedSec: plan.plannedSec,
    fullSec: estimates.reduce((sum, e) => sum + e.estimatedSec, 0),
    suggestions,
  };
}

function catalogMap(deps: Deps): Map<string, ExerciseRow> {
  return new Map(listExercises(deps.db).map((e) => [e.id, e]));
}

/** Оцінка часу кожної пропущеної вправи, с — щоб додавати вправи в день пропущених вручну. */
export function getBacklogEstimates(deps: Deps): Map<string, number> {
  const backlog = getBacklog(deps);
  const history = loadHistorySets(deps.db, backlog.map((b) => b.exerciseId));
  const setCountSource = getSettings(deps.db).prefillSetCount;
  return new Map(
    backlog.map((b) => [
      b.exerciseId,
      estimateExercise({ exerciseId: b.exerciseId, mechanic: b.mechanic, targets: b.targets, restSec: b.restSec, history, setCountSource }),
    ]),
  );
}
