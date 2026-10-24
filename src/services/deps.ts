import type { Db } from '@/db/types';

/**
 * Усе, що сервісам потрібно ззовні. У застосунку — справжня БД, Date.now і randomUUID;
 * у тестах — SQLite у Node, керований годинник і передбачувані id.
 */
export interface Deps {
  db: Db;
  now: () => number;
  newId: () => string;
}

/** Помилка, яку можна показати користувачу як є (текст українською). */
export class UserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserError';
  }
}

/** Вже є активне тренування — нове почати не можна, лише продовжити або завершити. */
export class ActiveSessionError extends UserError {
  constructor(readonly activeSessionId: string) {
    super('Вже є незавершене тренування. Продовж або заверши його.');
    this.name = 'ActiveSessionError';
  }
}

/** Виконати кілька записів атомарно: або все, або нічого. Вкладені виклики — savepoint. */
export function inTransaction<T>(deps: Deps, fn: (deps: Deps) => T): T {
  return deps.db.transaction((tx) => fn({ ...deps, db: tx as unknown as Db }));
}
