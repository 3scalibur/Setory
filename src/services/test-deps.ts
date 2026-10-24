// Тільки для тестів: справжня SQLite з міграціями і каталогом, керований годинник, передбачувані id.

import { createTestDb } from '@/db/test-db';
import { bootstrapDatabase } from '@/db/seed';
import { BUILTIN_EXERCISES } from '@/db/seed/exercises';
import { normalizeText } from '@/domain/text';

import type { Deps } from './deps';

/** 1 жовтня 2026, 21:00 за Києвом. */
export const START = Date.UTC(2026, 9, 1, 18, 0, 0);
export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

export function createTestDeps() {
  const { db, sqlite } = createTestDb();
  let time = START;
  let counter = 0;
  const deps: Deps = {
    db,
    now: () => time,
    newId: () => `id-${String(++counter).padStart(4, '0')}`,
  };
  bootstrapDatabase(db, time, deps.newId);
  return {
    deps,
    sqlite,
    /** Перемотати годинник вперед. */
    advance: (ms: number) => {
      time += ms;
    },
    /** Поставити годинник на день n від START (той самий час доби). */
    goToDay: (n: number) => {
      time = START + n * DAY;
    },
  };
}

/** id вбудованої вправи за її синонімом: ex('bench press'). */
export function ex(alias: string): string {
  const e = BUILTIN_EXERCISES.find((x) => x.aliases.map(normalizeText).includes(normalizeText(alias)));
  if (!e) throw new Error(`Немає вправи з синонімом «${alias}»`);
  return e.id;
}
