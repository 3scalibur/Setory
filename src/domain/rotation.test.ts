import { journal, set } from './__fixtures__/journal';
import { nextRoutine, type RotationRoutine } from './rotation';

const ppl: RotationRoutine[] = [
  { id: 'push', position: 0, deleted: false },
  { id: 'pull', position: 1, deleted: false },
  { id: 'legs', position: 2, deleted: false },
];

const routineSession = (routineId: string, dayN: number, folderId = 'ppl') => ({
  source: 'routine' as const,
  title: routineId,
  folderId,
  routineId,
  day: dayN,
  exercises: [{ exerciseId: 'x', slot: `${routineId}-x`, sets: [set(50, 10)] }],
});

describe('nextRoutine', () => {
  it('без жодного тренування — перша програма папки', () => {
    expect(nextRoutine(ppl, [], 'ppl')).toBe('push');
  });

  it('після останньої завершеної програми — наступна по колу', () => {
    const { sessions } = journal([routineSession('push', 0), routineSession('pull', 1), routineSession('legs', 2)]);

    expect(nextRoutine(ppl, sessions, 'ppl')).toBe('push');
  });

  it('сценарій 14: після Push були окрема вправа і день пропущених → наступна все ще Pull', () => {
    const { sessions } = journal([
      routineSession('push', 0),
      { source: 'single_exercise', day: 1, exercises: [{ exerciseId: 'curl', sets: [set(12, 10)] }] },
      { source: 'catch_up', day: 2, exercises: [{ exerciseId: 'lateral', sets: [set(8, 15)] }] },
    ]);

    expect(nextRoutine(ppl, sessions, 'ppl')).toBe('pull');
  });

  it('сценарій 23: завершено Push, потім програму з іншої папки → «Наступне» в PPL все ще Pull', () => {
    const { sessions } = journal([routineSession('push', 0), routineSession('neck', 1, 'extra')]);

    expect(nextRoutine(ppl, sessions, 'ppl')).toBe('pull');
  });

  it('останню зроблену програму видалили → наступна за її місцем', () => {
    const { sessions } = journal([routineSession('pull', 0)]);
    const withDeletedPull = ppl.map((r) => (r.id === 'pull' ? { ...r, deleted: true } : r));

    expect(nextRoutine(withDeletedPull, sessions, 'ppl')).toBe('legs');
  });

  it('видалені програми пропускаються', () => {
    const { sessions } = journal([routineSession('push', 0)]);
    const withDeletedPull = ppl.map((r) => (r.id === 'pull' ? { ...r, deleted: true } : r));

    expect(nextRoutine(withDeletedPull, sessions, 'ppl')).toBe('legs');
  });

  it('порожня папка — немає наступної', () => {
    expect(nextRoutine([], [], 'ppl')).toBeNull();
  });
});
