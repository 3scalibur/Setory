import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
import { randomUUID } from 'expo-crypto';
import { useEffect, useState } from 'react';

import migrations from '../../drizzle/migrations';
import { db } from './client';
import { bootstrapDatabase } from './seed';

type DbState = { status: 'loading' } | { status: 'ready' } | { status: 'error'; error: Error };

// Один спільний запуск на весь застосунок, навіть якщо хук змонтується двічі.
let preparing: Promise<void> | null = null;

function prepareDatabase(): Promise<void> {
  preparing ??= migrate(db, migrations).then(() => {
    bootstrapDatabase(db, Date.now(), randomUUID);
  });
  return preparing;
}

/** Застосовує міграції, потім готує каталог і папку за замовчуванням. */
export function useDatabaseReady(): DbState {
  const [state, setState] = useState<DbState>({ status: 'loading' });

  useEffect(() => {
    let mounted = true;
    prepareDatabase().then(
      () => mounted && setState({ status: 'ready' }),
      (error: Error) => mounted && setState({ status: 'error', error }),
    );
    return () => {
      mounted = false;
    };
  }, []);

  return state;
}
