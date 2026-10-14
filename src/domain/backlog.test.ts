import { day, finishedOn, journal, set, warm, type FxExercise } from './__fixtures__/journal';
import { computeBacklog } from './backlog';
import { DAY_MS } from './sets';

/** Push з 6 вправ: перші `done` виконано, решту прибрано. */
function push(dayN: number, done: number, extra: FxExercise[] = []) {
  const ids = ['bench', 'incline', 'fly', 'dip', 'pushdown', 'lateral'];
  return {
    source: 'routine' as const,
    title: 'Push',
    folderId: 'ppl',
    routineId: 'push',
    day: dayN,
    exercises: [
      ...ids.map((exerciseId, i) =>
        i < done
          ? { exerciseId, slot: `push-${exerciseId}`, sets: [set(50, 10)] }
          : { exerciseId, slot: `push-${exerciseId}`, skipped: true },
      ),
      ...extra,
    ],
  };
}

const now = (dayN: number) => day(dayN) + 12 * 60 * 60 * 1000;

describe('computeBacklog', () => {
  it('сценарій 3: Push з 6 вправ, виконано 4, дві прибрано → у пропущених ці 2 з позначкою Push', () => {
    const { sessions } = journal([push(0, 4)]);

    const backlog = computeBacklog(sessions, [], now(1));

    expect(backlog.map((b) => b.exerciseId).sort()).toEqual(['lateral', 'pushdown']);
    expect(backlog[0]).toMatchObject({ lastRoutineTitle: 'Push', missCount: 1 });
  });

  it('сценарій 4: одну з пропущених зроблено окремо (1 робочий підхід) → вона зникає, друга лишається', () => {
    const { sessions } = journal([
      push(0, 4),
      { source: 'single_exercise', day: 1, exercises: [{ exerciseId: 'lateral', sets: [set(8, 15)] }] },
    ]);

    expect(computeBacklog(sessions, [], now(2)).map((b) => b.exerciseId)).toEqual(['pushdown']);
  });

  it('сценарій 5: пропущену зробили лише розминкою → лишається', () => {
    const { sessions } = journal([
      push(0, 5),
      { source: 'single_exercise', day: 1, exercises: [{ exerciseId: 'lateral', sets: [warm(4, 15)] }] },
    ]);

    expect(computeBacklog(sessions, [], now(2)).map((b) => b.exerciseId)).toEqual(['lateral']);
  });

  it('сценарій 6: одну вправу пропущено у двох Push поспіль → одна позиція, ×2', () => {
    const { sessions } = journal([push(0, 5), push(3, 5)]);

    const backlog = computeBacklog(sessions, [], now(4));

    expect(backlog).toHaveLength(1);
    expect(backlog[0]).toMatchObject({
      exerciseId: 'lateral',
      missCount: 2,
      firstMissedAt: finishedOn(0),
      lastMissedAt: finishedOn(3),
    });
  });

  it('сценарій 7: пропущену виконали в наступному дні програми або додали в нього через пошук → закрита', () => {
    const { sessions } = journal([
      push(0, 4),
      {
        source: 'routine',
        title: 'Pull',
        folderId: 'ppl',
        routineId: 'pull',
        day: 1,
        exercises: [
          { exerciseId: 'row', slot: 'pull-row', sets: [set(50, 10)] },
          // Додано через пошук, без слоту.
          { exerciseId: 'pushdown', sets: [set(30, 12)] },
        ],
      },
    ]);

    expect(computeBacklog(sessions, [], now(2)).map((b) => b.exerciseId)).toEqual(['lateral']);
  });

  it('сценарій 8: слот замінено на альтернативу і її виконано → слот не в пропущених', () => {
    const { sessions } = journal([
      {
        source: 'routine',
        title: 'Push',
        day: 0,
        exercises: [{ exerciseId: 'machine-fly', slot: 'push-fly', sets: [set(40, 12)] }],
      },
    ]);

    expect(computeBacklog(sessions, [], now(1))).toEqual([]);
  });

  it('сценарій 9: вручну прибрали, потім пропустили знову → зникає, потім повертається з ×1', () => {
    const first = journal([push(0, 5)]);
    const dismissals = [{ exerciseId: 'lateral', dismissedAt: day(1) }];

    expect(computeBacklog(first.sessions, dismissals, now(1))).toEqual([]);

    const again = journal([push(0, 5), push(3, 5)]);
    expect(computeBacklog(again.sessions, dismissals, now(4))).toEqual([
      expect.objectContaining({ exerciseId: 'lateral', missCount: 1, firstMissedAt: finishedOn(3) }),
    ]);
  });

  it('сценарій 10: останній пропуск 15 днів тому → прихований як застарілий', () => {
    const { sessions } = journal([push(0, 5)]);

    expect(computeBacklog(sessions, [], finishedOn(0) + 13 * DAY_MS)).toHaveLength(1);
    expect(computeBacklog(sessions, [], finishedOn(0) + 15 * DAY_MS)).toEqual([]);
  });

  it('невиконані вправи в окремому запуску, дні пропущених і вільному тренуванні — не пропуски', () => {
    const { sessions } = journal([
      { source: 'single_exercise', day: 0, exercises: [{ exerciseId: 'bench' }] },
      { source: 'catch_up', day: 1, exercises: [{ exerciseId: 'lateral', slot: 'push-lateral', skipped: true }] },
      { source: 'free', day: 2, exercises: [{ exerciseId: 'curl' }] },
    ]);

    expect(computeBacklog(sessions, [], now(3))).toEqual([]);
  });

  it('пропущений слот не рахується, якщо ту саму вправу зробили в цій же сесії', () => {
    const { sessions } = journal([push(0, 5, [{ exerciseId: 'lateral', sets: [set(8, 15)] }])]);

    expect(computeBacklog(sessions, [], now(1))).toEqual([]);
  });

  it('архівні вправи не показуються', () => {
    const { sessions } = journal([push(0, 4)]);

    const backlog = computeBacklog(sessions, [], now(1), { hiddenExerciseIds: new Set(['lateral']) });

    expect(backlog.map((b) => b.exerciseId)).toEqual(['pushdown']);
  });

  it('цілі беруться з найсвіжішого пропуску', () => {
    const plan = (reps: number) => [{ position: 0, kind: 'working' as const, repsMin: reps, repsMax: reps }];
    const { sessions } = journal([
      { source: 'routine', title: 'Push', day: 0, exercises: [{ exerciseId: 'lateral', slot: 'a', skipped: true, targets: plan(12) }] },
      { source: 'routine', title: 'Push B', day: 2, exercises: [{ exerciseId: 'lateral', slot: 'b', skipped: true, targets: plan(15) }] },
    ]);

    expect(computeBacklog(sessions, [], now(3))[0]).toMatchObject({ lastRoutineTitle: 'Push B', targets: plan(15) });
  });
});
