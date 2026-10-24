// Вкладка «Історія»: завершені тренування, нові зверху.

import { listExercises } from '@/data/exercises';
import { loadHistorySessions } from '@/data/history';
import { finishedSessionsQuery } from '@/data/sessions';
import type { SessionSource } from '@/domain/types';

import type { Deps } from './deps';

export interface HistoryListItem {
  id: string;
  source: SessionSource;
  title: string;
  startedAt: number;
  finishedAt: number;
  /** Виконані вправи і скільки робочих підходів у кожній. */
  exercises: { name: string; workingSets: number }[];
}

export function getHistoryList(deps: Deps): HistoryListItem[] {
  const startedAt = new Map(finishedSessionsQuery(deps.db).all().map((s) => [s.id, s.startedAt]));
  const names = new Map(listExercises(deps.db).map((e) => [e.id, e.name]));
  return loadHistorySessions(deps.db)
    .map((s) => ({
      id: s.id,
      source: s.source,
      title: s.title,
      startedAt: startedAt.get(s.id) ?? s.finishedAt,
      finishedAt: s.finishedAt,
      exercises: s.exercises
        .filter((e) => e.workingSetsDone > 0)
        .map((e) => ({ name: names.get(e.exerciseId) ?? 'Вправа', workingSets: e.workingSetsDone })),
    }))
    .sort((a, b) => b.finishedAt - a.finishedAt);
}
