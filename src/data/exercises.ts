import { count, isNull } from 'drizzle-orm';

import { exercises } from '@/db/schema';
import type { Db } from '@/db/types';

// Запити до каталогу. Повертають запит, а не результат: екрани передають його в useLiveQuery
// і оновлюються самі, коли дані змінюються.

export function exerciseCountQuery(db: Db) {
  return db.select({ n: count() }).from(exercises).where(isNull(exercises.deletedAt));
}
