import { and, asc, eq, isNull, max } from 'drizzle-orm';

import { folders, routines } from '@/db/schema';
import type { Db } from '@/db/types';

export type FolderRow = typeof folders.$inferSelect;

export function foldersQuery(db: Db) {
  return db.select().from(folders).where(isNull(folders.deletedAt)).orderBy(asc(folders.position));
}

export function listFolders(db: Db): FolderRow[] {
  return foldersQuery(db).all();
}

export function getFolder(db: Db, id: string): FolderRow | undefined {
  return db
    .select()
    .from(folders)
    .where(and(eq(folders.id, id), isNull(folders.deletedAt)))
    .get();
}

export function getActiveFolder(db: Db): FolderRow | undefined {
  return db
    .select()
    .from(folders)
    .where(and(eq(folders.isActive, true), isNull(folders.deletedAt)))
    .get();
}

export function nextFolderPosition(db: Db): number {
  const row = db.select({ p: max(folders.position) }).from(folders).where(isNull(folders.deletedAt)).get();
  return (row?.p ?? -1) + 1;
}

export function insertFolder(db: Db, row: { id: string; name: string; position: number; isActive: boolean }, now: number) {
  db.insert(folders)
    .values({ ...row, createdAt: now, updatedAt: now })
    .run();
}

export function updateFolder(
  db: Db,
  id: string,
  fields: Partial<Pick<FolderRow, 'name' | 'position' | 'isActive' | 'deletedAt'>>,
  now: number,
) {
  db.update(folders)
    .set({ ...fields, updatedAt: now })
    .where(eq(folders.id, id))
    .run();
}

/** М'яко видаляє всі програми папки. */
export function softDeleteFolderRoutines(db: Db, folderId: string, now: number) {
  db.update(routines)
    .set({ deletedAt: now, updatedAt: now })
    .where(and(eq(routines.folderId, folderId), isNull(routines.deletedAt)))
    .run();
}
