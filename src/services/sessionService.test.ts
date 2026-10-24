/**
 * @jest-environment node
 */
import { loadHistorySessions } from '@/data/history';
import { computeBacklog } from '@/domain/backlog';

import { ActiveSessionError, UserError, type Deps } from './deps';
import { createFolder } from './folderService';
import { saveRoutine } from './routineService';
import {
  addExercise,
  addSet,
  completeSet,
  discardSession,
  finishSession,
  getActiveSessionState,
  moveExercise,
  removeSet,
  replaceExercise,
  restoreExercise,
  skipExercise,
  startCatchUp,
  startFree,
  startRoutine,
  startSingleExercise,
  uncompleteSet,
  updateSet,
} from './sessionService';
import { getSessionView } from './sessionView';
import { createTestDeps, DAY, ex, HOUR, MINUTE } from './test-deps';

const BENCH = ex('bench press');
const INCLINE = ex('incline bench press (dumbbell)');
const FLY = ex('chest fly (machine)');
const MACHINE_PRESS = ex('chest press (machine)');
const PUSHDOWN = ex('triceps pushdown');
const LATERAL = ex('lateral raise (dumbbell)');
const PULL_UP = ex('pull up');

function pushRoutine(deps: Deps, folderId: string) {
  return saveRoutine(deps, {
    folderId,
    name: 'Push',
    exercises: [
      { exerciseId: BENCH, sets: [{ kind: 'working', repsMin: 8, repsMax: 10 }, { kind: 'working', repsMin: 8, repsMax: 10 }, { kind: 'working', repsMin: 8, repsMax: 10 }] },
      { exerciseId: INCLINE, sets: [{ kind: 'working', weightKg: 18, repsMin: 6, repsMax: 10 }] },
      { exerciseId: FLY, sets: [{ kind: 'working', repsMin: 12, repsMax: 15 }] },
      { exerciseId: PUSHDOWN, sets: [{ kind: 'working', repsMin: 12, repsMax: 15 }] },
      { exerciseId: LATERAL, sets: [{ kind: 'working', weightKg: 8, repsMin: 12, repsMax: 20 }] },
    ],
  });
}

/** Ввести цифри у всі підходи вправи і позначити їх виконаними. */
function doSets(deps: Deps, advance: (ms: number) => void, sessionId: string, exerciseId: string, values: [number, number][]) {
  const view = getSessionView(deps, sessionId)!;
  const exercise = view.exercises.find((e) => e.exerciseId === exerciseId && !e.skipped)!;
  while (exercise.sets.length < values.length) {
    exercise.sets.push({ id: addSet(deps, exercise.id) } as never);
  }
  values.forEach(([weightKg, reps], i) => {
    const setId = exercise.sets[i].id;
    updateSet(deps, setId, { weightKg, reps });
    advance(2 * MINUTE);
    completeSet(deps, setId);
  });
  return exercise.id;
}

