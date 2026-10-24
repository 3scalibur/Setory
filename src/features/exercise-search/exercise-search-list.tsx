// Пошук вправ: поле, фільтр за м'язом, список. Спільний для вкладки «Вправи» і вибору вправи.

import { useCallback, useState, type ReactNode } from 'react';
import { FlatList, Pressable, ScrollView, Text, View } from 'react-native';

import type { ExerciseRow } from '@/data/exercises';
import { MUSCLE_GROUPS, type MuscleGroup } from '@/domain/types';
import { appDeps } from '@/services/app-deps';
import { searchCatalog } from '@/services/exerciseService';
import { colors } from '@/ui/colors';
import { EQUIPMENT_LABELS, MUSCLE_LABELS, musclesText } from '@/ui/format';
import { Chip, Muted, TextField } from '@/ui/kit';
import { useLive } from '@/ui/use-live';

export function ExerciseSearchList({
  onPress,
  right,
  selectedIds,
  header,
  autoFocus,
}: {
  onPress: (exercise: ExerciseRow) => void;
  right?: (exercise: ExerciseRow) => ReactNode;
  selectedIds?: ReadonlySet<string>;
  header?: ReactNode;
  autoFocus?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<MuscleGroup | undefined>();
  const results = useLive(useCallback(() => searchCatalog(appDeps, query, { muscle }), [query, muscle]));

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.background }}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      data={results}
      keyExtractor={(e) => e.id}
      contentContainerStyle={{ paddingBottom: 48 }}
      ListHeaderComponent={
        <View style={{ padding: 16, gap: 10 }}>
          {header}
          <TextField value={query} onChangeText={setQuery} placeholder="Жим лежачи, присед, bench…" autoFocus={autoFocus} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            <Chip label="Усі" selected={!muscle} onPress={() => setMuscle(undefined)} />
            {MUSCLE_GROUPS.map((m) => (
              <Chip key={m} label={MUSCLE_LABELS[m]} selected={muscle === m} onPress={() => setMuscle(muscle === m ? undefined : m)} />
            ))}
          </ScrollView>
        </View>
      }
      ListEmptyComponent={
        <View style={{ padding: 24, alignItems: 'center' }}>
          <Muted>Нічого не знайдено. Можна створити власну вправу.</Muted>
        </View>
      }
      renderItem={({ item }) => {
        const selected = selectedIds?.has(item.id) ?? false;
        return (
          <Pressable
            onPress={() => onPress(item)}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              paddingHorizontal: 16,
              paddingVertical: 10,
              backgroundColor: selected ? colors.fill : 'transparent',
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontSize: 16, color: colors.label }}>
                {selected ? '✓ ' : ''}
                {item.name}
              </Text>
              <Muted>
                {musclesText(item.primaryMuscles)} · {EQUIPMENT_LABELS[item.equipment]}
                {item.isCustom ? ' · власна' : ''}
              </Muted>
            </View>
            {right?.(item)}
          </Pressable>
        );
      }}
    />
  );
}
