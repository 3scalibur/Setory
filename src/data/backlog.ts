import { isNull } from 'drizzle-orm';

import { backlogDismissals } from '@/db/schema';
import type { Db } from '@/db/types';
import type { Dismissal } from '@/domain/backlog';

export function listDismissals(db: Db): Dismissal[] {
  return db
    .select({ exerciseId: backlogDismissals.exerciseId, dismissedAt: backlogDismissals.dismissedAt })
    .from(backlogDismissals)
    .where(isNull(backlogDismissals.deletedAt))
    .all();
}

export function insertDismissals(db: Db, rows: { id: string; exerciseId: string }[], now: number) {
  if (rows.length === 0) return;
  db.insert(backlogDismissals)
    .values(rows.map((r) => ({ ...r, dismissedAt: now, createdAt: now, updatedAt: now })))
    .run();
}
