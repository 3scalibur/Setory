import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ExerciseSearchList } from '@/features/exercise-search/exercise-search-list';
import { addExercisesToDraft } from '@/features/routine-editor/draft-store';
import { appDeps } from '@/services/app-deps';
import { addExercise, replaceExercise } from '@/services/sessionService';
import { colors } from '@/ui/colors';
import { Button } from '@/ui/kit';
import { succeeded } from '@/ui/run';

type Params = { mode: 'add' | 'replace' | 'routine'; sessionId?: string; sessionExerciseId?: string };

export default function PickExerciseScreen() {
  const { mode, sessionId, sessionExerciseId } = useLocalSearchParams<Params>();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const insets = useSafeAreaInsets();
  const multi = mode === 'routine';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ title: mode === 'replace' ? 'Замінити на…' : multi ? 'Додати вправи' : 'Додати вправу' }} />
      <ExerciseSearchList
        selectedIds={multi ? selected : undefined}
        header={<Button small variant="plain" title="+ Створити власну вправу" onPress={() => router.push('/exercise/edit')} />}
        onPress={(exercise) => {
          if (multi) {
            const next = new Set(selected);
            if (next.has(exercise.id)) next.delete(exercise.id);
            else next.add(exercise.id);
            setSelected(next);
            return;
          }
          const ok = succeeded(() => {
            if (mode === 'replace' && sessionExerciseId) replaceExercise(appDeps, sessionExerciseId, exercise.id);
            else if (sessionId) addExercise(appDeps, sessionId, exercise.id);
          });
          if (ok) router.back();
        }}
      />
      {multi ? (
        <View style={{ padding: 16, paddingBottom: 16 + insets.bottom, backgroundColor: colors.background }}>
          <Button
            variant="primary"
            disabled={selected.size === 0}
            title={`Додати${selected.size > 0 ? ` (${selected.size})` : ''}`}
            onPress={() => {
              addExercisesToDraft([...selected]);
              router.back();
            }}
          />
        </View>
      ) : null}
    </View>
  );
}
