// Вкладка «Історія»: завершені тренування, нові зверху.

import { router } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, Text } from 'react-native';

import { appDeps } from '@/services/app-deps';
import { getHistoryList } from '@/services/historyService';
import { colors } from '@/ui/colors';
import { formatDateTime, formatMinutes, plural } from '@/ui/format';
import { Card, Empty, Muted } from '@/ui/kit';
import { Screen } from '@/ui/screen';
import { useLive } from '@/ui/use-live';

export default function HistoryTab() {
  const list = useLive(useCallback(() => getHistoryList(appDeps), []));

  return (
    <Screen title="Історія">
      {list.length === 0 ? <Empty>Тут з’являться завершені тренування</Empty> : null}
      {list.map((s) => (
        <Pressable key={s.id} onPress={() => router.push({ pathname: '/session/[id]', params: { id: s.id } })}>
          <Card>
            <Text style={{ fontSize: 17, fontWeight: '600', color: colors.label }}>
              {s.title}
            </Text>
            <Muted>
              {formatDateTime(s.startedAt)} · {formatMinutes(s.finishedAt - s.startedAt)}
            </Muted>
            {s.exercises.map((e, i) => (
              <Text key={i} style={{ color: colors.label, fontSize: 14 }}>
                {e.name} — {e.workingSets} {plural(e.workingSets, 'підхід', 'підходи', 'підходів')}
              </Text>
            ))}
            {s.exercises.length === 0 ? <Muted>Жодної виконаної вправи</Muted> : null}
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}
