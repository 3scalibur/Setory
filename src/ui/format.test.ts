import { daysAgo, formatSet, formatTarget, parseNumber, parseRepRange, plural } from './format';

describe('форматування', () => {
  it('підхід за типом вправи', () => {
    expect(formatSet({ weightKg: 62.5, reps: 8 }, 'weight_reps')).toBe('62.5 × 8');
    expect(formatSet({ reps: 12 }, 'bodyweight_reps')).toBe('12 повт.');
    expect(formatSet({ weightKg: 20, reps: 8 }, 'assisted_bodyweight')).toBe('−20 × 8');
    expect(formatSet({ durationSec: 90 }, 'duration')).toBe('1:30');
    expect(formatSet({ distanceM: 2000, durationSec: 600 }, 'distance_duration')).toBe('2000 м · 10:00');
  });

  it('ціль з програми', () => {
    const row = (repsMin: number, repsMax: number) => ({ position: 0, kind: 'working' as const, repsMin, repsMax });
    expect(formatTarget([row(8, 10), row(8, 10), row(8, 10)])).toBe('ціль: 3 × 8–10');
    expect(formatTarget([row(10, 10), row(8, 8), row(6, 6)])).toBe('ціль: 10, 8, 6');
    expect(formatTarget([])).toBeNull();
  });

  it('введення чисел і діапазонів', () => {
    expect(parseNumber('62,5')).toBe(62.5);
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('abc')).toBeUndefined();
    expect(parseRepRange('8–10')).toEqual({ repsMin: 8, repsMax: 10 });
    expect(parseRepRange('12')).toEqual({ repsMin: 12, repsMax: 12 });
    expect(parseRepRange('8 - 10')).toEqual({ repsMin: 8, repsMax: 10 });
    expect(parseRepRange('вісім')).toBeUndefined();
  });

  it('українські відмінки і «днів тому»', () => {
    expect([1, 2, 5, 11, 21, 22, 25].map((n) => plural(n, 'день', 'дні', 'днів'))).toEqual([
      'день',
      'дні',
      'днів',
      'днів',
      'день',
      'дні',
      'днів',
    ]);
    const now = Date.UTC(2026, 9, 10, 12);
    expect(daysAgo(now - 3 * 86_400_000, now)).toBe('3 дні тому');
    expect(daysAgo(now - 86_400_000, now)).toBe('вчора');
  });
});
