// Пропущені вправи (SPEC.md, розділ 8). Не зберігаються: щоразу рахуються з журналу,
// тому завжди збігаються з історією, навіть після редагування чи видалення сесій.

import { CONFIG } from '@/config';

import { DAY_MS } from './sets';
import type { HistorySession, TargetSet } from './types';

export interface BacklogItem {
  exerciseId: string;
  firstMissedAt: number;
  lastMissedAt: number;
  missCount: number;
  /** Назва програми з найсвіжішого пропуску: «пропущено в Push». */
  lastRoutineTitle: string;
  /** Цілі з найсвіжішого пропуску — з ними вправа йде в день пропущених. */
  targets?: TargetSet[];
  restSec?: number;
}

export interface Dismissal {
  exerciseId: string;
  dismissedAt: number;
}

interface MissEvent {
  exerciseId: string;
  missedAt: number;
  title: string;
  targets?: TargetSet[];
  restSec?: number;
}

export function computeBacklog(
  sessions: readonly HistorySession[],
  dismissals: readonly Dismissal[],
  now: number,
  options: { hiddenExerciseIds?: ReadonlySet<string> } = {},
): BacklogItem[] {
  const expiryMs = CONFIG.BACKLOG_EXPIRY_DAYS * DAY_MS;
  const isDone = (workingSetsDone: number) => workingSetsDone >= CONFIG.DONE_THRESHOLD;

  // Коли кожну вправу виконували (будь-яке джерело).
  const doneAt = new Map<string, number[]>();
  for (const s of sessions) {
    for (const e of s.exercises) {
      if (!isDone(e.workingSetsDone)) continue;
      const list = doneAt.get(e.exerciseId) ?? [];
      list.push(s.finishedAt);
      doneAt.set(e.exerciseId, list);
    }
  }

  // 1. Пропуски: невиконані слоти в сесіях програми. Старші за 2 × строк зберігання не дивимось.
  const events: MissEvent[] = [];
  for (const s of sessions) {
    if (s.source !== 'routine' || now - s.finishedAt > 2 * expiryMs) continue;
    const doneHere = new Set(s.exercises.filter((e) => isDone(e.workingSetsDone)).map((e) => e.exerciseId));
    for (const e of s.exercises) {
      if (!e.routineExerciseId) continue;
      if (!e.skipped && isDone(e.workingSetsDone)) continue;
      if (doneHere.has(e.exerciseId)) continue; // ту саму вправу зробили в цій же сесії окремим блоком
      events.push({ exerciseId: e.exerciseId, missedAt: s.finishedAt, title: s.title, targets: e.targets, restSec: e.restSec });
    }
  }

  const lastDismissal = new Map<string, number>();
  for (const d of dismissals) {
    lastDismissal.set(d.exerciseId, Math.max(d.dismissedAt, lastDismissal.get(d.exerciseId) ?? -Infinity));
  }

  // 2. Закриття: після пропуску вправу виконали будь-де. 4. Прибрані вручну: пропуски до «прибрати» не рахуються.
  const open = events.filter((ev) => {
    const closed = (doneAt.get(ev.exerciseId) ?? []).some((t) => t > ev.missedAt);
    const dismissed = ev.missedAt <= (lastDismissal.get(ev.exerciseId) ?? -Infinity);
    return !closed && !dismissed;
  });

  // 3. Злиття по вправі.
  const items = new Map<string, BacklogItem>();
  for (const ev of open.sort((a, b) => a.missedAt - b.missedAt)) {
    const item = items.get(ev.exerciseId);
    items.set(ev.exerciseId, {
      exerciseId: ev.exerciseId,
      firstMissedAt: item?.firstMissedAt ?? ev.missedAt,
      lastMissedAt: ev.missedAt,
      missCount: (item?.missCount ?? 0) + 1,
      lastRoutineTitle: ev.title,
      targets: ev.targets,
      restSec: ev.restSec,
    });
  }

  // 5. Застарілі й архівні приховані.
  return [...items.values()]
    .filter((item) => now - item.lastMissedAt <= expiryMs)
    .filter((item) => !options.hiddenExerciseIds?.has(item.exerciseId))
    .sort((a, b) => b.lastMissedAt - a.lastMissedAt || a.exerciseId.localeCompare(b.exerciseId));
}
