import { eq, sql } from 'drizzle-orm';

import { DEFAULT_FOLDER_NAME } from '@/config';

import { exercises, folders, settings } from '../schema';
import type { Db } from '../types';
import { BUILTIN_EXERCISES } from './exercises';

/** Збільшуй, коли змінюєш вбудований каталог — тоді він оновиться в уже встановленій апці. */
export const SEED_VERSION = 2;

const SEED_VERSION_KEY = 'seed_version';

export interface BootstrapResult {
  catalogUpdated: boolean;
  defaultFolderCreated: boolean;
}

/**
 * Підготовка БД після міграцій. Безпечно викликати при кожному запуску:
 * 1) оновлює вбудований каталог, якщо змінився SEED_VERSION (історія не чіпається — id вправ сталі);
 * 2) на першому запуску створює активну папку «Мої програми».
 */
export function bootstrapDatabase(db: Db, now: number, newId: () => string): BootstrapResult {
  return db.transaction((tx) => {
    const stored = tx.select().from(settings).where(eq(settings.key, SEED_VERSION_KEY)).get();
    const storedVersion = typeof stored?.value === 'number' ? stored.value : 0;
    const catalogUpdated = storedVersion < SEED_VERSION;

    if (catalogUpdated) {
      for (const e of BUILTIN_EXERCISES) {
        const fields = {
          name: e.name,
          aliases: e.aliases,
          primaryMuscles: e.primaryMuscles,
          secondaryMuscles: e.secondaryMuscles,
          equipment: e.equipment,
          type: e.type,
          mechanic: e.mechanic,
          updatedAt: now,
        };
        tx.insert(exercises)
          .values({ id: e.id, ...fields, isCustom: false, createdAt: now })
          .onConflictDoUpdate({ target: exercises.id, set: fields })
          .run();
      }
      tx.insert(settings)
        .values({ key: SEED_VERSION_KEY, value: SEED_VERSION, updatedAt: now })
        .onConflictDoUpdate({ target: settings.key, set: { value: SEED_VERSION, updatedAt: now } })
        .run();
    }

    // Перший запуск = у таблиці ще не було жодної папки, навіть видаленої.
    const folderCount = tx.select({ n: sql<number>`count(*)` }).from(folders).get()?.n ?? 0;
    const defaultFolderCreated = folderCount === 0;
    if (defaultFolderCreated) {
      tx.insert(folders)
        .values({
          id: newId(),
          name: DEFAULT_FOLDER_NAME,
          position: 0,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        })
        .run();
    }

    return { catalogUpdated, defaultFolderCreated };
  });
}
