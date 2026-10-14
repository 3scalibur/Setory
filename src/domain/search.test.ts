import { editDistance, searchExercises, similarExercises, type SearchableExercise } from './search';

const ex = (
  id: string,
  name: string,
  aliases: string[],
  extra: Partial<SearchableExercise> = {},
): SearchableExercise => ({
  id,
  name,
  aliases,
  primaryMuscles: ['chest'],
  equipment: 'barbell',
  ...extra,
});

const catalog: SearchableExercise[] = [
  ex('bench', 'Жим штанги лежачи', ['жим лежачи', 'жим лежа', 'bench press', 'bench press (barbell)']),
  ex('db-bench', 'Жим гантелей лежачи', ['жим гантелей лежа', 'bench press (dumbbell)'], { equipment: 'dumbbell' }),
  ex('incline', 'Жим гантелей на похилій лаві', ['incline bench press (dumbbell)'], { equipment: 'dumbbell' }),
  ex('squat', 'Присідання зі штангою', ['присед', 'приседания', 'squat'], { primaryMuscles: ['quads', 'glutes'] }),
  ex('wrist', "Згинання зап'ястя сидячи", ['wrist curl'], { primaryMuscles: ['forearms'], equipment: 'dumbbell' }),
  ex('old', 'Стара вправа', ['old'], { archivedAt: 1 }),
];

const ids = (list: SearchableExercise[]) => list.map((e) => e.id);
const noUsage = new Map();

describe('searchExercises', () => {
  it('«жим лежачи», «жим лежа», «bench» — першою знаходиться та сама вправа', () => {
    for (const query of ['жим лежачи', 'жим лежа', 'bench', 'BENCH', '  Жим   ЛЕЖА ']) {
      expect(ids(searchExercises(query, catalog, noUsage))[0]).toBe('bench');
    }
  });

  it('російською і англійською', () => {
    expect(ids(searchExercises('присед', catalog, noUsage))).toEqual(['squat']);
    expect(ids(searchExercises('squat', catalog, noUsage))).toEqual(['squat']);
  });

  it('апострофи будь-якого виду не заважають', () => {
    for (const query of ['запястя', "зап'ястя", 'запʼястя', 'зап’ястя']) {
      expect(ids(searchExercises(query, catalog, noUsage))).toEqual(['wrist']);
    }
  });

  it('витримує одруки', () => {
    expect(ids(searchExercises('жим лежча', catalog, noUsage))[0]).toBe('bench');
    expect(ids(searchExercises('присидання', catalog, noUsage))).toEqual(['squat']);
  });

  it('початок слова вище, ніж «містить»', () => {
    const list = [ex('a', 'Тяга до обличчя', ['face pull']), ex('b', 'Підтягування', ['pull up'])];

    expect(ids(searchExercises('тяг', list, noUsage))).toEqual(['a', 'b']);
  });

  it('при рівності — ті, що робив нещодавно і частіше', () => {
    const usage = new Map([
      ['db-bench', { lastDoneAt: 100, count: 3 }],
      ['bench', { lastDoneAt: 50, count: 9 }],
    ]);

    expect(ids(searchExercises('bench press', catalog, usage)).slice(0, 2)).toEqual(['db-bench', 'bench']);
  });

  it('порожній запит: спершу недавні, далі решта за абеткою', () => {
    const usage = new Map([['squat', { lastDoneAt: 100, count: 1 }]]);

    expect(ids(searchExercises('', catalog, usage))).toEqual(['squat', 'db-bench', 'incline', 'bench', 'wrist']);
  });

  it('фільтри: група м’язів і обладнання', () => {
    expect(ids(searchExercises('', catalog, noUsage, { muscle: 'quads' }))).toEqual(['squat']);
    expect(ids(searchExercises('жим', catalog, noUsage, { equipment: 'dumbbell' }))).toEqual(['db-bench', 'incline']);
  });

  it('архівні вправи не показуються', () => {
    expect(ids(searchExercises('old', catalog, noUsage))).toEqual([]);
  });

  it('нічого схожого — порожньо', () => {
    expect(searchExercises('плавання', catalog, noUsage)).toEqual([]);
  });
});

describe('similarExercises', () => {
  it('попереджає про таку саму або майже таку саму назву', () => {
    expect(ids(similarExercises('жим лежа', catalog))).toEqual(['bench']);
    expect(ids(similarExercises('Присіданя зі штангою', catalog))).toEqual(['squat']);
  });

  it('нова назва — без попереджень', () => {
    expect(similarExercises('Жим Арнольда', catalog)).toEqual([]);
  });
});

describe('editDistance', () => {
  it('рахує перестановку сусідніх літер як одну помилку', () => {
    expect(editDistance('лежча', 'лежач')).toBe(1);
    expect(editDistance('жим', 'жим')).toBe(0);
    expect(editDistance('abc', 'xyz')).toBe(3);
  });
});
