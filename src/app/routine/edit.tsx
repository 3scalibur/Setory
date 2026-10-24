// Конструктор програми: назва, папка, вправи, кожен підхід — окремим рядком (SPEC.md, розділ 10б).

import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import {
  draftStore,
  newKey,
  toEditorDraft,
  useDraft,
  type EditorExercise,
  type EditorSet,
} from '@/features/routine-editor/draft-store';
import type { ExerciseType } from '@/domain/types';
import { appDeps } from '@/services/app-deps';
import { getExerciseBriefs, getLastPerformances } from '@/services/exerciseService';
import { folderForNewRoutine, getFolders } from '@/services/folderService';
import { getRoutineDraft, saveRoutine } from '@/services/routineService';
import { colors } from '@/ui/colors';
import { formatReps, formatSet, KIND_SHORT, NEXT_KIND, parseRepRange } from '@/ui/format';
import { Button, Card, Chip, Empty, Heading, Muted, NumberField, Row, TextField, Title } from '@/ui/kit';
import { run, succeeded } from '@/ui/run';
import { Screen } from '@/ui/screen';
import { useLive } from '@/ui/use-live';

export default function RoutineEditorScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [editorKey] = useState(newKey);
  const stored = useDraft();
  // Показуємо лише чернетку цього екрана — не залишок від попереднього редагування.
  const draft = stored?.editorKey === editorKey ? stored : null;

  useEffect(() => {
    if (id) {
      const existing = getRoutineDraft(appDeps, id);
      if (existing) draftStore.set({ ...toEditorDraft(existing), editorKey });
    } else {
      const folders = getFolders(appDeps);
      const folderId = (folders.find((f) => f.isActive) ?? folders[0])?.id ?? '';
      draftStore.set({ folderId, name: '', exercises: [], editorKey });
    }
  }, [id, editorKey]);

  const folders = useLive(useCallback(() => getFolders(appDeps), []));
  const exerciseIds = draft?.exercises.map((e) => e.exerciseId).join(',') ?? '';
  const briefs = useLive(useCallback(() => getExerciseBriefs(appDeps, exerciseIds.split(',')), [exerciseIds]));
  const lasts = useLive(useCallback(() => getLastPerformances(appDeps, exerciseIds ? exerciseIds.split(',') : []), [exerciseIds]));

  if (!draft) {
    const missing = Boolean(id) && getRoutineDraft(appDeps, id!) === null;
    return <Screen>{missing ? <Empty>Програму не знайдено</Empty> : null}</Screen>;
  }

  const updateExercise = (key: string, fn: (e: EditorExercise) => EditorExercise | null) =>
    draftStore.update((d) => ({
      ...d,
      exercises: d.exercises.map((e) => (e.key === key ? fn(e) : e)).filter((e): e is EditorExercise => e !== null),
    }));

  const move = (index: number, delta: number) =>
    draftStore.update((d) => {
      const list = [...d.exercises];
      const [item] = list.splice(index, 1);
      list.splice(index + delta, 0, item);
      return { ...d, exercises: list };
    });

  const save = () => {
    const ok = succeeded(() => {
      const folderId = draft.folderId || folderForNewRoutine(appDeps);
      const { editorKey: _key, ...routine } = draft;
      saveRoutine(appDeps, { ...routine, folderId });
    });
    if (ok) {
      draftStore.set(null);
      router.back();
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: id ? 'Редагувати програму' : 'Нова програма' }} />
      <TextField value={draft.name} onChangeText={(name) => draftStore.update((d) => ({ ...d, name }))} placeholder="Назва: Push, Pull, Legs…" />

      {folders.length > 1 ? (
        <>
          <Heading>Папка</Heading>
          <Row style={{ flexWrap: 'wrap' }}>
            {folders.map((f) => (
              <Chip key={f.id} label={f.name} selected={draft.folderId === f.id} onPress={() => draftStore.update((d) => ({ ...d, folderId: f.id }))} />
            ))}
          </Row>
        </>
      ) : null}

      <Heading>Вправи</Heading>
      {draft.exercises.length === 0 ? <Empty>Додай вправи з каталогу</Empty> : null}
      {draft.exercises.map((e, index) => {
        const brief = briefs.get(e.exerciseId);
        const type = brief?.type ?? 'weight_reps';
        const last = lasts.get(e.exerciseId);
        let n = 0;
        return (
          <Card key={e.key}>
            <Title>{brief?.name ?? 'Вправа'}</Title>
            {last ? <Muted>Минулого разу: {last.working.map((s) => formatSet(s, type)).join(', ')}</Muted> : null}
            <Row>
              <Muted>Відпочинок, с:</Muted>
              <NumberField
                value={e.restSec}
                placeholder={brief?.mechanic === 'compound' ? '150' : '90'}
                onChange={(v) => updateExercise(e.key, (x) => ({ ...x, restSec: v ?? undefined }))}
              />
            </Row>

            <SetHeader type={type} />
            {e.sets.map((s) => {
              const label = s.kind === 'working' ? String(++n) : KIND_SHORT[s.kind];
              return (
                <SetEditor
                  key={s.key}
                  set={s}
                  label={label}
                  type={type}
                  onChange={(patch) =>
                    updateExercise(e.key, (x) => ({ ...x, sets: x.sets.map((y) => (y.key === s.key ? { ...y, ...patch } : y)) }))
                  }
                  onRemove={() => updateExercise(e.key, (x) => ({ ...x, sets: x.sets.filter((y) => y.key !== s.key) }))}
                />
              );
            })}

            <Row style={{ flexWrap: 'wrap' }}>
              <Button
                small
                title="+ Підхід"
                onPress={() =>
                  updateExercise(e.key, (x) => {
                    const lastSet = x.sets[x.sets.length - 1];
                    return { ...x, sets: [...x.sets, { ...(lastSet ?? { kind: 'working' }), key: newKey() }] };
                  })
                }
              />
              {index > 0 ? <Button small title="↑" onPress={() => move(index, -1)} /> : null}
              {index < draft.exercises.length - 1 ? <Button small title="↓" onPress={() => move(index, 1)} /> : null}
              <Button small variant="destructive" title="Прибрати" onPress={() => updateExercise(e.key, () => null)} />
            </Row>
          </Card>
        );
      })}

      <Button title="+ Додати вправи" onPress={() => router.push({ pathname: '/pick-exercise', params: { mode: 'routine' } })} />
      <Button variant="primary" title="Зберегти" onPress={save} />
      <Button variant="plain" title="Скасувати" onPress={() => run(() => router.back())} />
    </Screen>
  );
}

