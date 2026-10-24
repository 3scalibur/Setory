// Вкладка «Вправи»: пошук — головний вхід до окремої вправи (SPEC.md, розділ 10).

import { router } from 'expo-router';
import { useCallback } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ExerciseSearchList } from '@/features/exercise-search/exercise-search-list';
import { appDeps } from '@/services/app-deps';
import { hasActiveSession, startSingleExercise } from '@/services/sessionService';
import { colors } from '@/ui/colors';
import { Button, Row } from '@/ui/kit';
import { run } from '@/ui/run';
import { useLive } from '@/ui/use-live';

export default function ExercisesTab() {
  const insets = useSafeAreaInsets();
  const hasActive = useLive(useCallback(() => hasActiveSession(appDeps), []));

  return (
    <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: colors.background }}>
      <ExerciseSearchList
        header={
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 32, fontWeight: '700', color: colors.label }}>Вправи</Text>
            <Button small variant="plain" title="+ Власна" onPress={() => router.push('/exercise/edit')} />
          </Row>
        }
        onPress={(e) => router.push({ pathname: '/exercise/[id]', params: { id: e.id } })}
        right={(e) => (
          <Button
            small
            variant={hasActive ? 'secondary' : 'primary'}
            title={hasActive ? 'Додати' : 'Виконати'}
            onPress={() => {
              const started = run(() => startSingleExercise(appDeps, e.id));
              if (started) router.push({ pathname: '/session/[id]', params: { id: started.sessionId } });
            }}
          />
        )}
      />
    </View>
  );
}
