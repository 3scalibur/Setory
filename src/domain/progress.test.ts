import { journal, set, target, targets } from './__fixtures__/journal';
import { buildPrefill, lastPerformance } from './performance';
import { compareWithPrevious, setMark, summarizeSession } from './progress';
import type { PerformedSet } from './types';

const w = (weightKg: number, reps: number, kind: PerformedSet['kind'] = 'working'): PerformedSet => ({
  kind,
  weightKg,
  reps,
});

describe('compareWithPrevious', () => {
  it('сценарій 20: «Попереднє» 60×8 → 60×9 ↑, 62.5×8 ↑, 62.5×6 нічого, 60×8 нічого', () => {
    const previous = w(60, 8);

    expect(compareWithPrevious(w(60, 9), previous, 'weight_reps')).toBe('up');
    expect(compareWithPrevious(w(62.5, 8), previous, 'weight_reps')).toBe('up');
    expect(compareWithPrevious(w(62.5, 6), previous, 'weight_reps')).toBeNull();
    expect(compareWithPrevious(w(60, 8), previous, 'weight_reps')).toBeNull();
  });

  it('сценарій 21: минулого разу 3 робочі, сьогодні 4 → у 4-го підходу ↑ немає', () => {
    const { sets } = journal([
      { source: 'free', day: 0, exercises: [{ exerciseId: 'bench', sets: [set(60, 8), set(60, 8), set(60, 8)] }] },
    ]);
    const plan = targets(target(60, 8), target(60, 8), target(60, 8), target(60, 8));
    const prefill = buildPrefill({ last: lastPerformance('bench', sets), targets: plan, setCountSource: 'template' });
    const today = w(65, 8);

    expect(compareWithPrevious(today, prefill[2].previous, 'weight_reps')).toBe('up');
    expect(compareWithPrevious(today, prefill[3].previous, 'weight_reps')).toBeNull();
  });

  it('гірше за минулий раз — нічого', () => {
    expect(compareWithPrevious(w(57.5, 8), w(60, 8), 'weight_reps')).toBeNull();
  });

  it('розминка не порівнюється', () => {
    expect(compareWithPrevious(w(40, 12, 'warmup'), w(30, 12, 'warmup'), 'weight_reps')).toBeNull();
  });

  it('дроп і до відмови порівнюються як робочі', () => {
    expect(compareWithPrevious(w(40, 13, 'drop'), w(40, 12, 'drop'), 'weight_reps')).toBe('up');
  });

  it('дробові ваги не дають хибного ↑', () => {
    expect(compareWithPrevious(w(0.1 + 0.2, 8), w(0.3, 8), 'weight_reps')).toBeNull();
  });

  it('вага з обтяженням — як вагові', () => {
    expect(compareWithPrevious(w(10, 6), w(7.5, 6), 'weighted_bodyweight')).toBe('up');
  });

  it('власна вага: лише більше повторів', () => {
    expect(compareWithPrevious({ kind: 'working', reps: 11 }, { kind: 'working', reps: 10 }, 'bodyweight_reps')).toBe(
      'up',
    );
    expect(compareWithPrevious({ kind: 'working', reps: 10 }, { kind: 'working', reps: 10 }, 'bodyweight_reps')).toBeNull();
  });

  it('гравітрон: менша допомога при тих же повторах — ↑; більша допомога — ні', () => {
    expect(compareWithPrevious(w(20, 8), w(25, 8), 'assisted_bodyweight')).toBe('up');
    expect(compareWithPrevious(w(25, 9), w(25, 8), 'assisted_bodyweight')).toBe('up');
    expect(compareWithPrevious(w(30, 12), w(25, 8), 'assisted_bodyweight')).toBeNull();
  });

  it('час: довше — ↑', () => {
    expect(compareWithPrevious({ kind: 'working', durationSec: 75 }, { kind: 'working', durationSec: 60 }, 'duration')).toBe(
      'up',
    );
  });

  it('кардіо: більше метрів не повільніше, або та сама дистанція швидше', () => {
    const prev = { kind: 'working' as const, distanceM: 2000, durationSec: 600 };

    expect(compareWithPrevious({ kind: 'working', distanceM: 2200, durationSec: 600 }, prev, 'distance_duration')).toBe('up');
    expect(compareWithPrevious({ kind: 'working', distanceM: 2000, durationSec: 580 }, prev, 'distance_duration')).toBe('up');
    expect(compareWithPrevious({ kind: 'working', distanceM: 2200, durationSec: 700 }, prev, 'distance_duration')).toBeNull();
  });

  it('незаповнені цифри — нічого', () => {
    expect(compareWithPrevious({ kind: 'working', reps: 9 }, w(60, 8), 'weight_reps')).toBeNull();
  });
});

describe('позначки і підсумок', () => {
  it('якщо підхід дає і 🏆, і ↑ — показуємо лише 🏆', () => {
    expect(setMark(['max_weight'], 'up')).toBe('pr');
    expect(setMark([], 'up')).toBe('up');
    expect(setMark([], null)).toBeNull();
  });

  it('підсумок: «Рекорди: N · Прогрес у M вправах»', () => {
    const summary = summarizeSession([
      { exerciseId: 'bench', marks: ['pr', 'pr', null] },
      { exerciseId: 'row', marks: [null, 'up'] },
      { exerciseId: 'curl', marks: [null, null] },
    ]);

    expect(summary).toEqual({ records: 2, progressedExercises: 2 });
  });
});
