import { journal, set, target, targets, warm } from './__fixtures__/journal';
import { buildPrefill, lastPerformance, previousForSets } from './performance';

const BENCH = 'bench';
const ROW = 'row';

describe('lastPerformance', () => {
  it('бере найсвіжішу завершену сесію будь-якого джерела, де є робочий підхід', () => {
    const { sets } = journal([
      { source: 'routine', title: 'Push', day: 0, exercises: [{ exerciseId: BENCH, sets: [set(55, 10)] }] },
      { source: 'single_exercise', day: 2, exercises: [{ exerciseId: BENCH, sets: [set(60, 8)] }] },
      { source: 'routine', title: 'Pull', day: 3, exercises: [{ exerciseId: ROW, sets: [set(50, 10)] }] },
    ]);

    const last = lastPerformance(BENCH, sets);

    expect(last).toMatchObject({ source: 'single_exercise', sessionTitle: 'Окрема вправа' });
    expect(last?.working).toEqual([{ kind: 'working', weightKg: 60, reps: 8 }]);
  });

  it('пропускає сесію, де вправу зробили лише розминкою', () => {
    const { sets } = journal([
      { source: 'routine', title: 'Push', day: 0, exercises: [{ exerciseId: BENCH, sets: [set(55, 10)] }] },
      { source: 'free', day: 1, exercises: [{ exerciseId: BENCH, sets: [warm(20, 10)] }] },
    ]);

    expect(lastPerformance(BENCH, sets)?.sessionTitle).toBe('Push');
  });

  it('повертає null, якщо вправу ще не виконували', () => {
    expect(lastPerformance(BENCH, [])).toBeNull();
  });

  it('якщо вправа двічі в одній сесії — обидва блоки підряд', () => {
    const { sets } = journal([
      {
        source: 'free',
        day: 0,
        exercises: [
          { exerciseId: BENCH, sets: [set(60, 8)] },
          { exerciseId: ROW, sets: [set(50, 10)] },
          { exerciseId: BENCH, sets: [set(50, 12)] },
        ],
      },
    ]);

    expect(lastPerformance(BENCH, sets)?.working.map((s) => s.weightKg)).toEqual([60, 50]);
  });
});

