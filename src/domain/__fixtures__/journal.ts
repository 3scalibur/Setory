// Будівник журналу для тестів: одна компактна історія → обидві форми, які віддає шар даних
// (плаский HistorySet[] і зведення HistorySession[]).

import { DAY_MS, HOUR_MS } from '../sets';
import type { HistorySession, HistorySet, SessionSource, SetKind, TargetSet } from '../types';

/** 1 вересня 2026, 21:00 за Києвом. */
export const BASE = Date.UTC(2026, 8, 1, 18, 0, 0);
export const day = (n: number) => BASE + n * DAY_MS;
/** Коли закінчилась сесія дня n. */
export const finishedOn = (n: number) => day(n) + HOUR_MS;

export interface FxSet {
  kind: SetKind;
  w?: number;
  r?: number;
  d?: number;
  m?: number;
}

/** Робочий підхід вага × повтори. */
export const set = (w: number | undefined, r?: number, kind: SetKind = 'working'): FxSet => ({ kind, w, r });
export const warm = (w: number | undefined, r?: number): FxSet => set(w, r, 'warmup');
export const timed = (d: number, m?: number): FxSet => ({ kind: 'working', d, m });

/** Рядок програми: кг (може бути порожнім) і повтори або діапазон. */
export const target = (
  w: number | undefined,
  repsMin: number,
  repsMax: number = repsMin,
  kind: SetKind = 'working',
): Omit<TargetSet, 'position'> => ({ kind, weightKg: w, repsMin, repsMax });

export const targets = (...rows: Omit<TargetSet, 'position'>[]): TargetSet[] =>
  rows.map((row, position) => ({ ...row, position }));

export interface FxExercise {
  exerciseId: string;
  /** Слот програми (routine_exercise_id). */
  slot?: string;
  skipped?: boolean;
  targets?: TargetSet[];
  restSec?: number;
  sets?: FxSet[];
}

export interface FxSession {
  id?: string;
  source: SessionSource;
  title?: string;
  folderId?: string;
  routineId?: string;
  /** День від BASE. */
  day: number;
  exercises: FxExercise[];
}

const DEFAULT_TITLES: Record<SessionSource, string> = {
  routine: 'Програма',
  single_exercise: 'Окрема вправа',
  catch_up: 'День пропущених',
  free: 'Вільне тренування',
};

export function journal(fx: FxSession[]): { sessions: HistorySession[]; sets: HistorySet[] } {
  const sessions: HistorySession[] = [];
  const sets: HistorySet[] = [];

  fx.forEach((s, sessionIndex) => {
    const sessionId = s.id ?? `s${sessionIndex}`;
    const title = s.title ?? DEFAULT_TITLES[s.source];
    const finishedAt = finishedOn(s.day);

    sessions.push({
      id: sessionId,
      source: s.source,
      folderId: s.folderId,
      routineId: s.routineId,
      title,
      finishedAt,
      exercises: s.exercises.map((e) => ({
        exerciseId: e.exerciseId,
        routineExerciseId: e.slot,
        skipped: e.skipped ?? false,
        workingSetsDone: (e.sets ?? []).filter((x) => x.kind !== 'warmup').length,
        targets: e.targets,
        restSec: e.restSec,
      })),
    });

    s.exercises.forEach((e, exercisePosition) => {
      (e.sets ?? []).forEach((x, position) => {
        sets.push({
          id: `${sessionId}-e${exercisePosition}-s${position}`,
          sessionId,
          sessionExerciseId: `${sessionId}-e${exercisePosition}`,
          exerciseId: e.exerciseId,
          source: s.source,
          sessionTitle: title,
          finishedAt,
          exercisePosition,
          position,
          kind: x.kind,
          weightKg: x.w,
          reps: x.r,
          durationSec: x.d,
          distanceM: x.m,
          // Підходи йдуть кожні 2.5 хв від початку дня.
          completedAt: day(s.day) + (exercisePosition * 10 + position + 1) * 150_000,
        });
      });
    });
  });

  return { sessions, sets };
}
