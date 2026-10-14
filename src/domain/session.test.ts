import { HOUR_MS, canCompleteSet } from './sets';
import { planFinish, staleSessionFinishAt, type FinishExercise } from './session';

describe('canCompleteSet — не можна позначити виконаним без обов’язкових полів', () => {
  it('вагові: повтори ≥ 1 і вага ≥ 0', () => {
    expect(canCompleteSet({ weightKg: 60, reps: 8 }, 'weight_reps')).toBe(true);
    expect(canCompleteSet({ weightKg: 0, reps: 8 }, 'weight_reps')).toBe(true);
    expect(canCompleteSet({ reps: 8 }, 'weight_reps')).toBe(false);
    expect(canCompleteSet({ weightKg: 60, reps: 0 }, 'weight_reps')).toBe(false);
    expect(canCompleteSet({ weightKg: -5, reps: 8 }, 'weighted_bodyweight')).toBe(false);
    expect(canCompleteSet({ weightKg: 25, reps: 8 }, 'assisted_bodyweight')).toBe(true);
  });

  it('власна вага: лише повтори', () => {
    expect(canCompleteSet({ reps: 12 }, 'bodyweight_reps')).toBe(true);
    expect(canCompleteSet({}, 'bodyweight_reps')).toBe(false);
  });

  it('час > 0; кардіо — дистанція і час', () => {
    expect(canCompleteSet({ durationSec: 60 }, 'duration')).toBe(true);
    expect(canCompleteSet({ durationSec: 0 }, 'duration')).toBe(false);
    expect(canCompleteSet({ distanceM: 2000, durationSec: 600 }, 'distance_duration')).toBe(true);
    expect(canCompleteSet({ distanceM: 2000 }, 'distance_duration')).toBe(false);
  });
});

describe('planFinish — що прибрати при «Завершити»', () => {
  const exercises: FinishExercise[] = [
    {
      id: 'bench',
      sets: [
        { id: 'b1', kind: 'working', completed: true },
        { id: 'b2', kind: 'working', completed: false },
      ],
    },
    // Додали з пошуку, але не зробили жодного робочого — видаляється разом з розминкою.
    {
      id: 'curl',
      sets: [
        { id: 'c1', kind: 'warmup', completed: true },
        { id: 'c2', kind: 'working', completed: false },
      ],
    },
    // Слот програми без виконаних підходів лишається — він потрібен для пропущених.
    { id: 'lateral', routineExerciseId: 'push-lateral', sets: [{ id: 'l1', kind: 'working', completed: false }] },
  ];

  it('невиконані підходи видаляються; вправи без робочих підходів — теж, крім слотів програми', () => {
    const plan = planFinish(exercises);

    expect(plan.deleteSetIds.sort()).toEqual(['b2', 'c1', 'c2', 'l1']);
    expect(plan.deleteExerciseIds).toEqual(['curl']);
  });
});

describe('staleSessionFinishAt — забуте активне тренування', () => {
  const started = Date.UTC(2026, 9, 14, 18);

  it('старше 6 год → завершити часом останнього виконаного підходу', () => {
    const lastSet = started + HOUR_MS;

    expect(staleSessionFinishAt(started, [started + 10_000, lastSet], started + 7 * HOUR_MS)).toBe(lastSet);
  });

  it('жодного виконаного підходу → часом початку', () => {
    expect(staleSessionFinishAt(started, [], started + 7 * HOUR_MS)).toBe(started);
  });

  it('молодше 6 год → нічого не пропонуємо', () => {
    expect(staleSessionFinishAt(started, [started + HOUR_MS], started + 2 * HOUR_MS)).toBeNull();
  });
});
