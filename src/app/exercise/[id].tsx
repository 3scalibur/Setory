// Картка вправи: м'язи, техніка, поточні рекорди, усі виконання з позначкою джерела.

import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { Alert, Text } from 'react-native';

import type { PRType } from '@/domain/records';
import { appDeps } from '@/services/app-deps';
import { getExerciseCard, removeCustomExercise } from '@/services/exerciseService';
import { startSingleExercise } from '@/services/sessionService';
import { colors } from '@/ui/colors';
import {
  EQUIPMENT_LABELS,
  formatDate,
  formatNumber,
  formatSeconds,
  formatSet,
  MECHANIC_LABELS,
  musclesText,
  PR_LABELS,
  sourceLabel,
  TYPE_LABELS,
} from '@/ui/format';
import { Body, Button, Card, Empty, Heading, Muted, Row } from '@/ui/kit';
import { confirm, run, succeeded } from '@/ui/run';
import { Screen } from '@/ui/screen';
import { useLive } from '@/ui/use-live';

const BEST_UNITS: Partial<Record<PRType, (v: number) => string>> = {
  max_weight: (v) => `${formatNumber(v)} кг`,
  e1rm: (v) => `${formatNumber(Math.round(v * 10) / 10)} кг`,
  max_volume: (v) => `${formatNumber(v)} кг`,
  max_reps: (v) => `${v} повт.`,
  min_assistance: (v) => `${formatNumber(v)} кг`,
  max_duration: (v) => formatSeconds(v),
  max_distance: (v) => `${formatNumber(v)} м`,
};

export default function ExerciseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const card = useLive(useCallback(() => getExerciseCard(appDeps, id), [id]));

  if (!card) {
    return (
      <Screen>
        <Empty>Вправу не знайдено</Empty>
      </Screen>
    );
  }

  const { exercise } = card;
  const bests = Object.entries(card.bests) as [PRType, number][];

  return (
    <Screen>
      <Stack.Screen options={{ title: exercise.name }} />
      <Card>
        <Body>{musclesText(exercise.primaryMuscles)}</Body>
        {exercise.secondaryMuscles.length > 0 ? <Muted>Допоміжні: {musclesText(exercise.secondaryMuscles)}</Muted> : null}
        <Muted>
          {EQUIPMENT_LABELS[exercise.equipment]} · {MECHANIC_LABELS[exercise.mechanic]} · {TYPE_LABELS[exercise.type]}
        </Muted>
        {exercise.archivedAt ? <Text style={{ color: colors.warning }}>В архіві: у пошуку не показується</Text> : null}
        {exercise.instructions ? <Body selectable>{exercise.instructions}</Body> : null}
      </Card>

      <Button
        variant="primary"
        title="Виконати"
        onPress={() => {
          const started = run(() => startSingleExercise(appDeps, exercise.id));
          if (started) router.push({ pathname: '/session/[id]', params: { id: started.sessionId } });
        }}
      />

      <Heading>Рекорди</Heading>
      {bests.length === 0 ? (
        <Empty>Рекорди з’являться після першого виконання</Empty>
      ) : (
        <Card>
          {bests.map(([type, value]) => (
            <Row key={type}>
              <Muted>{PR_LABELS[type]}</Muted>
              <Text selectable style={{ marginLeft: 'auto', color: colors.label, fontVariant: ['tabular-nums'] }}>
                {BEST_UNITS[type]?.(value) ?? formatNumber(value)}
              </Text>
            </Row>
          ))}
        </Card>
      )}

      <Heading>Історія</Heading>
      {card.history.length === 0 ? <Empty>Ще не виконувалась</Empty> : null}
      {card.history.map((h) => (
        <Card key={h.sessionId}>
          <Muted>
            {formatDate(h.finishedAt)} · {sourceLabel(h.source, h.sessionTitle)}
          </Muted>
          <Text selectable style={{ color: colors.label, fontVariant: ['tabular-nums'] }}>
            {h.sets
              .map((s) => `${s.kind === 'warmup' ? 'Р ' : ''}${formatSet(s, exercise.type)}${s.prs.length > 0 ? ' 🏆' : ''}`)
              .join('   ')}
          </Text>
        </Card>
      ))}

      {exercise.isCustom ? (
        <>
          <Heading>Власна вправа</Heading>
          <Button title="Редагувати" onPress={() => router.push({ pathname: '/exercise/edit', params: { id: exercise.id } })} />
          <Button
            variant="destructive"
            title="Видалити"
            onPress={() =>
              confirm('Видалити вправу?', 'Якщо в неї є історія, вправа піде в архів, а історія залишиться.', 'Видалити', () => {
                let result: 'archived' | 'deleted' | undefined;
                if (succeeded(() => (result = removeCustomExercise(appDeps, exercise.id)))) {
                  if (result === 'archived') Alert.alert('Вправу заархівовано', 'Історія і рекорди збережені.');
                  router.back();
                }
              })
            }
          />
        </>
      ) : null}
    </Screen>
  );
}
