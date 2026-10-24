import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';

import { ExerciseCard } from '@/features/session/exercise-card';
import { appDeps } from '@/services/app-deps';
import { deleteSession, discardSession, finishSession, restoreExercise } from '@/services/sessionService';
import { getSessionView } from '@/services/sessionView';
import { formatDateTime, formatMinutes } from '@/ui/format';
import { Button, Card, Empty, Heading, LinkRow, Muted, Row } from '@/ui/kit';
import { confirm, run, succeeded } from '@/ui/run';
import { Screen } from '@/ui/screen';
import { useLive } from '@/ui/use-live';

export default function SessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const view = useLive(useCallback(() => getSessionView(appDeps, id), [id]));

  if (!view) {
    return (
      <Screen>
        <Empty>Тренування не знайдено</Empty>
      </Screen>
    );
  }

  const isActive = view.status === 'active';
  const visible = view.exercises.filter((e) => !e.skipped);
  const skipped = view.exercises.filter((e) => e.skipped);
  const unfinishedSets = visible.flatMap((e) => e.sets).filter((s) => !s.completed).length;

  return (
    <Screen>
      <Stack.Screen options={{ title: view.title }} />
      <Muted>
        {isActive
          ? `Триває ${formatMinutes(appDeps.now() - view.startedAt)}`
          : `${formatDateTime(view.startedAt)} · ${formatMinutes((view.finishedAt ?? view.startedAt) - view.startedAt)}`}
      </Muted>

      {visible.length === 0 ? <Empty>Додай першу вправу</Empty> : null}
      {visible.map((exercise, index) => (
        <ExerciseCard key={exercise.id} exercise={exercise} index={index} count={visible.length} />
      ))}

      <Button
        title="+ Додати вправу"
        onPress={() => router.push({ pathname: '/pick-exercise', params: { mode: 'add', sessionId: view.id } })}
      />

      {skipped.length > 0 ? (
        <Card>
          <Heading>Прибрані</Heading>
          {skipped.map((e) => (
            <Row key={e.id}>
              <Muted>{e.name}</Muted>
              <Row style={{ marginLeft: 'auto' }}>
                <Button small variant="plain" title="Повернути" onPress={() => run(() => restoreExercise(appDeps, e.id))} />
              </Row>
            </Row>
          ))}
        </Card>
      ) : null}

      {isActive ? (
        <>
          <Button
            variant="primary"
            title="Завершити"
            onPress={() => {
              const finish = () => {
                if (succeeded(() => finishSession(appDeps, view.id))) {
                  router.replace({ pathname: '/summary/[id]', params: { id: view.id } });
                }
              };
              if (unfinishedSets > 0) {
                confirm('Завершити тренування?', `Невиконані підходи (${unfinishedSets}) буде видалено.`, 'Завершити', finish, false);
              } else {
                finish();
              }
            }}
          />
          <Button
            variant="destructive"
            title="Скасувати тренування"
            onPress={() =>
              confirm('Скасувати тренування?', 'Воно не потрапить в історію.', 'Скасувати тренування', () => {
                if (succeeded(() => discardSession(appDeps, view.id))) router.back();
              })
            }
          />
        </>
      ) : (
        <>
          <LinkRow
            title="Підсумок"
            subtitle={`Рекорди: ${view.summary.records} · Прогрес у ${view.summary.progressedExercises} вправах`}
            onPress={() => router.push({ pathname: '/summary/[id]', params: { id: view.id } })}
          />
          <Button
            variant="destructive"
            title="Видалити тренування"
            onPress={() =>
              confirm('Видалити тренування?', 'Рекорди і пропущені перерахуються.', 'Видалити', () => {
                if (succeeded(() => deleteSession(appDeps, view.id))) router.back();
              })
            }
          />
        </>
      )}
    </Screen>
  );
}
