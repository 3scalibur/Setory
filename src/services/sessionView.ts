// Те, що показує екран тренування: вправи, підходи, «Попереднє», «Минулого разу», 🏆 і ↑, підсумок.
// Усе рахується з журналу щоразу заново — тому зміна цифр або галочки одразу перераховує позначки.

import { listExercises } from '@/data/exercises';
import { loadHistorySets } from '@/data/history';
import * as data from '@/data/sessions';
import { lastPerformance, previousForSets, type LastPerformance } from '@/domain/performance';
import { compareWithPrevious, setMark, summarizeSession, type SessionSummary, type SetMark } from '@/domain/progress';
import { rebuildPRs, type PRType, type RecordSet } from '@/domain/records';
import type {
  ExerciseType,
  Mechanic,
  MuscleGroup,
  PerformedSet,
  SessionSource,
  SessionStatus,
  SetKind,
  TargetSet,
} from '@/domain/types';

import type { Deps } from './deps';
import { groupBy } from './sessionService';

export interface SessionSetView {
  id: string;
  position: number;
  kind: SetKind;
  weightKg?: number;
  reps?: number;
  durationSec?: number;
  distanceM?: number;
  completed: boolean;
  /** «Попереднє» — підхід з тим самим номером минулого разу. */
  previous?: PerformedSet;
  prs: PRType[];
  mark: SetMark;
}

export interface SessionExerciseView {
  id: string;
  exerciseId: string;
  name: string;
  type: ExerciseType;
  mechanic: Mechanic;
  primaryMuscles: MuscleGroup[];
  routineExerciseId?: string;
  skipped: boolean;
  restSec?: number;
  targets?: TargetSet[];
  /** «Минулого разу: 12 вер, окремо». */
  last: LastPerformance | null;
  sets: SessionSetView[];
}

export interface SessionView {
  id: string;
  source: SessionSource;
  title: string;
  status: SessionStatus;
  startedAt: number;
  finishedAt?: number;
  exercises: SessionExerciseView[];
  summary: SessionSummary & { newRecords: { exerciseName: string; setId: string; prs: PRType[] }[] };
}

export function getSessionView(deps: Deps, sessionId: string): SessionView | null {
  const session = data.getSession(deps.db, sessionId);
  if (!session) return null;
  const isActive = session.status === 'active';

  const exerciseRows = data.listSessionExercises(deps.db, sessionId);
  const setsByExercise = groupBy(
    data.listSets(deps.db, exerciseRows.map((e) => e.id)),
    (s) => s.sessionExerciseId,
  );
  const catalog = new Map(listExercises(deps.db).map((e) => [e.id, e]));
  const exerciseIds = [...new Set(exerciseRows.map((e) => e.exerciseId))];
  const history = loadHistorySets(deps.db, exerciseIds);

  // «Минулого разу» — лише тренування, завершені раніше за це.
  const before = history.filter(
    (h) => h.sessionId !== session.id && (isActive || h.finishedAt <= (session.finishedAt ?? Infinity)),
  );

  // 🏆 — хронологічний прогін по всій історії вправи; для активної сесії додаємо її виконані підходи.
  const recordsByExercise = new Map<string, Map<string, PRType[]>>();
  for (const exerciseId of exerciseIds) {
    const type = catalog.get(exerciseId)?.type;
    if (!type) continue;
    const input: RecordSet[] = history.filter((h) => h.exerciseId === exerciseId);
    if (isActive) {
      for (const e of exerciseRows.filter((r) => r.exerciseId === exerciseId)) {
        for (const s of setsByExercise.get(e.id) ?? []) {
          if (!s.completed) continue;
          input.push({
            id: s.id,
            kind: s.kind,
            ...valuesOf(s),
            completedAt: s.completedAt ?? deps.now(),
            exercisePosition: e.position,
            position: s.position,
          });
        }
      }
    }
    recordsByExercise.set(exerciseId, rebuildPRs(input, type));
  }

  const exercises: SessionExerciseView[] = exerciseRows.map((row) => {
    const info = catalog.get(row.exerciseId);
    const type = info?.type ?? 'weight_reps';
    const last = lastPerformance(row.exerciseId, before);
    const rows = setsByExercise.get(row.id) ?? [];
    const previous = previousForSets(rows, last);
    const records = recordsByExercise.get(row.exerciseId);

    return {
      id: row.id,
      exerciseId: row.exerciseId,
      name: info?.name ?? 'Вправа',
      type,
      mechanic: info?.mechanic ?? 'isolation',
      primaryMuscles: info?.primaryMuscles ?? [],
      routineExerciseId: row.routineExerciseId ?? undefined,
      skipped: row.skipped,
      restSec: row.restSec ?? undefined,
      targets: row.targetsSnapshot ?? undefined,
      last,
      sets: rows.map((s, i) => {
        const performed: PerformedSet = { kind: s.kind, ...valuesOf(s) };
        const prs = s.completed ? (records?.get(s.id) ?? []) : [];
        const progress = s.completed ? compareWithPrevious(performed, previous[i], type) : null;
        return {
          id: s.id,
          position: s.position,
          ...performed,
          completed: s.completed,
          ...(previous[i] ? { previous: previous[i] } : {}),
          prs,
          mark: setMark(prs, progress),
        };
      }),
    };
  });

  // Підсумок: вправа з прогресом = хоча б одна 🏆 або ↑ (блоки однієї вправи рахуються разом).
  const marksByExercise = new Map<string, SetMark[]>();
  for (const e of exercises) {
    marksByExercise.set(e.exerciseId, [...(marksByExercise.get(e.exerciseId) ?? []), ...e.sets.map((s) => s.mark)]);
  }
  const summary = summarizeSession([...marksByExercise].map(([exerciseId, marks]) => ({ exerciseId, marks })));
  const newRecords = exercises.flatMap((e) =>
    e.sets.filter((s) => s.prs.length > 0).map((s) => ({ exerciseName: e.name, setId: s.id, prs: s.prs })),
  );

  return {
    id: session.id,
    source: session.source,
    title: session.title,
    status: session.status,
    startedAt: session.startedAt,
    finishedAt: session.finishedAt ?? undefined,
    exercises,
    summary: { ...summary, newRecords },
  };
}

function valuesOf(s: { weightKg: number | null; reps: number | null; durationSec: number | null; distanceM: number | null }) {
  const out: { weightKg?: number; reps?: number; durationSec?: number; distanceM?: number } = {};
  if (s.weightKg !== null) out.weightKg = s.weightKg;
  if (s.reps !== null) out.reps = s.reps;
  if (s.durationSec !== null) out.durationSec = s.durationSec;
  if (s.distanceM !== null) out.distanceM = s.distanceM;
  return out;
}
