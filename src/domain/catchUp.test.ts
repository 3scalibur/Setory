import { day, finishedOn, journal, set, type FxExercise } from './__fixtures__/journal';
import { computeBacklog } from './backlog';
import {
  estimateExerciseSec,
  estimateMinutes,
  fitRoutineToBudget,
  medianSetIntervalSec,
  muscleLastTrained,
  suggestCatchUp,
  type CatchUpCandidate,
  type RoutineSlotEstimate,
} from './catchUp';
import { DAY_MS, HOUR_MS } from './sets';
import type { Mechanic, MuscleGroup } from './types';

const NOW = day(30);

function candidate(
  exerciseId: string,
  mechanic: Mechanic,
  primaryMuscles: MuscleGroup[],
  extra: Partial<CatchUpCandidate> = {},
): CatchUpCandidate {
  return {
    exerciseId,
    mechanic,
    primaryMuscles,
    missCount: 1,
    firstMissedAt: day(20),
    estimatedSec: estimateExerciseSec({ setCount: mechanic === 'compound' ? 4 : 3, mechanic }),
    ...extra,
  };
}

describe('оцінка часу', () => {
  it('без історії: підходи × (40 с + відпочинок) + 60 с підготовки', () => {
    expect(estimateExerciseSec({ setCount: 4, mechanic: 'compound' })).toBe(4 * (40 + 150) + 60);
    expect(estimateExerciseSec({ setCount: 3, mechanic: 'isolation' })).toBe(3 * (40 + 90) + 60);
    expect(estimateExerciseSec({ setCount: 3, mechanic: 'isolation', restSec: 60 })).toBe(3 * (40 + 60) + 60);
  });

  it('з історією: медіана інтервалу між сусідніми підходами замість «підхід + відпочинок»', () => {
    expect(estimateExerciseSec({ setCount: 4, mechanic: 'compound', medianIntervalSec: 180 })).toBe(4 * 180 + 60);
  });

  it('медіана рахується лише між підходами одного блоку вправи', () => {
    const { sets } = journal([
      { source: 'free', day: 0, exercises: [{ exerciseId: 'bench', sets: [set(60, 8), set(60, 8), set(60, 8)] }] },
      { source: 'free', day: 3, exercises: [{ exerciseId: 'bench', sets: [set(60, 8), set(60, 8)] }] },
    ]);

    // У фікстурі підходи йдуть кожні 150 с; між сесіями інтервал не рахується.
    expect(medianSetIntervalSec(sets)).toBe(150);
    expect(medianSetIntervalSec(sets.slice(0, 1))).toBeUndefined();
  });

  it('хвилини округлюються вгору', () => {
    expect(estimateMinutes(61)).toBe(2);
    expect(estimateMinutes(3600)).toBe(60);
  });
});

describe('muscleLastTrained', () => {
  it('для кожного м’яза — коли востаннє виконували будь-яку вправу на нього', () => {
    const { sessions } = journal([
      { source: 'free', day: 0, exercises: [{ exerciseId: 'squat', sets: [set(80, 8)] }] },
      { source: 'free', day: 5, exercises: [{ exerciseId: 'legpress', sets: [set(120, 10)] }, { exerciseId: 'curl' }] },
    ]);
    const muscles: Record<string, MuscleGroup[]> = {
      squat: ['quads', 'glutes'],
      legpress: ['quads'],
      curl: ['biceps'],
    };

    const last = muscleLastTrained(sessions, (id) => muscles[id]);

    expect(last.get('quads')).toBe(finishedOn(5));
    expect(last.get('glutes')).toBe(finishedOn(0));
    expect(last.has('biceps')).toBe(false);
  });
});