describe('старт тренування', () => {
  it('день програми: вправи-слоти зі знімком цілей і підставленими підходами', () => {
    const { deps } = createTestDeps();
    const routineId = pushRoutine(deps, createFolder(deps, 'PPL'));

    const sessionId = startRoutine(deps, routineId);
    const view = getSessionView(deps, sessionId)!;

    expect(view).toMatchObject({ source: 'routine', title: 'Push', status: 'active' });
    expect(view.exercises.map((e) => e.exerciseId)).toEqual([BENCH, INCLINE, FLY, PUSHDOWN, LATERAL]);
    expect(view.exercises[0].targets).toHaveLength(3);
    expect(view.exercises[0].sets.map((s) => [s.weightKg, s.reps])).toEqual([
      [undefined, 8],
      [undefined, 8],
      [undefined, 8],
    ]);
    // Історії ще немає — кг з програми.
    expect(view.exercises[1].sets[0]).toMatchObject({ weightKg: 18, reps: 6, completed: false });
  });

  it('одночасно активне лише одне тренування', () => {
    const { deps } = createTestDeps();
    const first = startFree(deps);

    expect(() => startFree(deps)).toThrow(ActiveSessionError);
    expect(() => startCatchUp(deps, [{ exerciseId: BENCH }])).toThrow(ActiveSessionError);
    try {
      startFree(deps);
    } catch (e) {
      expect((e as ActiveSessionError).activeSessionId).toBe(first);
    }
  });

  it('окрема вправа при активному тренуванні додається в нього; джерело не змінюється', () => {
    const { deps } = createTestDeps();
    const first = startSingleExercise(deps, BENCH);
    const second = startSingleExercise(deps, LATERAL);

    expect(first.addedToActive).toBe(false);
    expect(second).toMatchObject({ sessionId: first.sessionId, addedToActive: true });
    const view = getSessionView(deps, first.sessionId)!;
    expect(view.source).toBe('single_exercise');
    expect(view.exercises.map((e) => e.exerciseId)).toEqual([BENCH, LATERAL]);
  });

  it('сценарій 1 через сервіс: окремо 4×8 по 60 → у Push жим має 4 підходи 60×8 і «минулого разу: окремо»', () => {
    const { deps, advance } = createTestDeps();
    const routineId = pushRoutine(deps, createFolder(deps, 'PPL'));
    const single = startSingleExercise(deps, BENCH);
    doSets(deps, advance, single.sessionId, BENCH, [[60, 8], [60, 8], [60, 8], [60, 8]]);
    finishSession(deps, single.sessionId);
    advance(DAY);

    const view = getSessionView(deps, startRoutine(deps, routineId))!;
    const bench = view.exercises[0];

    expect(bench.sets.map((s) => [s.weightKg, s.reps])).toEqual([[60, 8], [60, 8], [60, 8], [60, 8]]);
    expect(bench.sets[0].previous).toMatchObject({ weightKg: 60, reps: 8 });
    expect(bench.last).toMatchObject({ source: 'single_exercise', sessionTitle: 'Окрема вправа' });
  });
});

