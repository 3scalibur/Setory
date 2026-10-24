/**
 * @jest-environment node
 */
import { dismissFromBacklog, getBacklog, getCatchUpPlan, getRoutineBudgetPlan } from './backlogService';
import { folderForNewRoutine } from './folderService';
import { getWorkoutTab, saveRoutine } from './routineService';
import { finishSession, skipExercise, startCatchUp, startRoutine, startSingleExercise } from './sessionService';
import { getSessionView } from './sessionView';
import { createTestDeps, DAY, ex, HOUR } from './test-deps';
import { doSets, finishWith } from './test-helpers';
import type { Deps } from './deps';

const BENCH = ex('bench press');
const SQUAT = ex('squat (barbell)');
const LEG_PRESS = ex('leg press (machine)');
const ROW = ex('bent over row (barbell)');
const CURL = ex('bicep curl (dumbbell)');
const LATERAL = ex('lateral raise (dumbbell)');
const CALF = ex('standing calf raise (smith)');
const SHRUG = ex('shrug (barbell)');

const set = (repsMin: number, weightKg?: number) => ({ kind: 'working' as const, repsMin, weightKg });

/** Програма, де кожна вправа має 3 робочі підходи. */
function bigRoutine(deps: Deps, ids: string[]) {
  return saveRoutine(deps, {
    folderId: folderForNewRoutine(deps),
    name: 'Повне тіло',
    exercises: ids.map((exerciseId) => ({ exerciseId, sets: [set(10), set(10), set(10)] })),
  });
}

/** Запустити програму, зробити лише `done`, решту прибрати, завершити. */
function skipAllBut(deps: Deps, advance: (ms: number) => void, routineId: string, done: string[]) {
  const sessionId = startRoutine(deps, routineId);
  for (const e of getSessionView(deps, sessionId)!.exercises) {
    if (done.includes(e.exerciseId)) doSets(deps, advance, sessionId, e.exerciseId, [[40, 10]]);
    else skipExercise(deps, e.id);
  }
  finishSession(deps, sessionId);
}

describe('пропущені', () => {
  it('список з назвами, «прибрати» ховає вправу', () => {
    const { deps, advance } = createTestDeps();
    const id = bigRoutine(deps, [BENCH, CURL, LATERAL]);
    skipAllBut(deps, advance, id, [BENCH]);

    expect(getBacklog(deps).map((b) => [b.name, b.missCount, b.lastRoutineTitle])).toEqual(
      expect.arrayContaining([
        ['Згинання рук з гантелями (біцепс)', 1, 'Повне тіло'],
        ['Махи гантелями в сторони', 1, 'Повне тіло'],
      ]),
    );

    dismissFromBacklog(deps, [CURL]);
    expect(getBacklog(deps).map((b) => b.exerciseId)).toEqual([LATERAL]);
  });

  it('окрема вправа закриває пропуск; лічильник на вкладці «Тренування»', () => {
    const { deps, advance } = createTestDeps();
    const id = bigRoutine(deps, [BENCH, CURL, LATERAL]);
    skipAllBut(deps, advance, id, [BENCH]);
    advance(HOUR);

    finishWith(deps, advance, startSingleExercise(deps, CURL).sessionId, { [CURL]: [[12, 10]] });

    expect(getBacklog(deps).map((b) => b.exerciseId)).toEqual([LATERAL]);
    expect(getWorkoutTab(deps).backlogCount).toBe(1);
  });

  it('пропуски старші за 14 днів зникають', () => {
    const { deps, advance } = createTestDeps();
    skipAllBut(deps, advance, bigRoutine(deps, [BENCH, CURL]), [BENCH]);

    advance(15 * DAY);

    expect(getBacklog(deps)).toEqual([]);
  });
});

describe('день пропущених', () => {
  it('сценарій 15 через сервіс: ≤ бюджету, ≤ 2 вправи на м’яз, базові перед ізоляцією; з 4+ пропущених — підказка на вкладці', () => {
    const { deps, advance } = createTestDeps();
    const id = bigRoutine(deps, [BENCH, SQUAT, LEG_PRESS, ROW, CURL, LATERAL, CALF, SHRUG]);
    skipAllBut(deps, advance, id, [BENCH]);
    advance(DAY);

    const plan = getCatchUpPlan(deps, 30);

    expect(plan.backlogCount).toBe(7);
    expect(plan.totalSec).toBeLessThanOrEqual(30 * 60);
    expect(plan.items.length).toBeGreaterThan(0);
    // Цілі беруться зі слоту, який був пропущений.
    expect(plan.items[0].targets).toHaveLength(3);
    expect(getWorkoutTab(deps).catchUp).not.toBeNull();

    const sessionId = startCatchUp(deps, plan.items);
    const view = getSessionView(deps, sessionId)!;
    expect(view.source).toBe('catch_up');
    expect(view.exercises.map((e) => e.exerciseId)).toEqual(plan.items.map((i) => i.exerciseId));
  });

  it('менше 4 пропущених — підказки немає', () => {
    const { deps, advance } = createTestDeps();
    skipAllBut(deps, advance, bigRoutine(deps, [BENCH, CURL, LATERAL]), [BENCH]);

    expect(getWorkoutTab(deps).catchUp).toBeNull();
  });
});

describe('«маю N хвилин» для програми', () => {
  it('частина вправ «не встигну», залишок часу — на 1–2 вправи з пропущених', () => {
    const { deps, advance } = createTestDeps();
    // Спершу створюємо пропущені: біцепс і махи.
    skipAllBut(deps, advance, bigRoutine(deps, [BENCH, CURL, LATERAL]), [BENCH]);
    advance(DAY);
    const legs = saveRoutine(deps, {
      folderId: folderForNewRoutine(deps),
      name: 'Legs',
      exercises: [SQUAT, LEG_PRESS, CALF].map((exerciseId) => ({ exerciseId, sets: [set(8), set(8), set(8), set(8)] })),
    });

    const tight = getRoutineBudgetPlan(deps, legs, 25);
    expect(tight.fullSec).toBeGreaterThan(25 * 60);
    expect(tight.plannedSec).toBeLessThanOrEqual(25 * 60);
    expect(tight.slots.some((s) => !s.fits)).toBe(true);
    expect(tight.slots.map((s) => s.name)).toEqual(['Присідання зі штангою', 'Жим ногами в тренажері', 'Підйом на носки стоячи в Сміті']);

    const roomy = getRoutineBudgetPlan(deps, legs, 90);
    expect(roomy.slots.every((s) => s.fits)).toBe(true);
    expect(roomy.suggestions.length).toBeGreaterThan(0);
    expect(roomy.suggestions.length).toBeLessThanOrEqual(2);

    // «Не встигну» → стартуємо без них → після завершення вони в пропущених.
    const skip = tight.slots.filter((s) => !s.fits).map((s) => s.routineExerciseId);
    const sessionId = startRoutine(deps, legs, { skipRoutineExerciseIds: skip });
    const view = getSessionView(deps, sessionId)!;
    for (const e of view.exercises.filter((x) => !x.skipped)) doSets(deps, advance, sessionId, e.exerciseId, [[60, 8]]);
    finishSession(deps, sessionId);
    const skippedIds = tight.slots.filter((s) => !s.fits).map((s) => s.exerciseId);
    expect(getBacklog(deps).map((b) => b.exerciseId)).toEqual(expect.arrayContaining(skippedIds));
  });
});
