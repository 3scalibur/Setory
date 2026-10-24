// День пропущених і режим «маю N хвилин» (SPEC.md, розділ 9).
// Усі функції детерміновані: однаковий вхід → однаковий вихід, незалежно від порядку вхідних даних.

import { CONFIG } from '@/config';

import { DAY_MS, HOUR_MS } from './sets';
import type { HistorySession, HistorySet, Mechanic, MuscleGroup } from './types';

// ---------- Оцінка часу ----------

/** Медіана інтервалу між сусідніми підходами в межах одного блоку вправи, с. Немає даних — undefined. */
export function medianSetIntervalSec(
  sets: readonly Pick<HistorySet, 'sessionExerciseId' | 'completedAt'>[],
): number | undefined {
  const byBlock = new Map<string, number[]>();
  for (const s of sets) {
    const list = byBlock.get(s.sessionExerciseId) ?? [];
    list.push(s.completedAt);
    byBlock.set(s.sessionExerciseId, list);
  }
  const intervals: number[] = [];
  for (const times of byBlock.values()) {
    times.sort((a, b) => a - b);
    for (let i = 1; i < times.length; i++) {
      const gap = times[i] - times[i - 1];
      if (gap > 0) intervals.push(gap / 1000);
    }
  }
  if (intervals.length === 0) return undefined;
  intervals.sort((a, b) => a - b);
  const mid = Math.floor(intervals.length / 2);
  return intervals.length % 2 === 1 ? intervals[mid] : (intervals[mid - 1] + intervals[mid]) / 2;
}

/** Підходи × (час підходу + відпочинок) + підготовка, с. З історією — медіана інтервалу замість «підхід + відпочинок». */
export function estimateExerciseSec(input: {
  setCount: number;
  mechanic: Mechanic;
  restSec?: number;
  medianIntervalSec?: number;
}): number {
  const rest =
    input.restSec ?? (input.mechanic === 'compound' ? CONFIG.REST_COMPOUND_SEC : CONFIG.REST_ISOLATION_SEC);
  const perSet = input.medianIntervalSec ?? CONFIG.SET_DURATION_SEC + rest;
  return input.setCount * perSet + CONFIG.SETUP_SEC;
}

/** Секунди → хвилини для екрана, вгору: «~55 хв». */
export function estimateMinutes(totalSec: number): number {
  return Math.ceil(totalSec / 60);
}

// ---------- Коли тренувався кожен м'яз ----------

/** Для кожного м'яза — коли востаннє виконали будь-яку вправу, де він основний. */
export function muscleLastTrained(
  sessions: readonly HistorySession[],
  primaryMusclesOf: (exerciseId: string) => readonly MuscleGroup[] | undefined,
): Map<MuscleGroup, number> {
  const last = new Map<MuscleGroup, number>();
  for (const s of sessions) {
    for (const e of s.exercises) {
      if (e.workingSetsDone < CONFIG.DONE_THRESHOLD) continue;
      for (const m of primaryMusclesOf(e.exerciseId) ?? []) {
        if (s.finishedAt > (last.get(m) ?? -Infinity)) last.set(m, s.finishedAt);
      }
    }
  }
  return last;
}

// ---------- День пропущених ----------

/** Від великих м'язів до малих: ноги → спина → груди → плечі → руки → прес/ікри/шия. */
const MUSCLE_ORDER: readonly MuscleGroup[] = [
  'quads',
  'hamstrings',
  'glutes',
  'adductors',
  'abductors',
  'lats',
  'upper_back',
  'lower_back',
  'traps',
  'chest',
  'front_delts',
  'side_delts',
  'rear_delts',
  'biceps',
  'triceps',
  'forearms',
  'abs',
  'calves',
  'neck',
];

export interface CatchUpCandidate {
  exerciseId: string;
  mechanic: Mechanic;
  primaryMuscles: readonly MuscleGroup[];
  missCount: number;
  firstMissedAt: number;
  estimatedSec: number;
}

export interface CatchUpPlan {
  /** У порядку виконання. */
  items: { exerciseId: string; estimatedSec: number }[];
  totalSec: number;
}

