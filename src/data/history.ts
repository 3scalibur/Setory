// Журнал для доменних функцій: лише виконані підходи із завершених сесій без м'якого видалення.

import { and, count, eq, gte, inArray, isNull, ne, type SQL } from 'drizzle-orm';

import { sessionExercises, setEntries, workoutSessions } from '@/db/schema';
import type { Db } from '@/db/types';
import type { HistorySession, HistorySet } from '@/domain/types';

import { orUndefined } from './util';

function finishedSessions(sinceMs?: number): SQL {
  const conditions = [eq(workoutSessions.status, 'finished'), isNull(workoutSessions.deletedAt)];
  if (sinceMs !== undefined) conditions.push(gte(workoutSessions.finishedAt, sinceMs));
  return and(...conditions)!;
}

/** Плаский журнал підходів (для prefill, ↑, 🏆). Можна обмежити списком вправ. */
export function loadHistorySets(db: Db, exerciseIds?: readonly string[]): HistorySet[] {
  if (exerciseIds && exerciseIds.length === 0) return [];
  const conditions = [
    finishedSessions(),
    isNull(sessionExercises.deletedAt),
    isNull(setEntries.deletedAt),
    eq(setEntries.completed, true),
  ];
  if (exerciseIds) conditions.push(inArray(sessionExercises.exerciseId, [...new Set(exerciseIds)]));

  return db
    .select({
      id: setEntries.id,
      sessionId: workoutSessions.id,
      sessionExerciseId: sessionExercises.id,
      exerciseId: sessionExercises.exerciseId,
      source: workoutSessions.source,
      sessionTitle: workoutSessions.title,
      finishedAt: workoutSessions.finishedAt,
      exercisePosition: sessionExercises.position,
      position: setEntries.position,
      kind: setEntries.kind,
      weightKg: setEntries.weightKg,
      reps: setEntries.reps,
      durationSec: setEntries.durationSec,
      distanceM: setEntries.distanceM,
      completedAt: setEntries.completedAt,
    })
    .from(setEntries)
    .innerJoin(sessionExercises, eq(setEntries.sessionExerciseId, sessionExercises.id))
    .innerJoin(workoutSessions, eq(sessionExercises.sessionId, workoutSessions.id))
    .where(and(...conditions))
    .all()
    .map((r) => {
      const finishedAt = r.finishedAt ?? 0;
      return {
        id: r.id,
        sessionId: r.sessionId,
        sessionExerciseId: r.sessionExerciseId,
        exerciseId: r.exerciseId,
        source: r.source,
        sessionTitle: r.sessionTitle,
        finishedAt,
        exercisePosition: r.exercisePosition,
        position: r.position,
        kind: r.kind,
        weightKg: orUndefined(r.weightKg),
        reps: orUndefined(r.reps),
        durationSec: orUndefined(r.durationSec),
        distanceM: orUndefined(r.distanceM),
        completedAt: r.completedAt ?? finishedAt,
      };
    });
}

/** Зведення по завершених сесіях (для пропущених, ротації, «коли тренувався м'яз»). */
export function loadHistorySessions(db: Db, sinceMs?: number): HistorySession[] {
  const sessions = db
    .select()
    .from(workoutSessions)
    .where(finishedSessions(sinceMs))
    .all();

  const exercises = db
    .select({
      id: sessionExercises.id,
      sessionId: sessionExercises.sessionId,
      exerciseId: sessionExercises.exerciseId,
      routineExerciseId: sessionExercises.routineExerciseId,
      skipped: sessionExercises.skipped,
      targets: sessionExercises.targetsSnapshot,
      restSec: sessionExercises.restSec,
      position: sessionExercises.position,
    })
    .from(sessionExercises)
    .innerJoin(workoutSessions, eq(sessionExercises.sessionId, workoutSessions.id))
    .where(and(finishedSessions(sinceMs), isNull(sessionExercises.deletedAt)))
    .all()
    .sort((a, b) => a.position - b.position);

  const workingDone = new Map(
    db
      .select({ id: setEntries.sessionExerciseId, n: count() })
      .from(setEntries)
      .innerJoin(sessionExercises, eq(setEntries.sessionExerciseId, sessionExercises.id))
      .innerJoin(workoutSessions, eq(sessionExercises.sessionId, workoutSessions.id))
      .where(
        and(
          finishedSessions(sinceMs),
          isNull(sessionExercises.deletedAt),
          isNull(setEntries.deletedAt),
          eq(setEntries.completed, true),
          ne(setEntries.kind, 'warmup'),
        ),
      )
      .groupBy(setEntries.sessionExerciseId)
      .all()
      .map((r) => [r.id, r.n]),
  );

  const bySession = new Map<string, HistorySession['exercises']>();
  for (const e of exercises) {
    const list = bySession.get(e.sessionId) ?? [];
    list.push({
      exerciseId: e.exerciseId,
      routineExerciseId: orUndefined(e.routineExerciseId),
      skipped: e.skipped,
      workingSetsDone: workingDone.get(e.id) ?? 0,
      targets: orUndefined(e.targets),
      restSec: orUndefined(e.restSec),
    });
    bySession.set(e.sessionId, list);
  }

  return sessions.map((s) => ({
    id: s.id,
    source: s.source,
    folderId: orUndefined(s.folderId),
    routineId: orUndefined(s.routineId),
    title: s.title,
    finishedAt: s.finishedAt ?? s.startedAt,
    exercises: bySession.get(s.id) ?? [],
  }));
}
