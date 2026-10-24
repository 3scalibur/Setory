// Дані екрана, які самі оновлюються після будь-якого запису в БД.
// Сервіси синхронні, тому достатньо перерахувати результат, коли SQLite повідомляє про зміну.

import { addDatabaseChangeListener } from 'expo-sqlite';
import { useEffect, useMemo, useState } from 'react';

/** Номер «версії» БД: збільшується після кожної пачки змін (кілька змін підряд — одне оновлення). */
function useDbVersion(): number {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let scheduled = false;
    const subscription = addDatabaseChangeListener(() => {
      if (scheduled) return;
      scheduled = true;
      setTimeout(() => {
        scheduled = false;
        setVersion((v) => v + 1);
      }, 0);
    });
    return () => subscription.remove();
  }, []);
  return version;
}

/**
 * Обчислює дані екрана і перераховує їх після змін у БД.
 * compute отримує версію аргументом, щоб React Compiler не закешував застарілий результат.
 */
export function useLive<T>(compute: (version: number) => T): T {
  const version = useDbVersion();
  return useMemo(() => compute(version), [compute, version]);
}
