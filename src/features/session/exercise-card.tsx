// Одна вправа в тренуванні: заголовок, «Минулого разу», ціль, таблиця підходів, дії.

import { router } from 'expo-router';
import { Alert, Pressable, Text, View } from 'react-native';

import {
  addSet,
  completeSet,
  moveExercise,
  removeSet,
  skipExercise,
  uncompleteSet,
  updateSet,
} from '@/services/sessionService';
import { appDeps } from '@/services/app-deps';
import type { SessionExerciseView, SessionSetView } from '@/services/sessionView';
import { colors } from '@/ui/colors';
import {
  formatDate,
  formatSeconds,
  formatSet,
  formatTarget,
  KIND_SHORT,
  musclesText,
  NEXT_KIND,
  PR_LABELS,
  sourceLabel,
} from '@/ui/format';
import { Button, Card, Muted, NumberField, Row } from '@/ui/kit';
import { confirm, run } from '@/ui/run';

import { columnsFor } from './columns';

export function ExerciseCard({
  exercise,
  index,
  count,
}: {
  exercise: SessionExerciseView;
  index: number;
  count: number;
}) {
  const columns = columnsFor(exercise.type);
  const target = formatTarget(exercise.targets);
  let workingNumber = 0;

  return (
    <Card>
      <Pressable onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: exercise.exerciseId } })}>
        <Text style={{ fontSize: 17, fontWeight: '600', color: colors.accent }}>{exercise.name}</Text>
      </Pressable>
      <Muted>{musclesText(exercise.primaryMuscles)}</Muted>
      {exercise.last ? (
        <Muted>
          Минулого разу: {formatDate(exercise.last.finishedAt)}, {sourceLabel(exercise.last.source, exercise.last.sessionTitle)}
        </Muted>
      ) : (
        <Muted>Ще не виконувалась</Muted>
      )}
      {target || exercise.restSec ? (
        <Muted>
          {[target, exercise.restSec ? `відпочинок ${formatSeconds(exercise.restSec)}` : null].filter(Boolean).join(' · ')}
        </Muted>
      ) : null}

      <Row style={{ paddingTop: 4 }}>
        <Text style={{ width: 32, color: colors.secondaryLabel, fontSize: 12, textAlign: 'center' }}>№</Text>
        <Text style={{ flex: 1, color: colors.secondaryLabel, fontSize: 12 }}>Попереднє</Text>
        {columns.map((c) => (
          <Text key={c.field} style={{ width: 64, color: colors.secondaryLabel, fontSize: 12, textAlign: 'center' }}>
            {c.label}
          </Text>
        ))}
        <View style={{ width: 40 }} />
        <View style={{ width: 24 }} />
      </Row>

      {exercise.sets.map((set) => {
        const label = set.kind === 'working' ? String(++workingNumber) : KIND_SHORT[set.kind];
        return <SetRow key={set.id} set={set} label={label} exercise={exercise} />;
      })}

      <Row style={{ flexWrap: 'wrap', paddingTop: 4 }}>
        <Button small title="+ Підхід" onPress={() => run(() => addSet(appDeps, exercise.id))} />
        <Button
          small
          title="Замінити"
          onPress={() =>
            router.push({ pathname: '/pick-exercise', params: { mode: 'replace', sessionExerciseId: exercise.id } })
          }
        />
        <Button
          small
          variant="destructive"
          title="Прибрати"
          onPress={() =>
            confirm(
              'Прибрати вправу?',
              exercise.routineExerciseId
                ? 'Вона потрапить у пропущені, якщо не зробиш її пізніше.'
                : 'Підходи цієї вправи буде видалено.',
              'Прибрати',
              () => run(() => skipExercise(appDeps, exercise.id)),
            )
          }
        />
        {index > 0 ? <Button small title="↑" onPress={() => run(() => moveExercise(appDeps, exercise.id, index - 1))} /> : null}
        {index < count - 1 ? (
          <Button small title="↓" onPress={() => run(() => moveExercise(appDeps, exercise.id, index + 1))} />
        ) : null}
      </Row>
    </Card>
  );
}

function SetRow({ set, label, exercise }: { set: SessionSetView; label: string; exercise: SessionExerciseView }) {
  const columns = columnsFor(exercise.type);
  const previous = set.previous;

  return (
    <Row
      style={{
        backgroundColor: set.completed ? 'rgba(52, 199, 89, 0.15)' : 'transparent',
        borderRadius: 8,
        paddingVertical: 2,
      }}
    >
      <Pressable
        onPress={() => run(() => updateSet(appDeps, set.id, { kind: NEXT_KIND[set.kind] }))}
        style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: colors.fill, alignItems: 'center', justifyContent: 'center' }}
      >
        <Text style={{ color: set.kind === 'working' ? colors.label : colors.warning, fontWeight: '600' }}>{label}</Text>
      </Pressable>

      <Pressable
        style={{ flex: 1 }}
        disabled={!previous}
        onPress={() =>
          previous &&
          run(() =>
            updateSet(appDeps, set.id, {
              weightKg: previous.weightKg ?? null,
              reps: previous.reps ?? null,
              durationSec: previous.durationSec ?? null,
              distanceM: previous.distanceM ?? null,
            }),
          )
        }
      >
        <Text numberOfLines={1} style={{ color: colors.secondaryLabel, fontSize: 13, fontVariant: ['tabular-nums'] }}>
          {previous ? formatSet(previous, exercise.type) : '—'}
          {set.mark === 'pr' ? <Text style={{ color: colors.warning }}> 🏆</Text> : null}
          {set.mark === 'up' ? <Text style={{ color: colors.success, fontWeight: '700' }}> ↑</Text> : null}
        </Text>
      </Pressable>

      {columns.map((c) => (
        <NumberField
          key={c.field}
          label={`${c.label}, підхід ${label}`}
          value={set[c.field]}
          decimal={c.decimal}
          onChange={(value) => run(() => updateSet(appDeps, set.id, { [c.field]: value }))}
        />
      ))}

      <Pressable
        accessibilityLabel={set.completed ? 'Зняти позначку' : 'Позначити виконаним'}
        onPress={() => run(() => (set.completed ? uncompleteSet(appDeps, set.id) : completeSet(appDeps, set.id)))}
        onLongPress={() => set.prs.length > 0 && Alert.alert('Рекорд 🏆', set.prs.map((p) => PR_LABELS[p]).join('\n'))}
        style={{
          width: 40,
          height: 32,
          borderRadius: 8,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: set.completed ? colors.success : colors.fill,
        }}
      >
        <Text style={{ color: set.completed ? '#ffffff' : colors.secondaryLabel, fontWeight: '700' }}>✓</Text>
      </Pressable>

      <Pressable
        accessibilityLabel="Видалити підхід"
        onPress={() => run(() => removeSet(appDeps, set.id))}
        style={{ width: 24, alignItems: 'center' }}
      >
        <Text style={{ color: colors.tertiaryLabel, fontSize: 18 }}>×</Text>
      </Pressable>
    </Row>
  );
}
