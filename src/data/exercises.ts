import { and, count, countDistinct, eq, isNull, max, ne, sql } from 'drizzle-orm';

import { exercises, routineExercises, routines, sessionExercises, setEntries, workoutSessions } from '@/db/schema';
import type { Db } from '@/db/types';
import type { ExerciseUsage } from '@/domain/search';
import type { Equipment, ExerciseType, Mechanic, MuscleGroup } from '@/domain/types';

export type ExerciseRow = typeof exercises.$inferSelect;

// Запити-«конструктори» (без .all()) екрани передають у useLiveQuery і оновлюються самі.

export function exerciseCountQuery(db: Db) {
  return db
    .select({ n: count() })
    .from(exercises)
    .where(and(isNull(exercises.deletedAt), isNull(exercises.archivedAt)));
}

/** Усі невидалені вправи, включно з архівними (архівні потрібні, щоб показати історію). */
export function exercisesQuery(db: Db) {
  return db.select().from(exercises).where(isNull(exercises.deletedAt));
}

export function listExercises(db: Db): ExerciseRow[] {
  return exercisesQuery(db).all();
}

export function getExercise(db: Db, id: string): ExerciseRow | undefined {
  return db.select().from(exercises).where(eq(exercises.id, id)).get();
}

/** Коли востаннє і скільки разів виконували кожну вправу — для ранжування пошуку. */
export function exerciseUsage(db: Db): Map<string, ExerciseUsage> {
  const rows = db
    .select({
      exerciseId: sessionExercises.exerciseId,
      lastDoneAt: max(workoutSessions.finishedAt),
      count: countDistinct(workoutSessions.id),
    })
    .from(setEntries)
    .innerJoin(sessionExercises, eq(setEntries.sessionExerciseId, sessionExercises.id))
    .innerJoin(workoutSessions, eq(sessionExercises.sessionId, workoutSessions.id))
    .where(
      and(
        eq(workoutSessions.status, 'finished'),
        isNull(workoutSessions.deletedAt),
        isNull(sessionExercises.deletedAt),
        isNull(setEntries.deletedAt),
        eq(setEntries.completed, true),
        ne(setEntries.kind, 'warmup'),
      ),
    )
    .groupBy(sessionExercises.exerciseId)
    .all();
  return new Map(rows.map((r) => [r.exerciseId, { lastDoneAt: r.lastDoneAt ?? 0, count: r.count }]));
}

/** Чи є в журналі виконані підходи цієї вправи (тоді тип міняти не можна). */
export function hasHistory(db: Db, exerciseId: string): boolean {
  const row = db
    .select({ n: count() })
    .from(setEntries)
    .innerJoin(sessionExercises, eq(setEntries.sessionExerciseId, sessionExercises.id))
    .innerJoin(workoutSessions, eq(sessionExercises.sessionId, workoutSessions.id))
    .where(
      and(
        eq(sessionExercises.exerciseId, exerciseId),
        eq(workoutSessions.status, 'finished'),
        isNull(workoutSessions.deletedAt),
        isNull(sessionExercises.deletedAt),
        isNull(setEntries.deletedAt),
        eq(setEntries.completed, true),
      ),
    )
    .get();
  return (row?.n ?? 0) > 0;
}

/** Чи на вправу щось посилається: тренування (крім скасованих) або програми. */
export function isReferenced(db: Db, exerciseId: string): boolean {
  const inSessions = db
    .select({ n: count() })
    .from(sessionExercises)
    .innerJoin(workoutSessions, eq(sessionExercises.sessionId, workoutSessions.id))
    .where(
      and(
        eq(sessionExercises.exerciseId, exerciseId),
        isNull(sessionExercises.deletedAt),
        isNull(workoutSessions.deletedAt),
        ne(workoutSessions.status, 'discarded'),
      ),
    )
    .get();
  const inRoutines = db
    .select({ n: count() })
    .from(routineExercises)
    .innerJoin(routines, eq(routineExercises.routineId, routines.id))
    .where(
      and(eq(routineExercises.exerciseId, exerciseId), isNull(routineExercises.deletedAt), isNull(routines.deletedAt)),
    )
    .get();
  return (inSessions?.n ?? 0) + (inRoutines?.n ?? 0) > 0;
}

export interface ExerciseFields {
  name: string;
  aliases: string[];
  primaryMuscles: MuscleGroup[];
  secondaryMuscles: MuscleGroup[];
  equipment: Equipment;
  type: ExerciseType;
  mechanic: Mechanic;
  instructions?: string;
  mediaUrl?: string;
}

export function insertExercise(db: Db, id: string, fields: ExerciseFields, now: number): void {
  db.insert(exercises)
    .values({ id, ...fields, isCustom: true, createdAt: now, updatedAt: now })
    .run();
}

export function updateExercise(db: Db, id: string, fields: Partial<ExerciseFields>, now: number): void {
  db.update(exercises)
    .set({ ...fields, updatedAt: now })
    .where(eq(exercises.id, id))
    .run();
}

export function archiveExercise(db: Db, id: string, now: number): void {
  db.update(exercises).set({ archivedAt: now, updatedAt: now }).where(eq(exercises.id, id)).run();
}

export function softDeleteExercise(db: Db, id: string, now: number): void {
  db.update(exercises).set({ deletedAt: now, updatedAt: now }).where(eq(exercises.id, id)).run();
}

/** id архівних і видалених вправ — щоб сховати їх у пропущених. */
export function hiddenExerciseIds(db: Db): Set<string> {
  return new Set(
    db
      .select({ id: exercises.id })
      .from(exercises)
      .where(sql`${exercises.archivedAt} IS NOT NULL OR ${exercises.deletedAt} IS NOT NULL`)
      .all()
      .map((r) => r.id),
  );
}
