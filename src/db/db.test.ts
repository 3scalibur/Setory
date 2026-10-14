/**
 * @jest-environment node
 */
// Перевіряє міграції, перший запуск і гарантії схеми на справжній SQLite.

import { eq, sql } from 'drizzle-orm';

import { DEFAULT_FOLDER_NAME } from '@/config';

import { exercises, folders, routines, workoutSessions } from './schema';
import { bootstrapDatabase } from './seed';
import { BUILTIN_EXERCISES } from './seed/exercises';
import { createTestDb, testId } from './test-db';

const NOW = Date.UTC(2026, 9, 14, 12, 0, 0);

function countRows(db: ReturnType<typeof createTestDb>['db'], table: typeof exercises | typeof folders) {
  return db.select({ n: sql<number>`count(*)` }).from(table).get()?.n ?? 0;
}

describe('база даних', () => {
  it('перший запуск: каталог завантажено і створено активну папку «Мої програми»', () => {
    const { db } = createTestDb();
    const result = bootstrapDatabase(db, NOW, testId);

    expect(result).toEqual({ catalogUpdated: true, defaultFolderCreated: true });
    expect(countRows(db, exercises)).toBe(BUILTIN_EXERCISES.length);
    const all = db.select().from(folders).all();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ name: DEFAULT_FOLDER_NAME, isActive: true });
  });

  it('повторний запуск нічого не дублює', () => {
    const { db } = createTestDb();
    bootstrapDatabase(db, NOW, testId);
    const second = bootstrapDatabase(db, NOW + 1000, testId);

    expect(second).toEqual({ catalogUpdated: false, defaultFolderCreated: false });
    expect(countRows(db, exercises)).toBe(BUILTIN_EXERCISES.length);
    expect(countRows(db, folders)).toBe(1);
  });

  it('JSON-поля і булеві значення читаються в правильних типах', () => {
    const { db } = createTestDb();
    bootstrapDatabase(db, NOW, testId);
    const bench = db
      .select()
      .from(exercises)
      .where(eq(exercises.id, BUILTIN_EXERCISES.find((e) => e.aliases.includes('bench press'))!.id))
      .get();

    expect(bench?.primaryMuscles).toEqual(['chest']);
    expect(bench?.aliases).toContain('жим лежа');
    expect(bench?.isCustom).toBe(false);
  });

  it('друга активна папка неможлива', () => {
    const { db } = createTestDb();
    bootstrapDatabase(db, NOW, testId);

    expect(() =>
      db
        .insert(folders)
        .values({ id: testId(), name: 'PPL', position: 1, isActive: true, createdAt: NOW, updatedAt: NOW })
        .run(),
    ).toThrow(/UNIQUE/);
  });

  it('друге активне тренування неможливе, а завершених може бути скільки завгодно', () => {
    const { db } = createTestDb();
    const session = (status: 'active' | 'finished') => ({
      id: testId(),
      source: 'free' as const,
      title: 'Вільне тренування',
      status,
      startedAt: NOW,
      createdAt: NOW,
      updatedAt: NOW,
    });

    db.insert(workoutSessions).values(session('finished')).run();
    db.insert(workoutSessions).values(session('finished')).run();
    db.insert(workoutSessions).values(session('active')).run();
    expect(() => db.insert(workoutSessions).values(session('active')).run()).toThrow(/UNIQUE/);
  });

  it('програма не може посилатися на неіснуючу папку', () => {
    const { db } = createTestDb();

    expect(() =>
      db
        .insert(routines)
        .values({ id: testId(), folderId: testId(), name: 'Push', position: 0, createdAt: NOW, updatedAt: NOW })
        .run(),
    ).toThrow(/FOREIGN KEY/);
  });
});
