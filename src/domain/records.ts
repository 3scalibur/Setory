// Рекорди і коронки 🏆 (SPEC.md, розділ 7).
// Рекорди не зберігаються: їх завжди можна перерахувати з журналу.

import { epley1RM, greater, isWorking, roundWeight } from './sets';
import type { ExerciseType, PerformedSet } from './types';

export type PRType =
  | 'max_weight' // найбільша вага
  | 'max_reps_at_weight' // найбільше повторів з цією або більшою вагою
  | 'e1rm' // розрахунковий 1ПМ
  | 'max_volume' // об'єм підходу: вага × повтори
  | 'max_reps' // найбільше повторів (власна вага)
  | 'min_assistance' // найменша допомога (гравітрон)
  | 'max_reps_at_assistance' // найбільше повторів з цією або меншою допомогою
  | 'max_duration'
  | 'max_distance';

/**
 * Які рекорди б'є підхід порівняно з попередніми робочими підходами цієї вправи.
 * Кожен показник має бути строго кращим за все, що було раніше, і раніше вже мав хоча б одне значення —
 * тому перше в житті виконання (і перший підхід з новим показником) — база, без 🏆.
 */
export function evaluateSetPRs(set: PerformedSet, priorSets: readonly PerformedSet[], type: ExerciseType): PRType[] {
  if (!isWorking(set)) return [];
  const prior = priorSets.filter(isWorking);
  const out: PRType[] = [];

  switch (type) {
    case 'weight_reps':
    case 'weighted_bodyweight': {
      const cur = weighted(set);
      if (!cur) break;
      const all = prior.map(weighted).filter((p) => p !== null);
      if (beatsMax(cur.w, all.map((p) => p.w))) out.push('max_weight');
      const heavierOrEqual = all.filter((p) => !greater(cur.w, p.w));
      if (beatsMax(cur.r, heavierOrEqual.map((p) => p.r))) out.push('max_reps_at_weight');
      const e1rm = epley1RM(cur.w, cur.r);
      const priorE1rm = all.map((p) => epley1RM(p.w, p.r)).filter((v) => v !== undefined);
      if (e1rm !== undefined && beatsMax(e1rm, priorE1rm)) out.push('e1rm');
      if (beatsMax(cur.w * cur.r, all.map((p) => p.w * p.r))) out.push('max_volume');
      break;
    }
    case 'assisted_bodyweight': {
      const cur = weighted(set);
      if (!cur) break;
      const all = prior.map(weighted).filter((p) => p !== null);
      // Тут weightKg — допомога: менше = важче.
      if (beatsMin(cur.w, all.map((p) => p.w))) out.push('min_assistance');
      const sameOrLessHelp = all.filter((p) => !greater(p.w, cur.w));
      if (beatsMax(cur.r, sameOrLessHelp.map((p) => p.r))) out.push('max_reps_at_assistance');
      break;
    }
    case 'bodyweight_reps':
      if (set.reps !== undefined && beatsMax(set.reps, numbers(prior.map((p) => p.reps)))) out.push('max_reps');
      break;
    case 'duration':
      if (set.durationSec !== undefined && beatsMax(set.durationSec, numbers(prior.map((p) => p.durationSec)))) {
        out.push('max_duration');
      }
      break;
    case 'distance_duration':
      if (set.distanceM !== undefined && beatsMax(set.distanceM, numbers(prior.map((p) => p.distanceM)))) {
        out.push('max_distance');
      }
      break;
  }
  return out;
}

/** Підхід для хронологічного прогону: історія (з finishedAt) або активна сесія (без нього). */
export interface RecordSet extends PerformedSet {
  id: string;
  /** Коли завершилась сесія. Немає — це активна сесія, вона йде після всієї історії. */
  finishedAt?: number;
  completedAt: number;
  exercisePosition: number;
  position: number;
}

/**
 * Хронологічний прогін по всіх підходах однієї вправи: які підходи були рекордом на свій момент.
 * Викликається після редагування чи видалення сесії і щоразу, коли в активній сесії змінили підхід.
 */
export function rebuildPRs(sets: readonly RecordSet[], type: ExerciseType): Map<string, PRType[]> {
  const ordered = [...sets].sort(
    (a, b) =>
      (a.finishedAt ?? Infinity) - (b.finishedAt ?? Infinity) ||
      a.completedAt - b.completedAt ||
      a.exercisePosition - b.exercisePosition ||
      a.position - b.position,
  );
  const result = new Map<string, PRType[]>();
  const prior: PerformedSet[] = [];
  for (const s of ordered) {
    if (!isWorking(s)) continue;
    const prs = evaluateSetPRs(s, prior, type);
    if (prs.length > 0) result.set(s.id, prs);
    prior.push(s);
  }
  return result;
}

function weighted(set: PerformedSet): { w: number; r: number } | null {
  if (set.weightKg === undefined || set.reps === undefined || set.reps < 1) return null;
  return { w: roundWeight(set.weightKg), r: set.reps };
}

function numbers(values: (number | undefined)[]): number[] {
  return values.filter((v): v is number => v !== undefined);
}

function beatsMax(value: number, prior: number[]): boolean {
  return prior.length > 0 && prior.every((p) => greater(value, p));
}

function beatsMin(value: number, prior: number[]): boolean {
  return prior.length > 0 && prior.every((p) => greater(p, value));
}

/** Поточні найкращі значення для картки вправи (показники без «з цією вагою»). */
export function currentBests(
  sets: readonly PerformedSet[],
  type: ExerciseType,
): Partial<Record<PRType, number>> {
  const working = sets.filter(isWorking);
  const out: Partial<Record<PRType, number>> = {};
  const put = (key: PRType, values: number[], pick: 'max' | 'min' = 'max') => {
    if (values.length > 0) out[key] = pick === 'max' ? Math.max(...values) : Math.min(...values);
  };

  switch (type) {
    case 'weight_reps':
    case 'weighted_bodyweight': {
      const all = working.map(weighted).filter((p) => p !== null);
      put('max_weight', all.map((p) => p.w));
      put('e1rm', all.map((p) => epley1RM(p.w, p.r)).filter((v) => v !== undefined));
      put('max_volume', all.map((p) => p.w * p.r));
      break;
    }
    case 'assisted_bodyweight':
      put('min_assistance', working.map(weighted).filter((p) => p !== null).map((p) => p.w), 'min');
      break;
    case 'bodyweight_reps':
      put('max_reps', numbers(working.map((s) => s.reps)));
      break;
    case 'duration':
      put('max_duration', numbers(working.map((s) => s.durationSec)));
      break;
    case 'distance_duration':
      put('max_distance', numbers(working.map((s) => s.distanceM)));
      break;
  }
  return out;
}
