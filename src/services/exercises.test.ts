/**
 * @jest-environment node
 */
import { UserError } from './deps';
import {
  createCustomExercise,
  findSimilarExercises,
  getExerciseCard,
  removeCustomExercise,
  searchCatalog,
  updateCustomExercise,
  type CustomExerciseInput,
} from './exerciseService';
import { getHistoryList } from './historyService';
import { deleteSession, startSingleExercise } from './sessionService';
import { createTestDeps, DAY, ex } from './test-deps';
import { finishWith } from './test-helpers';

const BENCH = ex('bench press');
const DB_BENCH = ex('bench press (dumbbell)');
const LATERAL = ex('lateral raise (dumbbell)');

const neckHarness: CustomExerciseInput = {
  name: 'Шия з упряжжю',
  type: 'weight_reps',
  primaryMuscles: ['neck'],
  equipment: 'other',
  mechanic: 'isolation',
  aliases: ['neck harness'],
};

describe('пошук', () => {
  it('недавні й часті вище при рівності', () => {
    const { deps, advance } = createTestDeps();
    finishWith(deps, advance, startSingleExercise(deps, DB_BENCH).sessionId, { [DB_BENCH]: [[24, 10]] });

    expect(searchCatalog(deps, 'bench press')[0].id).toBe(DB_BENCH);
    expect(searchCatalog(deps, '')[0].id).toBe(DB_BENCH);
  });

  it('фільтр за м’язом', () => {
    const { deps } = createTestDeps();

    const necks = searchCatalog(deps, '', { muscle: 'neck' });

    expect(necks.length).toBeGreaterThanOrEqual(2);
    expect(necks.every((e) => e.primaryMuscles.includes('neck'))).toBe(true);
  });
});

describe('власні вправи', () => {
  it('створити і знайти за синонімом', () => {
    const { deps } = createTestDeps();
    const id = createCustomExercise(deps, neckHarness);

    expect(searchCatalog(deps, 'neck harness')[0].id).toBe(id);
  });

  it('попередження про дуже схожу назву', () => {
    const { deps } = createTestDeps();

    expect(findSimilarExercises(deps, 'Жим штанги лежачі').map((e) => e.id)).toEqual([BENCH]);
    expect(findSimilarExercises(deps, 'Шия з упряжжю')).toEqual([]);
  });

  it('потрібні назва й основний м’яз', () => {
    const { deps } = createTestDeps();

    expect(() => createCustomExercise(deps, { ...neckHarness, name: ' ' })).toThrow(UserError);
    expect(() => createCustomExercise(deps, { ...neckHarness, primaryMuscles: [] })).toThrow(UserError);
  });

  it('тип не можна змінити, якщо є історія; інше — можна', () => {
    const { deps, advance } = createTestDeps();
    const id = createCustomExercise(deps, neckHarness);
    finishWith(deps, advance, startSingleExercise(deps, id).sessionId, { [id]: [[10, 15]] });

    expect(() => updateCustomExercise(deps, id, { ...neckHarness, type: 'duration' })).toThrow(
      'Тип вправи не можна змінити: у неї вже є історія.',
    );
    updateCustomExercise(deps, id, { ...neckHarness, name: 'Шия (упряж)' });
    expect(getExerciseCard(deps, id)!.exercise.name).toBe('Шия (упряж)');
  });

  it('видалення вправи з історією = архівація: історія лишається, у пошуку її немає', () => {
    const { deps, advance } = createTestDeps();
    const used = createCustomExercise(deps, neckHarness);
    const unused = createCustomExercise(deps, { ...neckHarness, name: 'Ще одна', aliases: [] });
    finishWith(deps, advance, startSingleExercise(deps, used).sessionId, { [used]: [[10, 15]] });

    expect(removeCustomExercise(deps, used)).toBe('archived');
    expect(removeCustomExercise(deps, unused)).toBe('deleted');
    expect(searchCatalog(deps, 'neck harness')).toEqual([]);
    expect(getExerciseCard(deps, used)!.history).toHaveLength(1);
    expect(getExerciseCard(deps, unused)).toBeNull();
  });

  it('вбудовані вправи змінювати не можна', () => {
    const { deps } = createTestDeps();

    expect(() => removeCustomExercise(deps, BENCH)).toThrow('Вбудовані вправи змінювати не можна.');
  });
});

describe('картка вправи й історія', () => {
  it('поточні рекорди, історія з джерелом і 🏆 на свій момент', () => {
    const { deps, advance } = createTestDeps();
    finishWith(deps, advance, startSingleExercise(deps, BENCH).sessionId, { [BENCH]: [[60, 8]] });
    advance(DAY);
    finishWith(deps, advance, startSingleExercise(deps, BENCH).sessionId, { [BENCH]: [[65, 6], [60, 10]] });

    const card = getExerciseCard(deps, BENCH)!;

    expect(card.bests).toMatchObject({ max_weight: 65, max_volume: 600 });
    expect(card.history).toHaveLength(2);
    expect(card.history[0].sets.map((s) => s.prs.length > 0)).toEqual([true, true]);
    expect(card.history[1].sets[0].prs).toEqual([]);
    expect(card.history[0].source).toBe('single_exercise');
  });

  it('видалення тренування з історії перераховує рекорди', () => {
    const { deps, advance } = createTestDeps();
    finishWith(deps, advance, startSingleExercise(deps, BENCH).sessionId, { [BENCH]: [[60, 8]] });
    advance(DAY);
    const big = startSingleExercise(deps, BENCH).sessionId;
    finishWith(deps, advance, big, { [BENCH]: [[70, 8]] });

    deleteSession(deps, big);

    expect(getExerciseCard(deps, BENCH)!.bests.max_weight).toBe(60);
  });

  it('вкладка «Історія»: нові зверху, лише виконані вправи', () => {
    const { deps, advance } = createTestDeps();
    finishWith(deps, advance, startSingleExercise(deps, BENCH).sessionId, { [BENCH]: [[60, 8], [60, 8]] });
    advance(DAY);
    finishWith(deps, advance, startSingleExercise(deps, LATERAL).sessionId, { [LATERAL]: [[8, 15]] });

    const list = getHistoryList(deps);

    expect(list.map((s) => s.exercises)).toEqual([
      [{ name: 'Махи гантелями в сторони', workingSets: 1 }],
      [{ name: 'Жим штанги лежачи', workingSets: 2 }],
    ]);
    expect(list[0].finishedAt).toBeGreaterThan(list[0].startedAt);
  });
});
