// «Минулого разу» і підстановка цифр (SPEC.md, розділи 6 і 10б).
// Історія належить вправі: шукаємо по exerciseId серед усіх сесій, незалежно від режиму запуску.

import { CONFIG } from '@/config';

import { isWorking, performed, valuesOf } from './sets';
import type { HistorySet, PerformedSet, SessionSource, SetKind, SetValues, TargetSet } from './types';

export interface LastPerformance {
  sessionId: string;
  source: SessionSource;
  sessionTitle: string;
  finishedAt: number;
  warmups: PerformedSet[];
  working: PerformedSet[];
}

/**
 * Останнє виконання вправи = найсвіжіша завершена сесія будь-якого джерела,
 * де ця вправа має хоча б один робочий підхід. Якщо вправа була в сесії двічі — блоки йдуть підряд.
 */
export function lastPerformance(exerciseId: string, history: readonly HistorySet[]): LastPerformance | null {
  let best: HistorySet | null = null;
  for (const s of history) {
    if (s.exerciseId !== exerciseId || !isWorking(s)) continue;
    if (
      !best ||
      s.finishedAt > best.finishedAt ||
      (s.finishedAt === best.finishedAt && s.sessionId > best.sessionId)
    ) {
      best = s;
    }
  }
  if (!best) return null;

  const sessionSets = history
    .filter((s) => s.exerciseId === exerciseId && s.sessionId === best.sessionId)
    .sort((a, b) => a.exercisePosition - b.exercisePosition || a.position - b.position);

  return {
    sessionId: best.sessionId,
    source: best.source,
    sessionTitle: best.sessionTitle,
    finishedAt: best.finishedAt,
    warmups: sessionSets.filter((s) => !isWorking(s)).map(performed),
    working: sessionSets.filter(isWorking).map(performed),
  };
}

export interface PrefillSet extends SetValues {
  position: number;
  kind: SetKind;
  /** «Попереднє»: підхід з тим самим номером минулого разу. Немає — стовпець порожній і ↑ не ставиться. */
  previous?: PerformedSet;
}

export interface PrefillInput {
  last: LastPerformance | null;
  /** Рядки програми (знімок цілей слоту). Немає — вправу додано не з програми. */
  targets?: readonly TargetSet[];
  /**
   * Звідки брати кількість і типи підходів: 'last' — як минулого разу (налаштування за замовчуванням),
   * 'template' — як у програмі. Для картки програми завжди 'template'.
   */
  setCountSource: 'last' | 'template';
}

/**
 * Підходи, якими заповнюється вправа в сесії. Нічого не позначено виконаним.
 * Цифри: з минулого разу (підхід i → підхід i, зайві копіюють останній),
 * якщо історії немає — з рядків програми (повтори = початок діапазону).
 */
export function buildPrefill({ last, targets = [], setCountSource }: PrefillInput): PrefillSet[] {
  const targetWarmups = targets.filter((t) => !isWorking(t));
  const targetWorking = targets.filter(isWorking);

  // Кількість і типи підходів беремо з одного джерела.
  const shapeFromHistory = last !== null && (setCountSource === 'last' || targetWorking.length === 0);
  let warmupKinds: SetKind[];
  let workingKinds: SetKind[];
  if (shapeFromHistory) {
    warmupKinds = last.warmups.map((s) => s.kind);
    workingKinds = last.working.map((s) => s.kind);
  } else if (targetWorking.length > 0) {
    warmupKinds = targetWarmups.map((t) => t.kind);
    workingKinds = targetWorking.map((t) => t.kind);
  } else {
    warmupKinds = [];
    workingKinds = Array<SetKind>(CONFIG.DEFAULT_SETS).fill('working');
  }

  const fill = (kinds: SetKind[], done: PerformedSet[], planned: TargetSet[]) =>
    kinds.map((kind, i) => {
      const source = done.length > 0 ? done[Math.min(i, done.length - 1)] : undefined;
      const values = source ? valuesOf(source) : fromTarget(planned[i]);
      const previous = done[i];
      return { kind, ...values, ...(previous ? { previous } : {}) };
    });

  return [
    ...fill(warmupKinds, last?.warmups ?? [], targetWarmups),
    ...fill(workingKinds, last?.working ?? [], targetWorking),
  ].map((s, position) => ({ position, ...s }));
}

function fromTarget(t: TargetSet | undefined): SetValues {
  if (!t) return {};
  return valuesOf({ weightKg: t.weightKg, reps: t.repsMin, durationSec: t.durationSec, distanceM: t.distanceM });
}
