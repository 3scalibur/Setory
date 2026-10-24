/**
 * @jest-environment node
 */
import { listFolders } from '@/data/folders';
import { loadHistorySets } from '@/data/history';
import { lastPerformance } from '@/domain/performance';
import { rebuildPRs } from '@/domain/records';

import { UserError } from './deps';
import { createFolder, deleteFolder, folderForNewRoutine, renameFolder, reorderFolders, setActiveFolder } from './folderService';
import {
  deleteRoutine,
  duplicateRoutine,
  getRoutineDraft,
  getRoutineView,
  getWorkoutTab,
  moveRoutine,
  saveRoutine,
  type RoutineDraft,
} from './routineService';
import { startRoutine, startSingleExercise } from './sessionService';
import { getSessionView } from './sessionView';
import { createTestDeps, DAY, ex } from './test-deps';
import { finishWith } from './test-helpers';

const BENCH = ex('bench press');
const ROW = ex('bent over row (barbell)');
const SQUAT = ex('squat (barbell)');
const LATERAL = ex('lateral raise (dumbbell)');

const routine = (folderId: string, name: string, exerciseId: string, extra: Partial<RoutineDraft> = {}): RoutineDraft => ({
  folderId,
  name,
  exercises: [{ exerciseId, sets: [{ kind: 'working', weightKg: 60, repsMin: 8, repsMax: 10 }] }],
  ...extra,
});

describe('папки', () => {
  it('на першому запуску є активна «Мої програми»; нова папка не забирає активність', () => {
    const { deps } = createTestDeps();
    createFolder(deps, 'PPL');

    expect(listFolders(deps.db).map((f) => [f.name, f.isActive])).toEqual([
      ['Мої програми', true],
      ['PPL', false],
    ]);
  });

  it('перейменувати, змінити порядок, зробити активною', () => {
    const { deps } = createTestDeps();
    const [defaultId] = listFolders(deps.db).map((f) => f.id);
    const ppl = createFolder(deps, 'PPL');

    renameFolder(deps, ppl, '  Push Pull Legs ');
    reorderFolders(deps, [ppl, defaultId]);
    setActiveFolder(deps, ppl);

    expect(listFolders(deps.db).map((f) => [f.name, f.isActive])).toEqual([
      ['Push Pull Legs', true],
      ['Мої програми', false],
    ]);
  });

  it('порожня назва — помилка', () => {
    const { deps } = createTestDeps();

    expect(() => createFolder(deps, '   ')).toThrow(new UserError('Вкажи назву папки.'));
  });

  it('видалили активну папку → активною стає перша з решти; не лишилось жодної → «Мої програми» при новій програмі', () => {
    const { deps } = createTestDeps();
    const [defaultId] = listFolders(deps.db).map((f) => f.id);
    const ppl = createFolder(deps, 'PPL');

    deleteFolder(deps, defaultId);
    expect(listFolders(deps.db).map((f) => [f.id, f.isActive])).toEqual([[ppl, true]]);

    deleteFolder(deps, ppl);
    expect(listFolders(deps.db)).toEqual([]);
    const created = folderForNewRoutine(deps);
    expect(listFolders(deps.db).map((f) => [f.id, f.name, f.isActive])).toEqual([[created, 'Мої програми', true]]);
  });

  it('сценарій 22: видалено папку з 2 програмами, по яких є тренування → історія, рекорди і prefill не змінились', () => {
    const { deps, advance } = createTestDeps();
    const ppl = createFolder(deps, 'PPL');
    const push = saveRoutine(deps, routine(ppl, 'Push', BENCH));
    const pull = saveRoutine(deps, routine(ppl, 'Pull', ROW));
    finishWith(deps, advance, startRoutine(deps, push), { [BENCH]: [[60, 8], [62.5, 8]] });
    advance(DAY);
    finishWith(deps, advance, startRoutine(deps, pull), { [ROW]: [[50, 10]] });
    const before = loadHistorySets(deps.db);
    const recordsBefore = rebuildPRs(before.filter((s) => s.exerciseId === BENCH), 'weight_reps');

    deleteFolder(deps, ppl);
    advance(DAY);

    const after = loadHistorySets(deps.db);
    expect(after).toEqual(before);
    expect(rebuildPRs(after.filter((s) => s.exerciseId === BENCH), 'weight_reps')).toEqual(recordsBefore);
    expect(lastPerformance(BENCH, after)?.sessionTitle).toBe('Push');
    const single = startSingleExercise(deps, BENCH).sessionId;
    expect(getSessionView(deps, single)!.exercises[0].sets.map((s) => s.weightKg)).toEqual([60, 62.5]);
  });
});

