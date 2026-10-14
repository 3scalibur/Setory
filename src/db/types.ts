import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import type * as schema from './schema';

/**
 * Синхронна база Drizzle з нашою схемою.
 * У застосунку це expo-sqlite, у тестах — better-sqlite3 у Node.
 * Репозиторії й seed приймають саме цей тип, тому їх можна тестувати без телефона.
 */
export type Db = BaseSQLiteDatabase<'sync', any, typeof schema>;
