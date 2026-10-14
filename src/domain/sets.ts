// Базові правила для одного підходу: робочий чи ні, округлення ваги, порівняння, валідація.

import { CONFIG } from '@/config';

import type { ExerciseType, PerformedSet, SetKind, SetValues } from './types';

export const DAY_MS = 24 * 60 * 60 * 1000;
export const HOUR_MS = 60 * 60 * 1000;

/** Робочий підхід = не розминка (SPEC.md, розділ 4). drop і failure — робочі. */
export function isWorking(set: { kind: SetKind }): boolean {
  return set.kind !== 'warmup';
}

const WEIGHT_FACTOR = Math.round(1 / CONFIG.WEIGHT_PRECISION_KG);

/** Округлення ваги до 0.01 кг — так «рівний результат» не ламається через похибки дробів. */
export function roundWeight(kg: number): number {
  return Math.round(kg * WEIGHT_FACTOR) / WEIGHT_FACTOR;
}

const EPSILON = 1e-9;

/** a строго більше за b (з допуском на похибку дробів). */
export function greater(a: number, b: number): boolean {
  return a - b > EPSILON;
}

export function same(a: number, b: number): boolean {
  return Math.abs(a - b) <= EPSILON;
}

/** Розрахунковий 1ПМ за Еплі; лише для 1–12 повторів (SPEC.md, розділ 7). */
export function epley1RM(weightKg: number, reps: number): number | undefined {
  if (reps < 1 || reps > CONFIG.EPLEY_MAX_REPS) return undefined;
  return weightKg * (1 + reps / 30);
}

/** Чи можна позначити підхід виконаним (SPEC.md, розділ 11). */
export function canCompleteSet(values: SetValues, type: ExerciseType): boolean {
  const repsOk = values.reps !== undefined && Number.isInteger(values.reps) && values.reps >= 1;
  const weightOk = values.weightKg !== undefined && values.weightKg >= 0;
  switch (type) {
    case 'weight_reps':
    case 'weighted_bodyweight':
    case 'assisted_bodyweight':
      return repsOk && weightOk;
    case 'bodyweight_reps':
      return repsOk;
    case 'duration':
      return values.durationSec !== undefined && values.durationSec > 0;
    case 'distance_duration':
      return (
        values.distanceM !== undefined &&
        values.distanceM > 0 &&
        values.durationSec !== undefined &&
        values.durationSec > 0
      );
  }
}

/** Лише цифри підходу, без службових полів. */
export function valuesOf(set: SetValues): SetValues {
  const out: SetValues = {};
  if (set.weightKg !== undefined) out.weightKg = set.weightKg;
  if (set.reps !== undefined) out.reps = set.reps;
  if (set.durationSec !== undefined) out.durationSec = set.durationSec;
  if (set.distanceM !== undefined) out.distanceM = set.distanceM;
  return out;
}

export function performed(set: PerformedSet): PerformedSet {
  return { kind: set.kind, ...valuesOf(set) };
}
