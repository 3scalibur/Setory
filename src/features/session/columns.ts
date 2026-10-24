import type { ExerciseType, SetValues } from '@/domain/types';

export interface Column {
  field: keyof SetValues;
  label: string;
  decimal: boolean;
}

/** Які поля вводяться для типу вправи. */
export function columnsFor(type: ExerciseType): Column[] {
  switch (type) {
    case 'weight_reps':
      return [
        { field: 'weightKg', label: 'кг', decimal: true },
        { field: 'reps', label: 'повт', decimal: false },
      ];
    case 'weighted_bodyweight':
      return [
        { field: 'weightKg', label: '+кг', decimal: true },
        { field: 'reps', label: 'повт', decimal: false },
      ];
    case 'assisted_bodyweight':
      return [
        { field: 'weightKg', label: '−кг', decimal: true },
        { field: 'reps', label: 'повт', decimal: false },
      ];
    case 'bodyweight_reps':
      return [{ field: 'reps', label: 'повт', decimal: false }];
    case 'duration':
      return [{ field: 'durationSec', label: 'сек', decimal: false }];
    case 'distance_duration':
      return [
        { field: 'distanceM', label: 'м', decimal: true },
        { field: 'durationSec', label: 'сек', decimal: false },
      ];
  }
}