const usesWeight = (t: ExerciseType) => t === 'weight_reps' || t === 'weighted_bodyweight' || t === 'assisted_bodyweight';
const usesReps = (t: ExerciseType) => usesWeight(t) || t === 'bodyweight_reps';

function SetHeader({ type }: { type: ExerciseType }) {
  const cell = (text: string, width: number) => (
    <Text style={{ width, color: colors.secondaryLabel, fontSize: 12, textAlign: 'center' }}>{text}</Text>
  );
  return (
    <Row>
      {cell('№', 32)}
      {usesWeight(type) ? cell(type === 'assisted_bodyweight' ? 'допомога, кг' : 'кг (старт)', 80) : null}
      {usesReps(type) ? cell('повтори', 80) : null}
      {type === 'distance_duration' ? cell('м', 80) : null}
      {type === 'duration' || type === 'distance_duration' ? cell('сек', 80) : null}
    </Row>
  );
}

function SetEditor({
  set,
  label,
  type,
  onChange,
  onRemove,
}: {
  set: EditorSet;
  label: string;
  type: ExerciseType;
  onChange: (patch: Partial<EditorSet>) => void;
  onRemove: () => void;
}) {
  return (
    <Row>
      <Pressable
        onPress={() => onChange({ kind: NEXT_KIND[set.kind] })}
        style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: colors.fill, alignItems: 'center', justifyContent: 'center' }}
      >
        <Text style={{ color: set.kind === 'working' ? colors.label : colors.warning, fontWeight: '600' }}>{label}</Text>
      </Pressable>
      {usesWeight(type) ? (
        <NumberField width={80} decimal value={set.weightKg} placeholder="—" onChange={(v) => onChange({ weightKg: v ?? undefined })} />
      ) : null}
      {usesReps(type) ? (
        <RepsField repsMin={set.repsMin} repsMax={set.repsMax} onChange={(r) => onChange({ repsMin: r.repsMin, repsMax: r.repsMax })} />
      ) : null}
      {type === 'distance_duration' ? (
        <NumberField width={80} decimal value={set.distanceM} onChange={(v) => onChange({ distanceM: v ?? undefined })} />
      ) : null}
      {type === 'duration' || type === 'distance_duration' ? (
        <NumberField width={80} value={set.durationSec} onChange={(v) => onChange({ durationSec: v ?? undefined })} />
      ) : null}
      <View style={{ flex: 1 }} />
      <Pressable accessibilityLabel="Видалити підхід" onPress={onRemove} style={{ width: 28, alignItems: 'center' }}>
        <Text style={{ color: colors.tertiaryLabel, fontSize: 18 }}>×</Text>
      </Pressable>
    </Row>
  );
}

/** «8» або «8–10». Поки вводиш — показує текст як є, у чернетку пише лише коректний діапазон. */
function RepsField({
  repsMin,
  repsMax,
  onChange,
}: {
  repsMin?: number;
  repsMax?: number;
  onChange: (r: { repsMin?: number; repsMax?: number }) => void;
}) {
  const [text, setText] = useState<string | null>(null);
  const shown = text ?? formatReps(repsMin, repsMax);
  return (
    <TextInput
      value={shown}
      placeholder="8–10"
      placeholderTextColor={colors.tertiaryLabel}
      keyboardType="numbers-and-punctuation"
      onFocus={() => setText(shown)}
      onBlur={() => setText(null)}
      onChangeText={(t) => {
        setText(t);
        const r = parseRepRange(t);
        if (r) onChange(r);
      }}
      style={{
        width: 80,
        textAlign: 'center',
        fontSize: 16,
        color: colors.label,
        backgroundColor: colors.fill,
        borderRadius: 8,
        paddingVertical: 6,
        fontVariant: ['tabular-nums'],
      }}
    />
  );
}
