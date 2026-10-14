// Правила завершення тренування (SPEC.md, розділи 5 і 11).

import { CONFIG } from '@/config';

import { HOUR_MS, isWorking } from './sets';
import type { SetKind } from './types';

export interface FinishExercise {
  id: string;
  /** Є — це слот програми. */
  routineExerciseId?: string;
  sets: { id: string; kind: SetKind; completed: boolean }[];
}

export interface FinishPlan {
  deleteSetIds: string[];
  deleteExerciseIds: string[];
}

/**
 * «Завершити»: невиконані підходи видаляються; вправи без жодного виконаного робочого підходу
 * видаляються разом з підходами — крім слотів програми, вони лишаються для пропущених.
 */
export function planFinish(exercises: readonly FinishExercise[]): FinishPlan {
  const deleteSetIds: string[] = [];
  const deleteExerciseIds: string[] = [];
  for (const e of exercises) {
    const hasWork = e.sets.some((s) => s.completed && isWorking(s));
    if (!hasWork && !e.routineExerciseId) {
      deleteExerciseIds.push(e.id);
      deleteSetIds.push(...e.sets.map((s) => s.id));
    } else {
      deleteSetIds.push(...e.sets.filter((s) => !s.completed).map((s) => s.id));
    }
  }
  return { deleteSetIds, deleteExerciseIds };
}

/**
 * Активне тренування старше за 6 год (апка закрилась, сів телефон) → пропонуємо завершити.
 * Повертає finishedAt = час останнього виконаного підходу (або початку), інакше null.
 */
export function staleSessionFinishAt(startedAt: number, completedAts: readonly number[], now: number): number | null {
  if (now - startedAt <= CONFIG.STALE_SESSION_HOURS * HOUR_MS) return null;
  return completedAts.length > 0 ? Math.max(...completedAts) : startedAt;
}
