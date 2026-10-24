// Картка програми: вправи з кг минулого разу, оцінка часу, «маю N хвилин», дії з програмою.

import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Text } from 'react-native';

import { appDeps } from '@/services/app-deps';
import { getRoutineBudgetPlan } from '@/services/backlogService';
import { getFolders } from '@/services/folderService';
import { deleteRoutine, duplicateRoutine, getRoutineView, moveRoutine } from '@/services/routineService';
import { addExercise, startRoutine } from '@/services/sessionService';
import { colors } from '@/ui/colors';
import {
  formatDate,
  formatNumber,
  formatReps,
  formatSeconds,
  KIND_SHORT,
  sourceLabel,
} from '@/ui/format';
import { Button, Card, Chip, Empty, Heading, Muted, NumberField, Row, Title } from '@/ui/kit';
import { confirm, run, succeeded } from '@/ui/run';
import { Screen } from '@/ui/screen';
import { useLive } from '@/ui/use-live';

export default function RoutineScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const view = useLive(useCallback(() => getRoutineView(appDeps, id), [id]));
  const [budgetMin, setBudgetMin] = useState<number | null>(null);
  const [excludedSuggestions, setExcludedSuggestions] = useState<Set<string>>(new Set());
  const plan = useLive(useCallback(() => (budgetMin ? safePlan(id, budgetMin) : null), [id, budgetMin]));

  if (!view) {
    return (
      <Screen>
        <Empty>Програму не знайдено</Empty>
      </Screen>
    );
  }

  const start = (skip: string[] = [], extra: string[] = []) => {
    const sessionId = run(() => {
      const sid = startRoutine(appDeps, view.id, { skipRoutineExerciseIds: skip });
      for (const exerciseId of extra) addExercise(appDeps, sid, exerciseId);
      return sid;
    });
    if (sessionId) router.push({ pathname: '/session/[id]', params: { id: sessionId } });
  };

  const fitsById = new Map(plan?.slots.map((s) => [s.routineExerciseId, s.fits]));

  return (
    <Screen>
      <Stack.Screen options={{ title: view.name }} />
      <Muted>
        {view.exercises.length} вправ · ~{Math.ceil(view.estimatedSec / 60)} хв
      </Muted>
      <Button variant="primary" title="Почати" onPress={() => start()} />

      {view.exercises.map((e) => {
        let n = 0;
        const warmTargets = e.targets.filter((t) => t.kind === 'warmup');
        const workTargets = e.targets.filter((t) => t.kind !== 'warmup');
        let warmIndex = 0;
        let workIndex = 0;
        const notFit = fitsById.get(e.routineExerciseId) === false;
        return (
          <Card key={e.routineExerciseId} style={notFit ? { opacity: 0.5 } : undefined}>
            <Row>
              <Title>{e.name}</Title>
              {notFit ? <Text style={{ color: colors.warning, marginLeft: 'auto' }}>не встигну</Text> : null}
            </Row>
            <Muted>
              {e.last
                ? `Минулого разу: ${formatDate(e.last.finishedAt)}, ${sourceLabel(e.last.source, e.last.sessionTitle)}`
                : 'Ще не виконувалась'}
              {` · відпочинок ${formatSeconds(e.restSec)}`}
            </Muted>
            {e.display.map((s) => {
              const label = s.kind === 'working' ? String(++n) : KIND_SHORT[s.kind];
              const t = s.kind === 'warmup' ? warmTargets[warmIndex++] : workTargets[workIndex++];
              const reps = formatReps(t?.repsMin, t?.repsMax);
              return (
                <Row key={s.position}>
                  <Text style={{ width: 24, color: s.kind === 'working' ? colors.label : colors.warning, fontWeight: '600' }}>{label}</Text>
                  <Text style={{ flex: 1, color: colors.label, fontVariant: ['tabular-nums'] }}>
                    {s.weightKg !== undefined ? `${formatNumber(s.weightKg)} кг` : '— кг'}
                    {reps ? ` × ${reps}` : ''}
                    {t?.durationSec !== undefined ? ` · ${formatSeconds(t.durationSec)}` : ''}
                  </Text>
                </Row>
              );
            })}
          </Card>
        );
      })}

      <Heading>Маю N хвилин</Heading>
      <Card>
        <Row>
          <Muted>Скільки є часу:</Muted>
          <NumberField value={budgetMin ?? undefined} onChange={(v) => setBudgetMin(v && v > 0 ? v : null)} placeholder="60" />
          <Muted>хв</Muted>
        </Row>
        {plan ? (
          <>
            <Muted>
              Вміщається ~{Math.ceil(plan.plannedSec / 60)} з ~{Math.ceil(plan.fullSec / 60)} хв.
              {plan.slots.some((s) => !s.fits) ? ' Не встигну — потраплять у пропущені.' : ' Встигаєш усе.'}
            </Muted>
            {plan.suggestions.length > 0 ? (
              <>
                <Muted>Час лишається — можна додати з пропущених:</Muted>
                <Row style={{ flexWrap: 'wrap' }}>
                  {plan.suggestions.map((s) => (
                    <Chip
                      key={s.exerciseId}
                      label={`${s.name} · ${Math.ceil(s.estimatedSec / 60)} хв`}
                      selected={!excludedSuggestions.has(s.exerciseId)}
                      onPress={() => {
                        const next = new Set(excludedSuggestions);
                        if (next.has(s.exerciseId)) next.delete(s.exerciseId);
                        else next.add(s.exerciseId);
                        setExcludedSuggestions(next);
                      }}
                    />
                  ))}
                </Row>
              </>
            ) : null}
            <Button
              variant="primary"
              title="Почати під цей час"
              onPress={() =>
                start(
                  plan.slots.filter((s) => !s.fits).map((s) => s.routineExerciseId),
                  plan.suggestions.filter((s) => !excludedSuggestions.has(s.exerciseId)).map((s) => s.exerciseId),
                )
              }
            />
          </>
        ) : (
          <Muted>Вкажи хвилини — покажу, що встигнеш, а що піде в пропущені.</Muted>
        )}
      </Card>

      <Heading>Дії</Heading>
      <Button title="Редагувати" onPress={() => router.push({ pathname: '/routine/edit', params: { id: view.id } })} />
      <Button
        title="Дублювати"
        onPress={() => {
          const copy = run(() => duplicateRoutine(appDeps, view.id));
          if (copy) router.replace({ pathname: '/routine/[id]', params: { id: copy } });
        }}
      />
      <Button
        title="Перенести в іншу папку"
        onPress={() => {
          const folders = getFolders(appDeps).filter((f) => f.id !== view.folderId);
          if (folders.length === 0) {
            Alert.alert('Немає інших папок', 'Спершу створи ще одну папку на вкладці «Тренування».');
            return;
          }
          Alert.alert('Перенести в папку', undefined, [
            ...folders.map((f) => ({ text: f.name, onPress: () => run(() => moveRoutine(appDeps, view.id, f.id)) })),
            { text: 'Скасувати', style: 'cancel' as const },
          ]);
        }}
      />
      <Button
        variant="destructive"
        title="Видалити програму"
        onPress={() =>
          confirm('Видалити програму?', 'Історія тренувань і рекорди залишаться.', 'Видалити', () => {
            if (succeeded(() => deleteRoutine(appDeps, view.id))) router.back();
          })
        }
      />
    </Screen>
  );
}

/** План «маю N хвилин»; якщо програму щойно видалили — нічого не показуємо. */
function safePlan(routineId: string, budgetMin: number) {
  try {
    return getRoutineBudgetPlan(appDeps, routineId, budgetMin);
  } catch {
    return null;
  }
}