describe('програми', () => {
  it('зберегти можна, лише коли є назва, вправа і в кожної хоча б один підхід', () => {
    const { deps } = createTestDeps();
    const folderId = folderForNewRoutine(deps);

    expect(() => saveRoutine(deps, routine(folderId, ' ', BENCH))).toThrow('Вкажи назву програми.');
    expect(() => saveRoutine(deps, { folderId, name: 'Push', exercises: [] })).toThrow('Додай хоча б одну вправу.');
    expect(() =>
      saveRoutine(deps, { folderId, name: 'Push', exercises: [{ exerciseId: BENCH, sets: [] }] }),
    ).toThrow('У кожної вправи має бути хоча б один підхід.');
    expect(() =>
      saveRoutine(deps, { folderId, name: 'Push', exercises: [{ exerciseId: BENCH, sets: [{ kind: 'working', repsMin: 10, repsMax: 8 }] }] }),
    ).toThrow(UserError);
  });

  it('кожен підхід — окремий рядок; відпочинок за замовчуванням: 150 с базові, 90 с ізоляція', () => {
    const { deps } = createTestDeps();
    const folderId = folderForNewRoutine(deps);
    const id = saveRoutine(deps, {
      folderId,
      name: 'Push',
      exercises: [
        { exerciseId: BENCH, sets: [{ kind: 'warmup', weightKg: 40, repsMin: 10 }, { kind: 'working', weightKg: 60, repsMin: 10 }, { kind: 'working', weightKg: 70, repsMin: 8 }, { kind: 'failure', weightKg: 80, repsMin: 6 }] },
        { exerciseId: LATERAL, sets: [{ kind: 'working', repsMin: 12, repsMax: 20 }] },
      ],
    });

    const draft = getRoutineDraft(deps, id)!;

    expect(draft.exercises[0].sets.map((s) => [s.kind, s.weightKg, s.repsMin, s.repsMax])).toEqual([
      ['warmup', 40, 10, 10],
      ['working', 60, 10, 10],
      ['working', 70, 8, 8],
      ['failure', 80, 6, 6],
    ]);
    expect(draft.exercises.map((e) => e.restSec)).toEqual([150, 90]);
  });

  it('редагування зберігає id вправ, що лишились, і не чіпає історію', () => {
    const { deps, advance } = createTestDeps();
    const folderId = folderForNewRoutine(deps);
    const id = saveRoutine(deps, {
      folderId,
      name: 'Full',
      exercises: [
        { exerciseId: BENCH, sets: [{ kind: 'working', repsMin: 8 }] },
        { exerciseId: SQUAT, sets: [{ kind: 'working', repsMin: 6 }] },
      ],
    });
    finishWith(deps, advance, startRoutine(deps, id), { [BENCH]: [[60, 8]], [SQUAT]: [[80, 6]] });
    const draft = getRoutineDraft(deps, id)!;
    const benchSlot = draft.exercises[0].id;

    saveRoutine(deps, { ...draft, name: 'Full B', exercises: [{ ...draft.exercises[0], sets: [{ kind: 'working', repsMin: 10 }] }, { exerciseId: ROW, sets: [{ kind: 'working', repsMin: 10 }] }] });
    const edited = getRoutineDraft(deps, id)!;

    expect(edited.name).toBe('Full B');
    expect(edited.exercises.map((e) => e.exerciseId)).toEqual([BENCH, ROW]);
    expect(edited.exercises[0].id).toBe(benchSlot);
    expect(loadHistorySets(deps.db).map((s) => s.exerciseId).sort()).toEqual([BENCH, SQUAT].sort());
  });

  it('дублювати, перенести в іншу папку, видалити', () => {
    const { deps } = createTestDeps();
    const home = folderForNewRoutine(deps);
    const ppl = createFolder(deps, 'PPL');
    const id = saveRoutine(deps, routine(home, 'Push', BENCH));

    const copy = duplicateRoutine(deps, id);
    moveRoutine(deps, copy, ppl);
    deleteRoutine(deps, id);
    const tab = getWorkoutTab(deps);

    expect(tab.folders.map((f) => [f.name, f.routines.map((r) => r.name)])).toEqual([
      ['Мої програми', []],
      ['PPL', ['Push (копія)']],
    ]);
  });

  it('картка програми: біля підходів кг з минулого разу (будь-де), поки не робив — стартові кг програми', () => {
    const { deps, advance } = createTestDeps();
    const folderId = folderForNewRoutine(deps);
    const id = saveRoutine(deps, {
      folderId,
      name: 'Push',
      exercises: [{ exerciseId: BENCH, sets: [{ kind: 'working', weightKg: 60, repsMin: 10 }, { kind: 'working', weightKg: 70, repsMin: 8 }, { kind: 'working', weightKg: 80, repsMin: 6 }] }],
    });

    expect(getRoutineView(deps, id)!.exercises[0].display.map((s) => s.weightKg)).toEqual([60, 70, 80]);

    // Сценарій 19: минулого разу окремим запуском зроблено 62.5 / 72.5 / 80.
    finishWith(deps, advance, startSingleExercise(deps, BENCH).sessionId, { [BENCH]: [[62.5, 10], [72.5, 8], [80, 6]] });
    const view = getRoutineView(deps, id)!;

    expect(view.exercises[0].display.map((s) => s.weightKg)).toEqual([62.5, 72.5, 80]);
    expect(view.exercises[0].last?.source).toBe('single_exercise');
    expect(view.estimatedSec).toBeGreaterThan(0);
  });
});

