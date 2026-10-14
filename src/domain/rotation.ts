// «Наступне: Push» (SPEC.md, розділи 4 і 10б). Не зберігається, а обчислюється:
// програма після останньої завершеної програми цієї папки, по колу.
// Окрема вправа, день пропущених і вільне тренування покажчик не зсувають.

import type { HistorySession } from './types';

export interface RotationRoutine {
  id: string;
  position: number;
  /** Видалені теж передаються: за їхнім місцем знаходимо наступну. */
  deleted: boolean;
}

export function nextRoutine(
  routines: readonly RotationRoutine[],
  sessions: readonly Pick<HistorySession, 'source' | 'folderId' | 'routineId' | 'finishedAt'>[],
  folderId: string,
): string | null {
  const ordered = [...routines].sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
  const firstLive = ordered.find((r) => !r.deleted);
  if (!firstLive) return null;

  let last: (typeof sessions)[number] | undefined;
  for (const s of sessions) {
    if (s.source !== 'routine' || s.folderId !== folderId || !s.routineId) continue;
    if (!last || s.finishedAt > last.finishedAt) last = s;
  }
  if (!last) return firstLive.id;

  const index = ordered.findIndex((r) => r.id === last.routineId);
  if (index === -1) return firstLive.id;

  for (let step = 1; step <= ordered.length; step++) {
    const candidate = ordered[(index + step) % ordered.length];
    if (!candidate.deleted) return candidate.id;
  }
  return firstLive.id;
}