describe('buildPrefill', () => {
  const pushTargets = targets(target(undefined, 8, 10), target(undefined, 8, 10), target(undefined, 8, 10));

  it('сценарій 1: окремо 4×8 по 60 → у Push 4 підходи 60×8, «Попереднє» 60×8, «минулого разу: окремо»', () => {
    const { sets } = journal([
      {
        source: 'single_exercise',
        day: 0,
        exercises: [{ exerciseId: BENCH, sets: [set(60, 8), set(60, 8), set(60, 8), set(60, 8)] }],
      },
    ]);
    const last = lastPerformance(BENCH, sets);

    const prefill = buildPrefill({ last, targets: pushTargets, setCountSource: 'last' });

    expect(last?.source).toBe('single_exercise');
    expect(prefill).toHaveLength(4);
    for (const p of prefill) {
      expect(p).toMatchObject({ kind: 'working', weightKg: 60, reps: 8, previous: { weightKg: 60, reps: 8 } });
    }
  });

  it('сценарій 2: у Push 3×10 по 55 → окремий запуск підставляє 3×10 по 55', () => {
    const { sets } = journal([
      {
        source: 'routine',
        title: 'Push',
        day: 0,
        exercises: [{ exerciseId: BENCH, slot: 'slot-bench', sets: [set(55, 10), set(55, 10), set(55, 10)] }],
      },
    ]);

    const prefill = buildPrefill({ last: lastPerformance(BENCH, sets), setCountSource: 'last' });

    expect(prefill.map((p) => [p.weightKg, p.reps])).toEqual([
      [55, 10],
      [55, 10],
      [55, 10],
    ]);
  });

  it('сценарій 18: програма 60×10, 70×8, 80×6, історії немає → рівно ці 3 підходи', () => {
    const plan = targets(target(60, 10), target(70, 8), target(80, 6));

    const prefill = buildPrefill({ last: null, targets: plan, setCountSource: 'last' });

    expect(prefill.map((p) => [p.weightKg, p.reps])).toEqual([
      [60, 10],
      [70, 8],
      [80, 6],
    ]);
    expect(prefill.every((p) => p.previous === undefined)).toBe(true);
  });

  it('сценарій 19: стартові 60/70/80, минулого разу окремо 62.5/72.5/80 → сесія і картка програми показують 62.5/72.5/80', () => {
    const plan = targets(target(60, 10), target(70, 8), target(80, 6));
    const { sets } = journal([
      {
        source: 'single_exercise',
        day: 0,
        exercises: [{ exerciseId: BENCH, sets: [set(62.5, 10), set(72.5, 8), set(80, 6)] }],
      },
    ]);
    const last = lastPerformance(BENCH, sets);

    const inSession = buildPrefill({ last, targets: plan, setCountSource: 'last' });
    const onRoutineCard = buildPrefill({ last, targets: plan, setCountSource: 'template' });

    expect(inSession.map((p) => p.weightKg)).toEqual([62.5, 72.5, 80]);
    expect(onRoutineCard.map((p) => p.weightKg)).toEqual([62.5, 72.5, 80]);
  });

  it('підходів більше, ніж минулого разу: копіюється останній робочий, «Попереднє» — лише для існуючих', () => {
    const { sets } = journal([
      { source: 'free', day: 0, exercises: [{ exerciseId: BENCH, sets: [set(60, 10), set(70, 8), set(80, 6)] }] },
    ]);
    const plan = targets(target(60, 10), target(70, 8), target(80, 6), target(80, 6));

    const prefill = buildPrefill({ last: lastPerformance(BENCH, sets), targets: plan, setCountSource: 'template' });

    expect(prefill.map((p) => [p.weightKg, p.reps])).toEqual([
      [60, 10],
      [70, 8],
      [80, 6],
      [80, 6],
    ]);
    expect(prefill[3].previous).toBeUndefined();
  });

  it('розминка копіюється як минулого разу і йде першою', () => {
    const { sets } = journal([
      {
        source: 'free',
        day: 0,
        exercises: [{ exerciseId: BENCH, sets: [warm(20, 12), warm(40, 6), set(60, 8)] }],
      },
    ]);

    const prefill = buildPrefill({ last: lastPerformance(BENCH, sets), setCountSource: 'last' });

    expect(prefill.map((p) => [p.position, p.kind, p.weightKg])).toEqual([
      [0, 'warmup', 20],
      [1, 'warmup', 40],
      [2, 'working', 60],
    ]);
    expect(prefill[1].previous).toEqual({ kind: 'warmup', weightKg: 40, reps: 6 });
  });

  it('без історії і без програми — 3 порожні робочі підходи', () => {
    const prefill = buildPrefill({ last: null, setCountSource: 'last' });

    expect(prefill).toEqual([
      { position: 0, kind: 'working' },
      { position: 1, kind: 'working' },
      { position: 2, kind: 'working' },
    ]);
  });

  it('без історії: вага з програми порожня → лишається порожньою, повтори — початок діапазону', () => {
    const prefill = buildPrefill({ last: null, targets: pushTargets, setCountSource: 'last' });

    expect(prefill[0]).toEqual({ position: 0, kind: 'working', reps: 8 });
  });

  it('режим template: кількість підходів з програми, навіть коли історія є', () => {
    const { sets } = journal([
      { source: 'free', day: 0, exercises: [{ exerciseId: BENCH, sets: [set(60, 8), set(60, 8), set(60, 8), set(60, 8)] }] },
    ]);

    const prefill = buildPrefill({ last: lastPerformance(BENCH, sets), targets: pushTargets, setCountSource: 'template' });

    expect(prefill).toHaveLength(3);
  });

  it('тип підходу (дроп, до відмови) береться з того ж джерела, що й кількість', () => {
    const { sets } = journal([
      { source: 'free', day: 0, exercises: [{ exerciseId: BENCH, sets: [set(60, 8), set(40, 12, 'drop')] }] },
    ]);
    const plan = targets(target(60, 8), target(60, 8, 8, 'failure'));
    const last = lastPerformance(BENCH, sets);

    expect(buildPrefill({ last, targets: plan, setCountSource: 'last' }).map((p) => p.kind)).toEqual([
      'working',
      'drop',
    ]);
    expect(buildPrefill({ last, targets: plan, setCountSource: 'template' }).map((p) => p.kind)).toEqual([
      'working',
      'failure',
    ]);
  });
});

describe('previousForSets', () => {
  it('«Попереднє» для вже доданих підходів: розминка — до розминки, робочі — за номером серед робочих', () => {
    const { sets } = journal([
      { source: 'free', day: 0, exercises: [{ exerciseId: BENCH, sets: [warm(20, 12), set(60, 8), set(62.5, 6)] }] },
    ]);
    const last = lastPerformance(BENCH, sets);

    const previous = previousForSets(
      [{ kind: 'working' }, { kind: 'warmup' }, { kind: 'drop' }, { kind: 'working' }],
      last,
    );

    expect(previous).toEqual([
      { kind: 'working', weightKg: 60, reps: 8 },
      { kind: 'warmup', weightKg: 20, reps: 12 },
      { kind: 'working', weightKg: 62.5, reps: 6 },
      undefined,
    ]);
  });

  it('без історії — порожньо', () => {
    expect(previousForSets([{ kind: 'working' }], null)).toEqual([undefined]);
  });
});
