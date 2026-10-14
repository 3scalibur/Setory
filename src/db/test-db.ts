// Тільки для тестів: справжня SQLite у Node (better-sqlite3) з тими самими міграціями, що й у застосунку.
// Застосунок цей файл не імпортує.

import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'node:path';

import * as schema from './schema';
import type { Db } from './types';

export function createTestDb(): { db: Db; sqlite: Database.Database } {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.join(__dirname, '../../drizzle') });
  return { db, sqlite };
}

export const testId = () => randomUUID();