describe('під час тренування', () => {
  it('не можна позначити виконаним без цифр', () => {
    const { deps } = createTestDeps();
    const { sessionId } = startSingleExercise(deps, BENCH);
    const setId = getSessionView(deps, sessionId)!.exercises[0].sets[0].id;

    expect(() => completeSet(deps, setId)).toThrow(new UserError('Вкажи вагу і повтори.'));
    updateSet(deps, setId, { weightKg: 60 });
    expect(() => completeSet(deps, setId)).toThrow(UserError);
    updateSet(deps, setId, { reps: 8 });
    completeSet(deps, setId);
    expect(getSessionView(deps, sessionId)!.exercises[0].sets[0].completed).toBe(true);
  });

  it('стерли цифру у виконаному підході → галочка знімається', () => {
    const { deps, advance } = createTestDeps();
    const { sessionId } = startSingleExercise(deps, BENCH);
    doSets(deps, advance, sessionId, BENCH, [[60, 8]]);
    const setId = getSessionView(deps, sessionId)!.exercises[0].sets[0].id;

    updateSet(deps, setId, { reps: null });

    expect(getSessionView(deps, sessionId)!.exercises[0].sets[0].completed).toBe(false);
  });

  it('вага округлюється до 0.01 кг', () => {
    const { deps } = createTestDeps();
    const { sessionId } = startSingleExercise(deps, BENCH);
    const setId = getSessionView(deps, sessionId)!.exercises[0].sets[0].id;

    updateSet(deps, setId, { weightKg: 0.1 + 0.2 });

    expect(getSessionView(deps, sessionId)!.exercises[0].sets[0].weightKg).toBe(0.3);
  });

  it('додати й видалити підхід: нумерація без дірок, новий копіює останній', () => {
    const { deps } = createTestDeps();
    const { sessionId, sessionExerciseId } = startSingleExercise(deps, BENCH);
    const first = getSessionView(deps, sessionId)!.exercises[0].sets[0].id;
    updateSet(deps, first, { weightKg: 50, reps: 10 });

    addSet(deps, sessionExerciseId);
    removeSet(deps, first);
    const sets = getSessionView(deps, sessionId)!.exercises[0].sets;

    expect(sets.map((s) => s.position)).toEqual([0, 1, 2]);
    expect(sets.length).toBe(3);
  });

  it('змінити порядок вправ', () => {
    const { deps } = createTestDeps();
    const sessionId = startFree(deps);
    const a = addExercise(deps, sessionId, BENCH);
    addExercise(deps, sessionId, LATERAL);
    addExercise(deps, sessionId, PUSHDOWN);

    moveExercise(deps, a, 2);

    expect(getSessionView(deps, sessionId)!.exercises.map((e) => e.exerciseId)).toEqual([LATERAL, PUSHDOWN, BENCH]);
  });

  it('прибрати слот програми, а потім повернути', () => {
    const { deps } = createTestDeps();
    const sessionId = startRoutine(deps, pushRoutine(deps, createFolder(deps, 'PPL')));
    const fly = getSessionView(deps, sessionId)!.exercises[2];

    skipExercise(deps, fly.id);
    expect(getSessionView(deps, sessionId)!.exercises[2]).toMatchObject({ skipped: true, sets: [] });

    restoreExercise(deps, fly.id);
    expect(getSessionView(deps, sessionId)!.exercises[2].skipped).toBe(false);
    expect(getSessionView(deps, sessionId)!.exercises[2].sets.length).toBeGreaterThan(0);
  });

  it('🏆 і ↑ з’являються, коли підхід позначено виконаним, і перераховуються при зміні цифр', () => {
    const { deps, advance } = createTestDeps();
    const s1 = startSingleExercise(deps, BENCH).sessionId;
    doSets(deps, advance, s1, BENCH, [[60, 8], [60, 8]]);
    finishSession(deps, s1);
    advance(DAY);

    const s2 = startSingleExercise(deps, BENCH).sessionId;
    doSets(deps, advance, s2, BENCH, [[62.5, 8], [60, 9]]);
    let sets = getSessionView(deps, s2)!.exercises[0].sets;
    expect(sets.map((s) => s.mark)).toEqual(['pr', 'pr']);

    updateSet(deps, sets[1].id, { reps: 8 });
    completeSet(deps, sets[1].id);
    sets = getSessionView(deps, s2)!.exercises[0].sets;
    // 60×8 після 60×8 минулого разу — ні 🏆, ні ↑.
    expect(sets[1].mark).toBeNull();

    uncompleteSet(deps, sets[0].id);
    sets = getSessionView(deps, s2)!.exercises[0].sets;
    expect(sets[0].mark).toBeNull();
  });

  it('↑ без 🏆: краще, ніж минулого разу, але не рекорд', () => {
    const { deps, advance } = createTestDeps();
    const s1 = startSingleExercise(deps, BENCH).sessionId;
    doSets(deps, advance, s1, BENCH, [[70, 8], [60, 8]]);
    finishSession(deps, s1);
    advance(DAY);

    const s2 = startSingleExercise(deps, BENCH).sessionId;
    doSets(deps, advance, s2, BENCH, [[70, 8], [62.5, 8]]);
    const view = getSessionView(deps, s2)!;

    expect(view.exercises[0].sets.map((s) => s.mark)).toEqual([null, 'up']);
    expect(view.summary).toMatchObject({ records: 0, progressedExercises: 1 });
  });
});

