import { estimateExerciseSec, medianSetIntervalSec } from '@/domain/catchUp';
import { buildPrefill, lastPerformance } from '@/domain/performance';
import type { HistorySet, Mechanic, TargetSet } from '@/domain/types';

/** Скільки секунд займе вправа: стільки підходів, скільки буде підставлено, і реальний темп з історії. */
export function estimateExercise(input: {
  exerciseId: string;
  mechanic: Mechanic;
  targets?: readonly TargetSet[];
  restSec?: number;
  history: readonly HistorySet[];
  setCountSource: 'last' | 'template';
}): number {
  const own = input.history.filter((h) => h.exerciseId === input.exerciseId);
  const setCount = buildPrefill({
    last: lastPerformance(input.exerciseId, own),
    targets: input.targets,
    setCountSource: input.setCountSource,
  }).length;
  return estimateExerciseSec({
    setCount,
    mechanic: input.mechanic,
    restSec: input.restSec,
    medianIntervalSec: medianSetIntervalSec(own),
  });
}
