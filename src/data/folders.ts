import { asc, isNull } from 'drizzle-orm';

import { folders } from '@/db/schema';
import type { Db } from '@/db/types';

export function foldersQuery(db: Db) {
  return db.select().from(folders).where(isNull(folders.deletedAt)).orderBy(asc(folders.position));
}