describe('завершення', () => {
  it('невиконані підходи і порожні вправи прибираються, слоти програми лишаються', () => {
    const { deps, advance } = createTestDeps();
    const sessionId = startRoutine(deps, pushRoutine(deps, createFolder(deps, 'PPL')));
    doSets(deps, advance, sessionId, BENCH, [[60, 8]]);
    addExercise(deps, sessionId, PULL_UP);

    finishSession(deps, sessionId);
    const view = getSessionView(deps, sessionId)!;

    expect(view.status).toBe('finished');
    expect(view.exercises.map((e) => e.exerciseId)).toEqual([BENCH, INCLINE, FLY, PUSHDOWN, LATERAL]);
    expect(view.exercises[0].sets).toHaveLength(1);
    expect(view.exercises[1].sets).toHaveLength(0);
  });

  it('сценарій 3 через сервіс: прибрані слоти потрапляють у пропущені', () => {
    const { deps, advance } = createTestDeps();
    const sessionId = startRoutine(deps, pushRoutine(deps, createFolder(deps, 'PPL')));
    for (const [exerciseId, w] of [[BENCH, 60], [INCLINE, 18], [FLY, 40]] as const) {
      doSets(deps, advance, sessionId, exerciseId, [[w, 10]]);
    }
    const view = getSessionView(deps, sessionId)!;
    skipExercise(deps, view.exercises[3].id);
    skipExercise(deps, view.exercises[4].id);
    finishSession(deps, sessionId);

    const backlog = computeBacklog(loadHistorySessions(deps.db), [], deps.now() + HOUR);

    expect(backlog.map((b) => b.exerciseId).sort()).toEqual([PUSHDOWN, LATERAL].sort());
    expect(backlog[0].lastRoutineTitle).toBe('Push');
  });

  it('сценарій 8 через сервіс: слот замінено на альтернативу і виконано → не пропущений, історія на альтернативі', () => {
    const { deps, advance } = createTestDeps();
    const sessionId = startRoutine(deps, pushRoutine(deps, createFolder(deps, 'PPL')));
    const fly = getSessionView(deps, sessionId)!.exercises[2];

    replaceExercise(deps, fly.id, MACHINE_PRESS);
    doSets(deps, advance, sessionId, MACHINE_PRESS, [[50, 12]]);
    finishSession(deps, sessionId);

    const backlog = computeBacklog(loadHistorySessions(deps.db), [], deps.now() + HOUR);
    expect(backlog.map((b) => b.exerciseId)).not.toContain(FLY);
    expect(getSessionView(deps, sessionId)!.exercises[2]).toMatchObject({
      exerciseId: MACHINE_PRESS,
      routineExerciseId: fly.routineExerciseId,
    });
  });

  it('скасоване тренування ігнорується всюди', () => {
    const { deps, advance } = createTestDeps();
    const s1 = startSingleExercise(deps, BENCH).sessionId;
    doSets(deps, advance, s1, BENCH, [[100, 5]]);
    discardSession(deps, s1);

    const s2 = startSingleExercise(deps, BENCH).sessionId;

    expect(getSessionView(deps, s2)!.exercises[0].last).toBeNull();
  });

  it('сценарій 17: апку вбито посеред тренування → при запуску пропозиція продовжити, підходи на місці', () => {
    const { deps, advance } = createTestDeps();
    const sessionId = startRoutine(deps, pushRoutine(deps, createFolder(deps, 'PPL')));
    doSets(deps, advance, sessionId, BENCH, [[60, 8], [60, 8]]);
    const lastSetAt = deps.now();

    // «Новий запуск»: свіжий набір залежностей над тією ж базою, без жодного стану в пам'яті.
    const relaunched: Deps = { db: deps.db, now: deps.now, newId: () => `after-${Math.random()}` };
    const state = getActiveSessionState(relaunched);

    expect(state).toMatchObject({ sessionId, title: 'Push', staleFinishAt: null });
    const bench = getSessionView(relaunched, sessionId)!.exercises[0];
    expect(bench.sets.filter((s) => s.completed).map((s) => [s.weightKg, s.reps])).toEqual([
      [60, 8],
      [60, 8],
    ]);

    // Через 7 годин — пропозиція завершити часом останнього виконаного підходу.
    advance(7 * HOUR);
    const stale = getActiveSessionState(relaunched)!;
    expect(stale.staleFinishAt).toBe(lastSetAt);
    finishSession(relaunched, sessionId, stale.staleFinishAt!);
    expect(getSessionView(relaunched, sessionId)!.finishedAt).toBe(lastSetAt);
  });
});
