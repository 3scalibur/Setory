import { and, asc, eq, inArray, isNull, max } from 'drizzle-orm';

import { routineExercises, routines, routineSets } from '@/db/schema';
import type { Db } from '@/db/types';

export type RoutineRow = typeof routines.$inferSelect;
export type RoutineExerciseRow = typeof routineExercises.$inferSelect;
export type RoutineSetRow = typeof routineSets.$inferSelect;

export function routinesQuery(db: Db, folderId: string) {
  return db
    .select()
    .from(routines)
    .where(and(eq(routines.folderId, folderId), isNull(routines.deletedAt)))
    .orderBy(asc(routines.position));
}

/** Усі живі програми всіх папок — для вкладки «Тренування». */
export function allRoutinesQuery(db: Db) {
  return db.select().from(routines).where(isNull(routines.deletedAt)).orderBy(asc(routines.position));
}

export function listRoutines(db: Db, folderId: string): RoutineRow[] {
  return routinesQuery(db, folderId).all();
}

/** Для «Наступне»: програми папки разом з видаленими (за їхнім місцем шукаємо наступну). */
export function rotationRoutines(db: Db, folderId: string): { id: string; position: number; deleted: boolean }[] {
  return db
    .select({ id: routines.id, position: routines.position, deletedAt: routines.deletedAt })
    .from(routines)
    .where(eq(routines.folderId, folderId))
    .all()
    .map((r) => ({ id: r.id, position: r.position, deleted: r.deletedAt !== null }));
}

export function getRoutine(db: Db, id: string): RoutineRow | undefined {
  return db
    .select()
    .from(routines)
    .where(and(eq(routines.id, id), isNull(routines.deletedAt)))
    .get();
}

export function listRoutineExercises(db: Db, routineIds: readonly string[]): RoutineExerciseRow[] {
  if (routineIds.length === 0) return [];
  return db
    .select()
    .from(routineExercises)
    .where(and(inArray(routineExercises.routineId, [...routineIds]), isNull(routineExercises.deletedAt)))
    .orderBy(asc(routineExercises.position))
    .all();
}

export function listRoutineSets(db: Db, routineExerciseIds: readonly string[]): RoutineSetRow[] {
  if (routineExerciseIds.length === 0) return [];
  return db
    .select()
    .from(routineSets)
    .where(and(inArray(routineSets.routineExerciseId, [...routineExerciseIds]), isNull(routineSets.deletedAt)))
    .orderBy(asc(routineSets.position))
    .all();
}

export function nextRoutinePosition(db: Db, folderId: string): number {
  const row = db
    .select({ p: max(routines.position) })
    .from(routines)
    .where(and(eq(routines.folderId, folderId), isNull(routines.deletedAt)))
    .get();
  return (row?.p ?? -1) + 1;
}

export function insertRoutine(
  db: Db,
  row: { id: string; folderId: string; name: string; position: number; note?: string | null },
  now: number,
) {
  db.insert(routines)
    .values({ ...row, createdAt: now, updatedAt: now })
    .run();
}

export function updateRoutine(
  db: Db,
  id: string,
  fields: Partial<Pick<RoutineRow, 'name' | 'note' | 'folderId' | 'position' | 'deletedAt'>>,
  now: number,
) {
  db.update(routines)
    .set({ ...fields, updatedAt: now })
    .where(eq(routines.id, id))
    .run();
}

export function insertRoutineExercise(
  db: Db,
  row: { id: string; routineId: string; exerciseId: string; position: number; restSec: number; note?: string | null },
  now: number,
) {
  db.insert(routineExercises)
    .values({ ...row, createdAt: now, updatedAt: now })
    .run();
}

export function updateRoutineExercise(
  db: Db,
  id: string,
  fields: Partial<Pick<RoutineExerciseRow, 'exerciseId' | 'position' | 'restSec' | 'note' | 'deletedAt'>>,
  now: number,
) {
  db.update(routineExercises)
    .set({ ...fields, updatedAt: now })
    .where(eq(routineExercises.id, id))
    .run();
}

export function insertRoutineSets(
  db: Db,
  rows: Omit<RoutineSetRow, 'createdAt' | 'updatedAt' | 'deletedAt'>[],
  now: number,
) {
  if (rows.length === 0) return;
  db.insert(routineSets)
    .values(rows.map((r) => ({ ...r, createdAt: now, updatedAt: now })))
    .run();
}

/** М'яко видаляє всі підходи вказаних вправ програми. */
export function softDeleteRoutineSets(db: Db, routineExerciseIds: readonly string[], now: number) {
  if (routineExerciseIds.length === 0) return;
  db.update(routineSets)
    .set({ deletedAt: now, updatedAt: now })
    .where(and(inArray(routineSets.routineExerciseId, [...routineExerciseIds]), isNull(routineSets.deletedAt)))
    .run();
}
