import { and, asc, desc, eq, inArray, isNull, max } from 'drizzle-orm';

import { exercises, sessionExercises, setEntries, workoutSessions } from '@/db/schema';
import type { Db } from '@/db/types';

export type SessionRow = typeof workoutSessions.$inferSelect;
export type SessionExerciseRow = typeof sessionExercises.$inferSelect;
export type SetRow = typeof setEntries.$inferSelect;

// ---------- Сесії ----------

export function activeSessionQuery(db: Db) {
  return db
    .select()
    .from(workoutSessions)
    .where(and(eq(workoutSessions.status, 'active'), isNull(workoutSessions.deletedAt)));
}

export function getActiveSession(db: Db): SessionRow | undefined {
  return activeSessionQuery(db).get();
}

export function getSession(db: Db, id: string): SessionRow | undefined {
  return db
    .select()
    .from(workoutSessions)
    .where(and(eq(workoutSessions.id, id), isNull(workoutSessions.deletedAt)))
    .get();
}

/** Завершені тренування, нові зверху — для вкладки «Історія». */
export function finishedSessionsQuery(db: Db) {
  return db
    .select()
    .from(workoutSessions)
    .where(and(eq(workoutSessions.status, 'finished'), isNull(workoutSessions.deletedAt)))
    .orderBy(desc(workoutSessions.finishedAt));
}

export function insertSession(
  db: Db,
  row: Pick<SessionRow, 'id' | 'source' | 'title' | 'startedAt'> & Partial<Pick<SessionRow, 'folderId' | 'routineId'>>,
  now: number,
) {
  db.insert(workoutSessions)
    .values({ ...row, status: 'active', createdAt: now, updatedAt: now })
    .run();
}

export function updateSession(
  db: Db,
  id: string,
  fields: Partial<Pick<SessionRow, 'status' | 'finishedAt' | 'note' | 'deletedAt' | 'title'>>,
  now: number,
) {
  db.update(workoutSessions)
    .set({ ...fields, updatedAt: now })
    .where(eq(workoutSessions.id, id))
    .run();
}

// ---------- Вправи в сесії ----------

export function listSessionExercises(db: Db, sessionId: string): SessionExerciseRow[] {
  return db
    .select()
    .from(sessionExercises)
    .where(and(eq(sessionExercises.sessionId, sessionId), isNull(sessionExercises.deletedAt)))
    .orderBy(asc(sessionExercises.position))
    .all();
}

export function getSessionExercise(db: Db, id: string): SessionExerciseRow | undefined {
  return db
    .select()
    .from(sessionExercises)
    .where(and(eq(sessionExercises.id, id), isNull(sessionExercises.deletedAt)))
    .get();
}

export function nextSessionExercisePosition(db: Db, sessionId: string): number {
  const row = db
    .select({ p: max(sessionExercises.position) })
    .from(sessionExercises)
    .where(and(eq(sessionExercises.sessionId, sessionId), isNull(sessionExercises.deletedAt)))
    .get();
  return (row?.p ?? -1) + 1;
}

export function insertSessionExercise(
  db: Db,
  row: Pick<SessionExerciseRow, 'id' | 'sessionId' | 'exerciseId' | 'position'> &
    Partial<Pick<SessionExerciseRow, 'routineExerciseId' | 'skipped' | 'targetsSnapshot' | 'restSec'>>,
  now: number,
) {
  db.insert(sessionExercises)
    .values({ ...row, createdAt: now, updatedAt: now })
    .run();
}

export function updateSessionExercise(
  db: Db,
  id: string,
  fields: Partial<Pick<SessionExerciseRow, 'exerciseId' | 'position' | 'skipped' | 'restSec' | 'deletedAt'>>,
  now: number,
) {
  db.update(sessionExercises)
    .set({ ...fields, updatedAt: now })
    .where(eq(sessionExercises.id, id))
    .run();
}

// ---------- Підходи ----------

export function listSets(db: Db, sessionExerciseIds: readonly string[]): SetRow[] {
  if (sessionExerciseIds.length === 0) return [];
  return db
    .select()
    .from(setEntries)
    .where(and(inArray(setEntries.sessionExerciseId, [...sessionExerciseIds]), isNull(setEntries.deletedAt)))
    .orderBy(asc(setEntries.position))
    .all();
}

export function getSet(db: Db, id: string): SetRow | undefined {
  return db
    .select()
    .from(setEntries)
    .where(and(eq(setEntries.id, id), isNull(setEntries.deletedAt)))
    .get();
}

export function insertSets(db: Db, rows: Omit<SetRow, 'createdAt' | 'updatedAt' | 'deletedAt'>[], now: number) {
  if (rows.length === 0) return;
  db.insert(setEntries)
    .values(rows.map((r) => ({ ...r, createdAt: now, updatedAt: now })))
    .run();
}

export function updateSet(
  db: Db,
  id: string,
  fields: Partial<
    Pick<SetRow, 'position' | 'kind' | 'weightKg' | 'reps' | 'durationSec' | 'distanceM' | 'rpe' | 'completed' | 'completedAt' | 'deletedAt'>
  >,
  now: number,
) {
  db.update(setEntries)
    .set({ ...fields, updatedAt: now })
    .where(eq(setEntries.id, id))
    .run();
}

export function softDeleteSets(db: Db, ids: readonly string[], now: number) {
  if (ids.length === 0) return;
  db.update(setEntries)
    .set({ deletedAt: now, updatedAt: now })
    .where(inArray(setEntries.id, [...ids]))
    .run();
}

export function softDeleteSessionExercises(db: Db, ids: readonly string[], now: number) {
  if (ids.length === 0) return;
  db.update(sessionExercises)
    .set({ deletedAt: now, updatedAt: now })
    .where(inArray(sessionExercises.id, [...ids]))
    .run();
}

/** Тип вправи для підходу — щоб перевірити, чи можна позначити його виконаним. */
export function exerciseOfSessionExercise(db: Db, sessionExerciseId: string) {
  return db
    .select({ type: exercises.type, id: exercises.id })
    .from(sessionExercises)
    .innerJoin(exercises, eq(sessionExercises.exerciseId, exercises.id))
    .where(eq(sessionExercises.id, sessionExerciseId))
    .get();
}