describe('suggestCatchUp', () => {
  const eight = [
    candidate('squat', 'compound', ['quads', 'glutes']),
    candidate('legpress', 'compound', ['quads', 'glutes']),
    candidate('hack', 'compound', ['quads']),
    candidate('rdl', 'compound', ['hamstrings', 'glutes']),
    candidate('row', 'compound', ['upper_back', 'lats']),
    candidate('lateral', 'isolation', ['side_delts']),
    candidate('curl', 'isolation', ['biceps']),
    candidate('calf', 'isolation', ['calves']),
  ];

  it('сценарій 15: 8 пропущених, бюджет 60 хв → ≤ 60 хв, ≤ 2 вправи на м’яз, базові перед ізоляцією, той самий результат', () => {
    const plan = suggestCatchUp(eight, new Map(), { timeBudgetMin: 60, now: NOW });

    expect(plan.totalSec).toBeLessThanOrEqual(60 * 60);
    expect(plan.totalSec).toBe(plan.items.reduce((sum, i) => sum + i.estimatedSec, 0));

    const perMuscle = new Map<string, number>();
    for (const item of plan.items) {
      for (const m of eight.find((c) => c.exerciseId === item.exerciseId)!.primaryMuscles) {
        perMuscle.set(m, (perMuscle.get(m) ?? 0) + 1);
      }
    }
    expect(Math.max(...perMuscle.values())).toBeLessThanOrEqual(2);

    const mechanics = plan.items.map((i) => eight.find((c) => c.exerciseId === i.exerciseId)!.mechanic);
    expect(mechanics.indexOf('isolation')).toBeGreaterThan(mechanics.lastIndexOf('compound'));

    expect(suggestCatchUp(eight, new Map(), { timeBudgetMin: 60, now: NOW })).toEqual(plan);
    expect(suggestCatchUp([...eight].reverse(), new Map(), { timeBudgetMin: 60, now: NOW })).toEqual(plan);
  });

  it('у сесії: базові від великих м’язів до малих, потім ізоляція', () => {
    const five = [
      candidate('curl', 'isolation', ['biceps']),
      candidate('row', 'compound', ['upper_back', 'lats']),
      candidate('calf', 'isolation', ['calves']),
      candidate('squat', 'compound', ['quads', 'glutes']),
      candidate('lateral', 'isolation', ['side_delts']),
    ];

    const plan = suggestCatchUp(five, new Map(), { timeBudgetMin: 120, now: NOW });

    expect(plan.items.map((i) => i.exerciseId)).toEqual(['squat', 'row', 'lateral', 'curl', 'calf']);
  });

  it('першим іде м’яз, який довше не тренувався; при рівності — частіше пропущена', () => {
    const lastTrained = new Map<MuscleGroup, number>([
      ['biceps', NOW - 10 * DAY_MS],
      ['side_delts', NOW - 3 * DAY_MS],
      ['calves', NOW - 3 * DAY_MS],
    ]);
    const options = [
      candidate('lateral', 'isolation', ['side_delts'], { missCount: 1 }),
      candidate('calf', 'isolation', ['calves'], { missCount: 3 }),
      candidate('curl', 'isolation', ['biceps']),
    ];
    const oneSlot = Math.ceil(options[0].estimatedSec / 60);

    expect(suggestCatchUp(options, lastTrained, { timeBudgetMin: oneSlot, now: NOW }).items[0].exerciseId).toBe('curl');
    const twoSlots = suggestCatchUp(options, lastTrained, { timeBudgetMin: oneSlot * 2, now: NOW });
    expect(twoSlots.items.map((i) => i.exerciseId).sort()).toEqual(['calf', 'curl']);
  });

  it('м’яз тренувався менше 48 год тому → вправа в кінці черги, але не викидається', () => {
    const lastTrained = new Map<MuscleGroup, number>([['biceps', NOW - 24 * HOUR_MS]]);
    const options = [
      candidate('curl', 'isolation', ['biceps'], { missCount: 5, firstMissedAt: day(1) }),
      candidate('lateral', 'isolation', ['side_delts'], { firstMissedAt: day(25) }),
    ];
    const oneSlot = Math.ceil(options[0].estimatedSec / 60);

    expect(suggestCatchUp(options, lastTrained, { timeBudgetMin: oneSlot, now: NOW }).items.map((i) => i.exerciseId)).toEqual([
      'lateral',
    ]);
    expect(suggestCatchUp(options, lastTrained, { timeBudgetMin: 60, now: NOW }).items).toHaveLength(2);
  });

  it('якщо чергова не вміщається — пробуємо наступні, коротші', () => {
    const options = [
      candidate('squat', 'compound', ['quads'], { estimatedSec: 20 * 60, missCount: 3 }),
      candidate('curl', 'isolation', ['biceps'], { estimatedSec: 8 * 60 }),
    ];

    expect(suggestCatchUp(options, new Map(), { timeBudgetMin: 10, now: NOW }).items.map((i) => i.exerciseId)).toEqual([
      'curl',
    ]);
  });

  it('обмеження кількості — для «додати 1–2 вправи з пропущених»', () => {
    expect(suggestCatchUp(eight, new Map(), { timeBudgetMin: 60, now: NOW, maxItems: 2 }).items).toHaveLength(2);
  });

  it('пропущених немає — порожня пропозиція', () => {
    expect(suggestCatchUp([], new Map(), { timeBudgetMin: 60, now: NOW })).toEqual({ items: [], totalSec: 0 });
  });
});

describe('fitRoutineToBudget', () => {
  const slot = (id: string, mechanic: Mechanic, minutes: number, inBacklog = false): RoutineSlotEstimate => ({
    routineExerciseId: `slot-${id}`,
    exerciseId: id,
    mechanic,
    estimatedSec: minutes * 60,
    inBacklog,
  });
  const day80 = [
    slot('bench', 'compound', 18),
    slot('incline', 'compound', 16),
    slot('fly', 'isolation', 12),
    slot('dip', 'compound', 14),
    slot('pushdown', 'isolation', 10, true),
    slot('lateral', 'isolation', 10),
  ];

  it('день вміщається — нічого не позначено', () => {
    expect(fitRoutineToBudget(day80, 90).slots.every((s) => s.fits)).toBe(true);
  });

  it('сценарій 16: день на 80 хв, бюджет 60 → частина «не встигну»; після тренування без них вони в пропущених', () => {
    const plan = fitRoutineToBudget(day80, 60);
    const skipped = plan.slots.filter((s) => !s.fits).map((s) => s.exerciseId);

    expect(plan.plannedSec).toBeLessThanOrEqual(60 * 60);
    expect(skipped).toEqual(['fly', 'lateral']);
    // Порядок вправ у програмі зберігається.
    expect(plan.slots.map((s) => s.exerciseId)).toEqual(day80.map((s) => s.exerciseId));

    const exercises: FxExercise[] = plan.slots.map((s) =>
      s.fits
        ? { exerciseId: s.exerciseId, slot: s.routineExerciseId, sets: [set(50, 10)] }
        : { exerciseId: s.exerciseId, slot: s.routineExerciseId, skipped: true },
    );
    const { sessions } = journal([{ source: 'routine', title: 'Push', day: 0, exercises }]);
    expect(computeBacklog(sessions, [], day(1)).map((b) => b.exerciseId).sort()).toEqual(['fly', 'lateral']);
  });

  it('базові й ті, що вже в пропущених, мають перевагу', () => {
    const plan = fitRoutineToBudget(day80, 60);

    expect(plan.slots.find((s) => s.exerciseId === 'pushdown')?.fits).toBe(true);
  });

  it('залишок часу — щоб запропонувати 1–2 вправи з пропущених', () => {
    const plan = fitRoutineToBudget(day80, 60);

    expect(plan.leftoverSec).toBe(60 * 60 - plan.plannedSec);
  });
});
