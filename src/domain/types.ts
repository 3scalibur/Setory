// Доменні типи. Цей файл не імпортує нічого з React Native, БД чи UI.

export type ExerciseType =
  | 'weight_reps' // жим штанги: вага × повтори
  | 'bodyweight_reps' // віджимання: тільки повтори
  | 'weighted_bodyweight' // підтягування з обтяженням: +вага × повтори
  | 'assisted_bodyweight' // гравітрон: допомога × повтори (менше = краще)
  | 'duration' // планка: секунди
  | 'distance_duration'; // кардіо: метри + секунди

export const EXERCISE_TYPES: readonly ExerciseType[] = [
  'weight_reps',
  'bodyweight_reps',
  'weighted_bodyweight',
  'assisted_bodyweight',
  'duration',
  'distance_duration',
];

export type MuscleGroup =
  | 'chest'
  | 'lats'
  | 'upper_back'
  | 'lower_back'
  | 'traps'
  | 'neck'
  | 'front_delts'
  | 'side_delts'
  | 'rear_delts'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'abs'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'adductors'
  | 'abductors';

export const MUSCLE_GROUPS: readonly MuscleGroup[] = [
  'chest',
  'lats',
  'upper_back',
  'lower_back',
  'traps',
  'neck',
  'front_delts',
  'side_delts',
  'rear_delts',
  'biceps',
  'triceps',
  'forearms',
  'abs',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'adductors',
  'abductors',
];

export type Equipment =
  | 'barbell'
  | 'dumbbell'
  | 'machine'
  | 'cable'
  | 'bodyweight'
  | 'kettlebell'
  | 'band'
  | 'other';

export const EQUIPMENT: readonly Equipment[] = [
  'barbell',
  'dumbbell',
  'machine',
  'cable',
  'bodyweight',
  'kettlebell',
  'band',
  'other',
];

export type Mechanic = 'compound' | 'isolation';

export type SetKind = 'warmup' | 'working' | 'drop' | 'failure';

export type SessionSource = 'routine' | 'single_exercise' | 'catch_up' | 'free';

export type SessionStatus = 'active' | 'finished' | 'discarded';

/** Підхід програми, скопійований у сесію на момент старту (знімок цілей). */
export interface TargetSet {
  position: number;
  kind: SetKind;
  weightKg?: number;
  repsMin?: number;
  repsMax?: number;
  durationSec?: number;
  distanceM?: number;
}
