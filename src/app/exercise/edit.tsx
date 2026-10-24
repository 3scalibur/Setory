// Власна вправа: створити або змінити (SPEC.md, розділ 10).

import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { EQUIPMENT, EXERCISE_TYPES, MUSCLE_GROUPS, type Equipment, type ExerciseType, type Mechanic, type MuscleGroup } from '@/domain/types';
import { appDeps } from '@/services/app-deps';
import {
  createCustomExercise,
  findSimilarExercises,
  getExerciseCard,
  updateCustomExercise,
  type CustomExerciseInput,
} from '@/services/exerciseService';
import { EQUIPMENT_LABELS, MECHANIC_LABELS, MUSCLE_LABELS, TYPE_LABELS } from '@/ui/format';
import { Button, Chip, Heading, Muted, Row, TextField } from '@/ui/kit';
import { succeeded } from '@/ui/run';
import { Screen } from '@/ui/screen';

export default function ExerciseEditScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [form, setForm] = useState<CustomExerciseInput & { aliasesText: string }>(() => {
    const existing = id ? getExerciseCard(appDeps, id)?.exercise : undefined;
    return existing
      ? {
          name: existing.name,
          type: existing.type,
          mechanic: existing.mechanic,
          equipment: existing.equipment,
          primaryMuscles: existing.primaryMuscles,
          secondaryMuscles: existing.secondaryMuscles,
          instructions: existing.instructions ?? '',
          aliasesText: existing.aliases.join(', '),
        }
      : {
          name: '',
          type: 'weight_reps',
          mechanic: 'isolation',
          equipment: 'machine',
          primaryMuscles: [],
          secondaryMuscles: [],
          instructions: '',
          aliasesText: '',
        };
  });
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const toggle = (list: MuscleGroup[] | undefined, m: MuscleGroup) =>
    list?.includes(m) ? list.filter((x) => x !== m) : [...(list ?? []), m];

  const input = (): CustomExerciseInput => ({
    ...form,
    aliases: form.aliasesText.split(',').map((a) => a.trim()).filter(Boolean),
  });

  const create = () => {
    let newId = '';
    if (succeeded(() => (newId = createCustomExercise(appDeps, input())))) {
      router.replace({ pathname: '/exercise/[id]', params: { id: newId } });
    }
  };

  const save = () => {
    if (id) {
      if (succeeded(() => updateCustomExercise(appDeps, id, input()))) router.back();
      return;
    }
    const similar = findSimilarExercises(appDeps, form.name);
    if (similar.length === 0) {
      create();
      return;
    }
    Alert.alert(
      'Схожа вправа вже є',
      `${similar.map((e) => `«${e.name}»`).join(', ')}. Якщо це та сама вправа, краще використати її — інакше історія роздвоїться.`,
      [
        { text: 'Назад', style: 'cancel' },
        { text: 'Створити все одно', onPress: create },
      ],
    );
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: id ? 'Змінити вправу' : 'Нова вправа' }} />
      <TextField value={form.name} onChangeText={(name) => set({ name })} placeholder="Назва" autoFocus={!id} />
      <TextField value={form.aliasesText} onChangeText={(aliasesText) => set({ aliasesText })} placeholder="Інші назви для пошуку, через кому" />

      <Heading>Тип</Heading>
      <Row style={{ flexWrap: 'wrap' }}>
        {EXERCISE_TYPES.map((t: ExerciseType) => (
          <Chip key={t} label={TYPE_LABELS[t]} selected={form.type === t} onPress={() => set({ type: t })} />
        ))}
      </Row>
      {id ? <Muted>Тип не можна змінити, якщо вправа вже є в історії.</Muted> : null}

      <Heading>Механіка</Heading>
      <Row>
        {(['compound', 'isolation'] as Mechanic[]).map((m) => (
          <Chip key={m} label={MECHANIC_LABELS[m]} selected={form.mechanic === m} onPress={() => set({ mechanic: m })} />
        ))}
      </Row>

      <Heading>Обладнання</Heading>
      <Row style={{ flexWrap: 'wrap' }}>
        {EQUIPMENT.map((e: Equipment) => (
          <Chip key={e} label={EQUIPMENT_LABELS[e]} selected={form.equipment === e} onPress={() => set({ equipment: e })} />
        ))}
      </Row>

      <Heading>Основні м’язи</Heading>
      <Row style={{ flexWrap: 'wrap' }}>
        {MUSCLE_GROUPS.map((m) => (
          <Chip key={m} label={MUSCLE_LABELS[m]} selected={form.primaryMuscles.includes(m)} onPress={() => set({ primaryMuscles: toggle(form.primaryMuscles, m) })} />
        ))}
      </Row>

      <Heading>Допоміжні м’язи</Heading>
      <Row style={{ flexWrap: 'wrap' }}>
        {MUSCLE_GROUPS.filter((m) => !form.primaryMuscles.includes(m)).map((m) => (
          <Chip
            key={m}
            label={MUSCLE_LABELS[m]}
            selected={form.secondaryMuscles?.includes(m) ?? false}
            onPress={() => set({ secondaryMuscles: toggle(form.secondaryMuscles, m) })}
          />
        ))}
      </Row>

      <Heading>Техніка</Heading>
      <TextField value={form.instructions ?? ''} onChangeText={(instructions) => set({ instructions })} placeholder="Необов’язково" multiline />

      <Button variant="primary" title={id ? 'Зберегти' : 'Створити'} onPress={save} />
    </Screen>
  );
}
