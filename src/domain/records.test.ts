import { journal, set, warm } from './__fixtures__/journal';
import { evaluateSetPRs, rebuildPRs, type RecordSet } from './records';
import type { PerformedSet } from './types';

const w = (weightKg: number, reps: number, kind: PerformedSet['kind'] = 'working'): PerformedSet => ({
  kind,
  weightKg,
  reps,
});

/** Підходи активної сесії: ще без finishedAt, йдуть після всієї історії. */
const active = (sets: PerformedSet[]): RecordSet[] =>
  sets.map((s, position) => ({ ...s, id: `now-${position}`, completedAt: position + 1, exercisePosition: 0, position }));

describe('evaluateSetPRs', () => {
  it('сценарій 11: найкраще 60×8; нові 62.5×8, 60×9, 60×8 → 🏆, 🏆, нічого', () => {
    const { sets: history } = journal([
      { source: 'free', day: 0, exercises: [{ exerciseId: 'bench', sets: [set(60, 8)] }] },
    ]);

    const records = rebuildPRs([...history, ...active([w(62.5, 8), w(60, 9), w(60, 8)])], 'weight_reps');

    expect(records.get('now-0')).toEqual(expect.arrayContaining(['max_weight']));
    expect(records.get('now-1')).toEqual(expect.arrayContaining(['max_reps_at_weight']));
    expect(records.has('now-2')).toBe(false);
  });

  it('сценарій 12: вправа виконується вперше → жодної 🏆', () => {
    const records = rebuildPRs(active([w(60, 8), w(62.5, 8), w(65, 8)]), 'weight_reps');

    expect(records.has('now-0')).toBe(false);
    // Наступні підходи тієї ж першої сесії порівнюються з першим — це вже не «перше виконання».
    expect(records.has('now-1')).toBe(true);
  });

  it('сценарій 13: видалено сесію з рекордом 62.5×8, потім 61×8 → 🏆', () => {
    const { sets: history } = journal([
      { source: 'free', day: 0, exercises: [{ exerciseId: 'bench', sets: [set(60, 8)] }] },
      // Сесія з 62.5×8 видалена — шар даних її не віддає.
    ]);

    expect(evaluateSetPRs(w(61, 8), history, 'weight_reps')).toContain('max_weight');
  });

  it('рівний результат — не рекорд', () => {
    expect(evaluateSetPRs(w(60, 8), [w(60, 8)], 'weight_reps')).toEqual([]);
  });

  it('розминка не рахується ні як новий підхід, ні як попередній', () => {
    expect(evaluateSetPRs(w(100, 1, 'warmup'), [w(60, 8)], 'weight_reps')).toEqual([]);
    expect(evaluateSetPRs(w(50, 8), [w(100, 1, 'warmup'), w(40, 8)], 'weight_reps')).toContain('max_weight');
  });

  it('дроп і до відмови рахуються', () => {
    expect(evaluateSetPRs(w(40, 15, 'drop'), [w(40, 12)], 'weight_reps')).toContain('max_reps_at_weight');
    expect(evaluateSetPRs(w(65, 5, 'failure'), [w(60, 8)], 'weight_reps')).toContain('max_weight');
  });

  it('один підхід може бити кілька рекордів', () => {
    expect(evaluateSetPRs(w(65, 9), [w(60, 8)], 'weight_reps').sort()).toEqual([
      'e1rm',
      'max_volume',
      'max_weight',
    ]);
  });

  it('1ПМ рахується лише для підходів до 12 повторів', () => {
    // 40×20 → за Еплі 66.7, але понад 12 повторів не рахується.
    expect(evaluateSetPRs(w(40, 20), [w(50, 10)], 'weight_reps')).not.toContain('e1rm');
    expect(evaluateSetPRs(w(55, 10), [w(50, 10), w(40, 20)], 'weight_reps')).toContain('e1rm');
  });

  it('«більше повторів з цією або більшою вагою» не дає 🏆 там, де важчих підходів ще не було', () => {
    expect(evaluateSetPRs(w(70, 5), [w(60, 8)], 'weight_reps')).not.toContain('max_reps_at_weight');
    expect(evaluateSetPRs(w(55, 9), [w(60, 8)], 'weight_reps')).toContain('max_reps_at_weight');
  });

  it('власна вага: найбільше повторів', () => {
    const prior: PerformedSet[] = [{ kind: 'working', reps: 10 }];

    expect(evaluateSetPRs({ kind: 'working', reps: 11 }, prior, 'bodyweight_reps')).toEqual(['max_reps']);
    expect(evaluateSetPRs({ kind: 'working', reps: 10 }, prior, 'bodyweight_reps')).toEqual([]);
  });

  it('гравітрон: найменша допомога і повтори з цією або меншою допомогою', () => {
    expect(evaluateSetPRs(w(20, 6), [w(25, 8)], 'assisted_bodyweight')).toEqual(['min_assistance']);
    expect(evaluateSetPRs(w(30, 10), [w(25, 8), w(30, 9)], 'assisted_bodyweight')).toEqual(['max_reps_at_assistance']);
  });

  it('час і дистанція', () => {
    expect(evaluateSetPRs({ kind: 'working', durationSec: 90 }, [{ kind: 'working', durationSec: 60 }], 'duration')).toEqual([
      'max_duration',
    ]);
    expect(
      evaluateSetPRs(
        { kind: 'working', distanceM: 5000, durationSec: 1800 },
        [{ kind: 'working', distanceM: 4000, durationSec: 1200 }],
        'distance_duration',
      ),
    ).toEqual(['max_distance']);
  });
});

describe('rebuildPRs', () => {
  it('в історії 🏆 стоїть на підходах, які були рекордом на свій момент', () => {
    const { sets } = journal([
      { source: 'free', day: 0, exercises: [{ exerciseId: 'bench', sets: [set(60, 8)] }] },
      { source: 'routine', title: 'Push', day: 2, exercises: [{ exerciseId: 'bench', sets: [warm(40, 8), set(62.5, 8)] }] },
      { source: 'single_exercise', day: 4, exercises: [{ exerciseId: 'bench', sets: [set(60, 8)] }] },
      { source: 'routine', title: 'Push', day: 6, exercises: [{ exerciseId: 'bench', sets: [set(65, 6)] }] },
    ]);

    const records = rebuildPRs(sets, 'weight_reps');

    expect([...records.keys()].sort()).toEqual(['s1-e0-s1', 's3-e0-s0']);
  });

  it('порядок задає час завершення сесії, а не порядок у масиві', () => {
    const { sets } = journal([
      { source: 'free', day: 5, exercises: [{ exerciseId: 'bench', sets: [set(70, 8)] }] },
      { source: 'free', day: 0, exercises: [{ exerciseId: 'bench', sets: [set(60, 8)] }] },
    ]);

    const records = rebuildPRs(sets, 'weight_reps');

    expect(records.has('s0-e0-s0')).toBe(true);
    expect(records.has('s1-e0-s0')).toBe(false);
  });
});
