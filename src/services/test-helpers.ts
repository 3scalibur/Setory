// Тільки для тестів: короткі дії «зробив тренування».

import type { Deps } from './deps';
import { addSet, completeSet, finishSession, updateSet } from './sessionService';
import { getSessionView } from './sessionView';
import { MINUTE } from './test-deps';

/** Ввести цифри в підходи вправи сесії (додаючи підходи за потреби) і позначити виконаними. */
export function doSets(
  deps: Deps,
  advance: (ms: number) => void,
  sessionId: string,
  exerciseId: string,
  values: [number, number][],
): void {
  const exercise = getSessionView(deps, sessionId)!.exercises.find((e) => e.exerciseId === exerciseId && !e.skipped);
  if (!exercise) throw new Error(`У сесії немає вправи ${exerciseId}`);
  const ids = exercise.sets.map((s) => s.id);
  while (ids.length < values.length) ids.push(addSet(deps, exercise.id));
  values.forEach(([weightKg, reps], i) => {
    updateSet(deps, ids[i], { weightKg, reps });
    advance(2 * MINUTE);
    completeSet(deps, ids[i]);
  });
}

/** Виконати всі вправи сесії однаковими цифрами і завершити. */
export function finishWith(
  deps: Deps,
  advance: (ms: number) => void,
  sessionId: string,
  values: Record<string, [number, number][]>,
): void {
  for (const [exerciseId, sets] of Object.entries(values)) doSets(deps, advance, sessionId, exerciseId, sets);
  finishSession(deps, sessionId);
}
