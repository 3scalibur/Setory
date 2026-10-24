// Пропущені вправи (SPEC.md, розділ 8): «пропущено ×2, останній раз 3 дні тому (Push)».

import { router } from 'expo-router';
import { useCallback } from 'react';

import { appDeps } from '@/services/app-deps';
import { dismissFromBacklog, getBacklog } from '@/services/backlogService';
import { startSingleExercise } from '@/services/sessionService';
import { daysAgo, musclesText } from '@/ui/format';
import { Button, Card, Empty, Muted, Row, Title } from '@/ui/kit';
import { run } from '@/ui/run';
import { Screen } from '@/ui/screen';
import { useLive } from '@/ui/use-live';

export default function BacklogScreen() {
  const items = useLive(useCallback(() => getBacklog(appDeps), []));

  return (
    <Screen>
      {items.length > 0 ? (
        <Button variant="primary" title="Зібрати день пропущених" onPress={() => router.push('/catch-up')} />
      ) : (
        <Empty>Пропущених немає 💪</Empty>
      )}
      {items.map((item) => (
        <Card key={item.exerciseId}>
          <Title>{item.name}</Title>
          <Muted>{musclesText(item.primaryMuscles)}</Muted>
          <Muted>
            Пропущено ×{item.missCount}, останній раз {daysAgo(item.lastMissedAt, appDeps.now())} ({item.lastRoutineTitle})
          </Muted>
          <Row>
            <Button
              small
              variant="primary"
              title="Виконати"
              onPress={() => {
                const started = run(() => startSingleExercise(appDeps, item.exerciseId));
                if (started) router.push({ pathname: '/session/[id]', params: { id: started.sessionId } });
              }}
            />
            <Button small title="Прибрати" onPress={() => run(() => dismissFromBacklog(appDeps, [item.exerciseId]))} />
          </Row>
        </Card>
      ))}
    </Screen>
  );
}
