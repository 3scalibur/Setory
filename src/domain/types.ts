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

/** Цифри підходу. Для assisted_bodyweight weightKg — це допомога. */
export interface SetValues {
  weightKg?: number;
  reps?: number;
  durationSec?: number;
  distanceM?: number;
}

/** Підхід з його типом (розминка / робочий / дроп / до відмови). */
export interface PerformedSet extends SetValues {
  kind: SetKind;
}

/**
 * Виконаний підхід із журналу — плаский рядок для prefill, ↑ і 🏆.
 * Шар даних віддає лише виконані підходи (completed) із завершених сесій (status = 'finished')
 * без м'якого видалення. Активна сесія сюди не входить.
 */
export interface HistorySet extends PerformedSet {
  id: string;
  sessionId: string;
  sessionExerciseId: string;
  exerciseId: string;
  source: SessionSource;
  /** Знімок назви сесії: «Push», «Окрема вправа»… */
  sessionTitle: string;
  finishedAt: number;
  /** Місце вправи в сесії (session_exercises.position). */
  exercisePosition: number;
  /** Місце підходу у вправі (set_entries.position). */
  position: number;
  completedAt: number;
}

/** Вправа в завершеній сесії — зведення для backlog, ротації і «коли тренувався м'яз». */
export interface HistorySessionExercise {
  exerciseId: string;
  /** Слот програми, який виконує ця вправа (лише в сесіях програми). */
  routineExerciseId?: string;
  skipped: boolean;
  /** Скільки виконаних робочих (не розминочних) підходів. */
  workingSetsDone: number;
  targets?: TargetSet[];
  restSec?: number;
}

/** Завершена сесія — зведення без окремих підходів. */
export interface HistorySession {
  id: string;
  source: SessionSource;
  folderId?: string;
  routineId?: string;
  title: string;
  finishedAt: number;
  exercises: HistorySessionExercise[];
}
