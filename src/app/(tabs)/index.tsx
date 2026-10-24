// Вкладка «Тренування» (SPEC.md, розділ 10б): незавершене тренування, «Наступне», пропущені, папки з програмами.

import { router } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { appDeps } from '@/services/app-deps';
import { getWorkoutTab } from '@/services/routineService';
import { discardSession, finishSession, getActiveSessionState, startFree, startRoutine } from '@/services/sessionService';
import { colors } from '@/ui/colors';
import { formatDateTime, formatMinutes } from '@/ui/format';
import { Button, Card, Empty, Heading, Muted, Row, Title } from '@/ui/kit';
import { run } from '@/ui/run';
import { Screen } from '@/ui/screen';
import { useLive } from '@/ui/use-live';

const openSession = (id: string) => router.push({ pathname: '/session/[id]', params: { id } });

export default function WorkoutTab() {
  const tab = useLive(useCallback(() => getWorkoutTab(appDeps), []));
  useStaleSessionPrompt();

  const startRoutineById = (routineId: string) => {
    const sessionId = run(() => startRoutine(appDeps, routineId));
    if (sessionId) openSession(sessionId);
  };

  return (
    <Screen title="Тренування">
      {tab.activeSession ? (
        <Card style={{ borderWidth: 1, borderColor: colors.accent }}>
          <Title>Триває: {tab.activeSession.title}</Title>
          <Muted>Почато {formatMinutes(appDeps.now() - tab.activeSession.startedAt)} тому</Muted>
          <Button variant="primary" title="Продовжити" onPress={() => openSession(tab.activeSession!.id)} />
        </Card>
      ) : null}

      <Row>
        <Button
          flex
          title="Порожнє тренування"
          onPress={() => {
            const id = run(() => startFree(appDeps));
            if (id) openSession(id);
          }}
        />
        <Button flex title="Знайти вправу" onPress={() => router.navigate('/exercises')} />
      </Row>

      {tab.next ? (
        <Card>
          <Muted>Наступне</Muted>
          <Row>
            <Pressable style={{ flex: 1 }} onPress={() => router.push({ pathname: '/routine/[id]', params: { id: tab.next!.routineId } })}>
              <Title>{tab.next.name}</Title>
            </Pressable>
            <Button small variant="primary" title="Почати" onPress={() => startRoutineById(tab.next!.routineId)} />
          </Row>
        </Card>
      ) : null}

      <Card>
        <Pressable onPress={() => router.push('/backlog')}>
          <Row>
            <Text style={{ flex: 1, fontSize: 16, color: colors.label }}>Пропущені вправи</Text>
            <Text style={{ fontSize: 16, color: tab.backlogCount > 0 ? colors.warning : colors.secondaryLabel, fontVariant: ['tabular-nums'] }}>
              {tab.backlogCount}
            </Text>
            <Text style={{ color: colors.tertiaryLabel, fontSize: 18 }}>›</Text>
          </Row>
        </Pressable>
        {tab.catchUp ? (
          <Button title={`День пропущених, ~${tab.catchUp.estimatedMin} хв`} onPress={() => router.push('/catch-up')} />
        ) : null}
      </Card>

      <Row style={{ justifyContent: 'space-between' }}>
        <Heading>Програми</Heading>
        <Row>
          <Button small variant="plain" title="+ Папка" onPress={() => router.push('/folder/edit')} />
          <Button small variant="plain" title="+ Програма" onPress={() => router.push('/routine/edit')} />
        </Row>
      </Row>

      {tab.folders.length === 0 ? <Empty>Створи першу програму</Empty> : null}
      {tab.folders.map((folder) => (
        <Card key={folder.id}>
          <Pressable onPress={() => router.push({ pathname: '/folder/edit', params: { id: folder.id } })}>
            <Row>
              <Text style={{ flex: 1, fontSize: 17, fontWeight: '700', color: colors.label }}>{folder.name}</Text>
              {folder.isActive ? <Muted>активна</Muted> : null}
              <Text style={{ color: colors.accent, fontSize: 18 }}>⋯</Text>
            </Row>
          </Pressable>
          {folder.routines.length === 0 ? <Muted>Порожньо</Muted> : null}
          {folder.routines.map((r) => (
            <View key={r.id} style={{ borderTopWidth: 0.5, borderTopColor: colors.separator, paddingTop: 8 }}>
              <Row>
                <Pressable style={{ flex: 1, gap: 2 }} onPress={() => router.push({ pathname: '/routine/[id]', params: { id: r.id } })}>
                  <Text style={{ fontSize: 16, color: colors.label }}>{r.name}</Text>
                  <Muted>{r.exerciseNames.join(', ') || 'Без вправ'}</Muted>
                </Pressable>
                <Button small title="Почати" onPress={() => startRoutineById(r.id)} />
              </Row>
            </View>
          ))}
        </Card>
      ))}
    </Screen>
  );
}

/** Активне тренування старше 6 год (апка закрилась, сів телефон) → пропонуємо завершити. */
function useStaleSessionPrompt() {
  useEffect(() => {
    const state = getActiveSessionState(appDeps);
    if (!state?.staleFinishAt) return;
    const finishAt = state.staleFinishAt;
    Alert.alert(
      'Незавершене тренування',
      `«${state.title}» досі відкрите. Завершити його часом останнього підходу (${formatDateTime(finishAt)})?`,
      [
        { text: 'Продовжити', onPress: () => openSession(state.sessionId) },
        { text: 'Скасувати тренування', style: 'destructive', onPress: () => run(() => discardSession(appDeps, state.sessionId)) },
        { text: 'Завершити', style: 'default', onPress: () => run(() => finishSession(appDeps, state.sessionId, finishAt)) },
      ],
    );
  }, []);
}
