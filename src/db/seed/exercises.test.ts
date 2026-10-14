import { normalizeText } from '@/domain/text';
import { EQUIPMENT, EXERCISE_TYPES, MUSCLE_GROUPS } from '@/domain/types';

import { BUILTIN_EXERCISES } from './exercises';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('вбудований каталог вправ', () => {
  it('містить 50–80 вправ (SPEC.md, розділ 10)', () => {
    expect(BUILTIN_EXERCISES.length).toBeGreaterThanOrEqual(50);
    expect(BUILTIN_EXERCISES.length).toBeLessThanOrEqual(80);
  });

  it('має унікальні id у форматі UUID', () => {
    const ids = BUILTIN_EXERCISES.map((e) => e.id);
    ids.forEach((id) => expect(id).toMatch(UUID));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('кожна назва і синонім ведуть рівно на одну вправу — інакше пошук роздвоїть історію', () => {
    const owner = new Map<string, string>();
    for (const e of BUILTIN_EXERCISES) {
      for (const term of new Set([e.name, ...e.aliases].map(normalizeText))) {
        const prev = owner.get(term);
        if (prev) throw new Error(`«${term}» є і у «${prev}», і у «${e.name}»`);
        owner.set(term, e.name);
      }
    }
  });

  it('має коректні м’язи, обладнання і тип', () => {
    for (const e of BUILTIN_EXERCISES) {
      expect(e.primaryMuscles.length).toBeGreaterThan(0);
      [...e.primaryMuscles, ...e.secondaryMuscles].forEach((m) => expect(MUSCLE_GROUPS).toContain(m));
      e.secondaryMuscles.forEach((m) => expect(e.primaryMuscles).not.toContain(m));
      expect(EQUIPMENT).toContain(e.equipment);
      expect(EXERCISE_TYPES).toContain(e.type);
    }
  });

  it('містить усі 25 вправ із поточних програм користувача', () => {
    const fromPrograms = [
      'shrug (barbell)',
      'lying neck curls (weighted)',
      'lying neck extension (weighted)',
      'standing calf raise (smith)',
      'seated palms up wrist curl',
      'reverse wrist curl (dumbbell)',
      'hanging leg raise',
      'incline bench press (dumbbell)',
      'bench press (barbell)',
      'chest fly (machine)',
      'chest dip',
      'triceps pushdown',
      'pull up',
      'bent over row (barbell)',
      'seated cable row - v grip (cable)',
      'lat pulldown - close grip (cable)',
      'rear delt reverse fly (machine)',
      'bicep curl (dumbbell)',
      'squat (barbell)',
      'leg press (machine)',
      'lying leg curl (machine)',
      'seated overhead press (dumbbell)',
      'lateral raise (dumbbell)',
      'hammer curl (dumbbell)',
      'crunch',
    ];
    const allTerms = new Set(BUILTIN_EXERCISES.flatMap((e) => e.aliases.map(normalizeText)));
    fromPrograms.forEach((name) => expect(allTerms).toContain(name));
    expect(BUILTIN_EXERCISES.filter((e) => e.fromUserProgram)).toHaveLength(fromPrograms.length);
  });
});
