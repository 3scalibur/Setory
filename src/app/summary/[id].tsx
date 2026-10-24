import { router, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { Text } from 'react-native';

import { appDeps } from '@/services/app-deps';
import { getSessionView } from '@/services/sessionView';
import { colors } from '@/ui/colors';
import { formatMinutes, PR_LABELS } from '@/ui/format';
import { Body, Button, Card, Empty, Heading, Muted, Title } from '@/ui/kit';
import { Screen } from '@/ui/screen';
import { useLive } from '@/ui/use-live';

export default function SummaryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const view = useLive(useCallback(() => getSessionView(appDeps, id), [id]));

  if (!view) {
    return (
      <Screen>
        <Empty>Тренування не знайдено</Empty>
      </Screen>
    );
  }

  const done = view.exercises.filter((e) => e.sets.some((s) => s.completed));
  const workingSets = done.flatMap((e) => e.sets).filter((s) => s.completed && s.kind !== 'warmup').length;

  return (
    <Screen>
      <Card>
        <Title>{view.title}</Title>
        <Muted>
          {formatMinutes((view.finishedAt ?? appDeps.now()) - view.startedAt)} · {done.length} вправ · {workingSets} робочих підходів
        </Muted>
        <Text style={{ fontSize: 22, fontWeight: '700', color: colors.label, fontVariant: ['tabular-nums'] }}>
          Рекорди: {view.summary.records} · Прогрес у {view.summary.progressedExercises} вправах
        </Text>
      </Card>

      {view.summary.newRecords.length > 0 ? (
        <Card>
          <Heading>Нові рекорди 🏆</Heading>
          {view.summary.newRecords.map((r) => (
            <Body key={r.setId}>
              {r.exerciseName}: {r.prs.map((p) => PR_LABELS[p]).join(', ')}
            </Body>
          ))}
        </Card>
      ) : null}

      <Button variant="primary" title="Готово" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      <Button title="Переглянути тренування" onPress={() => router.push({ pathname: '/session/[id]', params: { id: view.id } })} />
    </Screen>
  );
}
