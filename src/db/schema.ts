// Схема SQLite. Повний опис і причини рішень — docs/ARCHITECTURE.md, розділ 5.
// Після зміни цього файлу: `npm run db:generate` створює нову міграцію в drizzle/.
// Старі міграції ніколи не редагуються.

import { sql } from 'drizzle-orm';
import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

import type {
  Equipment,
  ExerciseType,
  Mechanic,
  MuscleGroup,
  SessionSource,
  SessionStatus,
  SetKind,
  TargetSet,
} from '@/domain/types';

// Спільні колонки. Функції, а не об'єкти: кожна таблиця отримує власні екземпляри колонок.
const id = () => text('id').primaryKey();
const timestamps = () => ({
  createdAt: integer('created_at').notNull(), // мс, UTC
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at'), // м'яке видалення
});

// ---------- Каталог ----------

export const exercises = sqliteTable('exercises', {
  id: id(),
  name: text('name').notNull(),
  aliases: text('aliases', { mode: 'json' }).$type<string[]>().notNull(),
  primaryMuscles: text('primary_muscles', { mode: 'json' }).$type<MuscleGroup[]>().notNull(),
  secondaryMuscles: text('secondary_muscles', { mode: 'json' }).$type<MuscleGroup[]>().notNull(),
  equipment: text('equipment').$type<Equipment>().notNull(),
  type: text('type').$type<ExerciseType>().notNull(),
  mechanic: text('mechanic').$type<Mechanic>().notNull(),
  instructions: text('instructions'),
  mediaUrl: text('media_url'),
  isCustom: integer('is_custom', { mode: 'boolean' }).notNull().default(false),
  archivedAt: integer('archived_at'),
  ...timestamps(),
});

// ---------- Шаблони: папки і програми ----------

export const folders = sqliteTable(
  'folders',
  {
    id: id(),
    name: text('name').notNull(),
    position: integer('position').notNull(),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(false),
    ...timestamps(),
  },
  (t) => [
    // Активна папка лише одна — це гарантує сама БД.
    uniqueIndex('folders_one_active')
      .on(t.isActive)
      .where(sql`is_active = 1 AND deleted_at IS NULL`),
  ],
);

export const routines = sqliteTable(
  'routines',
  {
    id: id(),
    folderId: text('folder_id')
      .notNull()
      .references(() => folders.id),
    name: text('name').notNull(),
    position: integer('position').notNull(),
    note: text('note'),
    ...timestamps(),
  },
  (t) => [index('routines_folder_position').on(t.folderId, t.position)],
);

export const routineExercises = sqliteTable(
  'routine_exercises',
  {
    id: id(),
    routineId: text('routine_id')
      .notNull()
      .references(() => routines.id),
    exerciseId: text('exercise_id')
      .notNull()
      .references(() => exercises.id),
    position: integer('position').notNull(),
    restSec: integer('rest_sec').notNull(),
    note: text('note'),
    ...timestamps(),
  },
  (t) => [index('routine_exercises_routine').on(t.routineId)],
);

export const routineSets = sqliteTable(
  'routine_sets',
  {
    id: id(),
    routineExerciseId: text('routine_exercise_id')
      .notNull()
      .references(() => routineExercises.id),
    position: integer('position').notNull(),
    kind: text('kind').$type<SetKind>().notNull(),
    weightKg: real('weight_kg'), // стартова вага: лише поки вправу не виконували
    repsMin: integer('reps_min'),
    repsMax: integer('reps_max'),
    durationSec: integer('duration_sec'),
    distanceM: real('distance_m'),
    ...timestamps(),
  },
  (t) => [index('routine_sets_routine_exercise').on(t.routineExerciseId)],
);

// ---------- Журнал (єдине джерело правди) ----------

export const workoutSessions = sqliteTable(
  'workout_sessions',
  {
    id: id(),
    source: text('source').$type<SessionSource>().notNull(),
    folderId: text('folder_id').references(() => folders.id), // лише для source = 'routine'
    routineId: text('routine_id').references(() => routines.id), // лише для source = 'routine'
    title: text('title').notNull(), // знімок назви на момент старту
    status: text('status').$type<SessionStatus>().notNull(),
    startedAt: integer('started_at').notNull(),
    finishedAt: integer('finished_at'),
    note: text('note'),
    ...timestamps(),
  },
  (t) => [
    index('workout_sessions_status_finished').on(t.status, t.finishedAt),
    // Активне тренування лише одне — це гарантує сама БД.
    uniqueIndex('workout_sessions_one_active')
      .on(t.status)
      .where(sql`status = 'active' AND deleted_at IS NULL`),
  ],
);

export const sessionExercises = sqliteTable(
  'session_exercises',
  {
    id: id(),
    sessionId: text('session_id')
      .notNull()
      .references(() => workoutSessions.id),
    exerciseId: text('exercise_id')
      .notNull()
      .references(() => exercises.id),
    position: integer('position').notNull(),
    routineExerciseId: text('routine_exercise_id').references(() => routineExercises.id),
    skipped: integer('skipped', { mode: 'boolean' }).notNull().default(false),
    targetsSnapshot: text('targets_snapshot', { mode: 'json' }).$type<TargetSet[]>(),
    restSec: integer('rest_sec'),
    ...timestamps(),
  },
  (t) => [
    index('session_exercises_session').on(t.sessionId),
    index('session_exercises_exercise').on(t.exerciseId),
  ],
);

export const setEntries = sqliteTable(
  'set_entries',
  {
    id: id(),
    sessionExerciseId: text('session_exercise_id')
      .notNull()
      .references(() => sessionExercises.id),
    position: integer('position').notNull(),
    kind: text('kind').$type<SetKind>().notNull(),
    weightKg: real('weight_kg'), // для assisted_bodyweight — допомога
    reps: integer('reps'),
    durationSec: integer('duration_sec'),
    distanceM: real('distance_m'),
    rpe: real('rpe'),
    completed: integer('completed', { mode: 'boolean' }).notNull().default(false),
    completedAt: integer('completed_at'),
    ...timestamps(),
  },
  (t) => [index('set_entries_session_exercise').on(t.sessionExerciseId)],
);

// ---------- Службове ----------

export const backlogDismissals = sqliteTable(
  'backlog_dismissals',
  {
    id: id(),
    exerciseId: text('exercise_id')
      .notNull()
      .references(() => exercises.id),
    dismissedAt: integer('dismissed_at').notNull(),
    ...timestamps(),
  },
  (t) => [index('backlog_dismissals_exercise').on(t.exerciseId)],
);

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value', { mode: 'json' }).notNull(),
  updatedAt: integer('updated_at').notNull(),
});
