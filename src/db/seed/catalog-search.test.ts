// Пошук по справжньому вбудованому каталогу: вправи з програм користувача знаходяться за назвами,
// якими він звик їх називати (укр/рос/англ, як у його програмах).

import { searchExercises } from '@/domain/search';
import { normalizeText } from '@/domain/text';

import { BUILTIN_EXERCISES } from './exercises';

const noUsage = new Map();
const first = (query: string) => searchExercises(query, BUILTIN_EXERCISES, noUsage)[0];
const byAlias = (alias: string) => BUILTIN_EXERCISES.find((e) => e.aliases.map(normalizeText).includes(normalizeText(alias)))!;

describe('пошук по вбудованому каталогу', () => {
  it('«жим лежачи», «жим лежа», «bench» — жим штанги лежачи', () => {
    const bench = byAlias('bench press');
    for (const query of ['жим лежачи', 'жим лежа', 'bench', 'бенч']) {
      expect(first(query).id).toBe(bench.id);
    }
  });

  it('кожна вправа з поточних програм — перша за своєю англійською назвою', () => {
    for (const e of BUILTIN_EXERCISES.filter((x) => x.fromUserProgram)) {
      const englishNames = e.aliases.filter((a) => /^[a-z]/i.test(a));
      for (const name of englishNames) {
        expect({ query: name, found: first(name)?.name }).toEqual({ query: name, found: e.name });
      }
    }
  });

  it('російські назви', () => {
    expect(first('подтягивания').id).toBe(byAlias('pull up').id);
    expect(first('шраги').id).toBe(byAlias('barbell shrug').id);
    expect(first('присед').id).toBe(byAlias('squat').id);
  });
});