export function suggestCatchUp(
  candidates: readonly CatchUpCandidate[],
  lastTrained: ReadonlyMap<MuscleGroup, number>,
  options: { timeBudgetMin: number; now: number; maxItems?: number },
): CatchUpPlan {
  const { now } = options;
  const budgetSec = options.timeBudgetMin * 60;

  const ranked = candidates
    .map((c) => {
      const times = c.primaryMuscles.map((m) => lastTrained.get(m));
      // Скільки повних днів не тренувався найбільш занедбаний основний м'яз (ніколи — нескінченно).
      const neglectDays = Math.max(...times.map((t) => (t === undefined ? Infinity : Math.floor((now - t) / DAY_MS))));
      // Штраф: хоча б один основний м'яз ще відновлюється.
      const recovering = times.some((t) => t !== undefined && now - t < CONFIG.MUSCLE_RECOVERY_HOURS * HOUR_MS);
      return { c, neglectDays, recovering };
    })
    .sort(
      (a, b) =>
        compare(a.recovering ? 1 : 0, b.recovering ? 1 : 0) ||
        compare(b.neglectDays, a.neglectDays) ||
        compare(b.c.missCount, a.c.missCount) ||
        compare(a.c.firstMissedAt, b.c.firstMissedAt) ||
        a.c.exerciseId.localeCompare(b.c.exerciseId),
    )
    .map((r) => r.c);

  const chosen: CatchUpCandidate[] = [];
  const perMuscle = new Map<MuscleGroup, number>();
  let totalSec = 0;
  for (const c of ranked) {
    if (options.maxItems !== undefined && chosen.length >= options.maxItems) break;
    if (totalSec + c.estimatedSec > budgetSec) continue;
    if (c.primaryMuscles.some((m) => (perMuscle.get(m) ?? 0) >= CONFIG.MAX_PER_MUSCLE)) continue;
    chosen.push(c);
    totalSec += c.estimatedSec;
    for (const m of c.primaryMuscles) perMuscle.set(m, (perMuscle.get(m) ?? 0) + 1);
  }

  const priority = new Map(ranked.map((c, i) => [c.exerciseId, i]));
  const items = [...chosen]
    .sort(
      (a, b) =>
        compare(a.mechanic === 'compound' ? 0 : 1, b.mechanic === 'compound' ? 0 : 1) ||
        compare(muscleRank(a.primaryMuscles), muscleRank(b.primaryMuscles)) ||
        compare(priority.get(a.exerciseId)!, priority.get(b.exerciseId)!),
    )
    .map((c) => ({ exerciseId: c.exerciseId, estimatedSec: c.estimatedSec }));

  return { items, totalSec };
}

// ---------- «Маю N хвилин» для програми ----------

export interface RoutineSlotEstimate {
  routineExerciseId: string;
  exerciseId: string;
  mechanic: Mechanic;
  estimatedSec: number;
  /** Вправа вже є в пропущених. */
  inBacklog: boolean;
}

export interface RoutineBudgetPlan<T extends RoutineSlotEstimate = RoutineSlotEstimate> {
  /** У порядку програми; fits = false → «не встигну». */
  slots: (T & { fits: boolean })[];
  plannedSec: number;
  /** Скільки часу лишилось — на 1–2 вправи з пропущених. */
  leftoverSec: number;
}

/** Що з програми вміщається в бюджет: базові і ті, що вже в пропущених, — першими. */
export function fitRoutineToBudget<T extends RoutineSlotEstimate>(
  slots: readonly T[],
  timeBudgetMin: number,
): RoutineBudgetPlan<T> {
  const budgetSec = timeBudgetMin * 60;
  const score = (s: T) => (s.mechanic === 'compound' ? 2 : 0) + (s.inBacklog ? 1 : 0);
  const byPriority = slots.map((s, index) => ({ s, index })).sort((a, b) => score(b.s) - score(a.s) || a.index - b.index);

  const fits = new Set<number>();
  let plannedSec = 0;
  for (const { s, index } of byPriority) {
    if (plannedSec + s.estimatedSec > budgetSec) continue;
    fits.add(index);
    plannedSec += s.estimatedSec;
  }

  return {
    slots: slots.map((s, index) => ({ ...s, fits: fits.has(index) })),
    plannedSec,
    leftoverSec: Math.max(0, budgetSec - plannedSec),
  };
}

function muscleRank(muscles: readonly MuscleGroup[]): number {
  return Math.min(...muscles.map((m) => MUSCLE_ORDER.indexOf(m)));
}

/** Порівняння, що працює і з Infinity (Infinity − Infinity = NaN). */
function compare(a: number, b: number): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}
