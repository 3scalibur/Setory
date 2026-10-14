// Позначка ↑ «краще, ніж минулого разу» і підсумок тренування (SPEC.md, розділ 10б).

import { greater, isWorking, roundWeight, same } from './sets';
import type { ExerciseType, PerformedSet } from './types';
import type { PRType } from './records';

export type Progress = 'up' | null;
export type SetMark = 'pr' | 'up' | null;

/**
 * ↑, якщо жоден показник не гірший і хоча б один кращий, ніж у підходу з тим самим номером минулого разу.
 * Розминка не порівнюється; немає попереднього підходу або цифр — позначки немає.
 */
export function compareWithPrevious(
  set: PerformedSet,
  previous: PerformedSet | undefined,
  type: ExerciseType,
): Progress {
  if (!previous || !isWorking(set) || !isWorking(previous)) return null;

  switch (type) {
    case 'weight_reps':
    case 'weighted_bodyweight': {
      const v = weightAndReps(set, previous);
      if (!v) return null;
      return (greater(v.w, v.pw) && v.r >= v.pr) || (same(v.w, v.pw) && v.r > v.pr) ? 'up' : null;
    }
    case 'assisted_bodyweight': {
      // Тут weightKg — допомога: менше = краще.
      const v = weightAndReps(set, previous);
      if (!v) return null;
      return (greater(v.pw, v.w) && v.r >= v.pr) || (same(v.w, v.pw) && v.r > v.pr) ? 'up' : null;
    }
    case 'bodyweight_reps':
      if (set.reps === undefined || previous.reps === undefined) return null;
      return set.reps > previous.reps ? 'up' : null;
    case 'duration':
      if (set.durationSec === undefined || previous.durationSec === undefined) return null;
      return set.durationSec > previous.durationSec ? 'up' : null;
    case 'distance_duration': {
      const { distanceM: m, durationSec: d } = set;
      const { distanceM: pm, durationSec: pd } = previous;
      if (m === undefined || d === undefined || pm === undefined || pd === undefined) return null;
      return (greater(m, pm) && d <= pd) || (same(m, pm) && d < pd) ? 'up' : null;
    }
  }
}

function weightAndReps(set: PerformedSet, previous: PerformedSet) {
  if (set.weightKg === undefined || set.reps === undefined) return null;
  if (previous.weightKg === undefined || previous.reps === undefined) return null;
  return {
    w: roundWeight(set.weightKg),
    r: set.reps,
    pw: roundWeight(previous.weightKg),
    pr: previous.reps,
  };
}

/** Одна позначка на підхід: 🏆 важливіша за ↑. */
export function setMark(records: readonly PRType[], progress: Progress): SetMark {
  if (records.length > 0) return 'pr';
  return progress;
}

export interface SessionSummary {
  /** Скільки підходів отримали 🏆. */
  records: number;
  /** Скільки вправ мають хоча б одну 🏆 або ↑. */
  progressedExercises: number;
}

export function summarizeSession(exercises: readonly { exerciseId: string; marks: readonly SetMark[] }[]): SessionSummary {
  let records = 0;
  let progressedExercises = 0;
  for (const e of exercises) {
    records += e.marks.filter((m) => m === 'pr').length;
    if (e.marks.some((m) => m !== null)) progressedExercises += 1;
  }
  return { records, progressedExercises };
}