describe('вкладка «Тренування»', () => {
  it('«Наступне» по колу в активній папці; програма з іншої папки його не зсуває (сценарій 23)', () => {
    const { deps, advance } = createTestDeps();
    const ppl = createFolder(deps, 'PPL');
    setActiveFolder(deps, ppl);
    const extra = createFolder(deps, 'Додаткове');
    const push = saveRoutine(deps, routine(ppl, 'Push', BENCH));
    saveRoutine(deps, routine(ppl, 'Pull', ROW));
    const neck = saveRoutine(deps, routine(extra, 'Шия', LATERAL));

    expect(getWorkoutTab(deps).next?.name).toBe('Push');
    finishWith(deps, advance, startRoutine(deps, push), { [BENCH]: [[60, 8]] });
    advance(DAY);
    finishWith(deps, advance, startRoutine(deps, neck), { [LATERAL]: [[8, 15]] });

    const tab = getWorkoutTab(deps);
    expect(tab.next?.name).toBe('Pull');
    expect(tab.folders.find((f) => f.name === 'PPL')?.routines.map((r) => [r.name, r.exerciseNames])).toEqual([
      ['Push', ['Жим штанги лежачи']],
      ['Pull', ['Тяга штанги в нахилі']],
    ]);
  });

  it('активне тренування видно на вкладці', () => {
    const { deps } = createTestDeps();
    const { sessionId } = startSingleExercise(deps, BENCH);

    expect(getWorkoutTab(deps).activeSession).toMatchObject({ id: sessionId, title: 'Окрема вправа' });
  });
});
