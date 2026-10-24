// День пропущених (SPEC.md, розділ 9): пропозиція під бюджет часу, яку можна відредагувати перед стартом.

import { router } from 'expo-router';
import { useCallback, useState } from 'react';

import { CONFIG } from '@/config';
import { appDeps } from '@/services/app-deps';
import { getBacklog, getBacklogEstimates, getCatchUpPlan, type CatchUpPlanItem } from '@/services/backlogService';
import { getWorkoutTab } from '@/services/routineService';
import { startCatchUp, startRoutine } from '@/services/sessionService';
import { Body, Button, Card, Empty, Heading, Muted, NumberField, Row, Title } from '@/ui/kit';
import { run } from '@/ui/run';
import { Screen } from '@/ui/screen';
import { useLive } from '@/ui/use-live';

export default function CatchUpScreen() {
  const [budget, setBudget] = useState<number>(CONFIG.CATCHUP_DEFAULT_BUDGET_MIN);
  // null — показуємо пропозицію як є; масив — користувач уже щось змінив.
  const [edited, setEdited] = useState<CatchUpPlanItem[] | null>(null);
  const plan = useLive(useCallback(() => getCatchUpPlan(appDeps, budget), [budget]));
  const backlog = useLive(useCallback(() => getBacklog(appDeps), []));
  const estimates = useLive(useCallback(() => getBacklogEstimates(appDeps), []));
  const next = useLive(useCallback(() => getWorkoutTab(appDeps).next, []));

  const items = edited ?? plan.items;
  const totalMin = Math.ceil(items.reduce((sum, i) => sum + i.estimatedSec, 0) / 60);
  const chosen = new Set(items.map((i) => i.exerciseId));
  const rest = backlog.filter((b) => !chosen.has(b.exerciseId));

  if (backlog.length === 0) {
    return (
      <Screen>
        <Empty>Пропущених немає</Empty>
        {next ? (
          <Button
            variant="primary"
            title={`Почати «${next.name}»`}
            onPress={() => {
              const id = run(() => startRoutine(appDeps, next.routineId));
              if (id) router.replace({ pathname: '/session/[id]', params: { id } });
            }}
          />
        ) : null}
      </Screen>
    );
  }

  const move = (index: number, delta: number) => {
    const list = [...items];
    const [item] = list.splice(index, 1);
    list.splice(index + delta, 0, item);
    setEdited(list);
  };

  return (
    <Screen>
      <Card>
        <Row>
          <Muted>Маю часу:</Muted>
          <NumberField
            value={budget}
            onChange={(v) => {
              if (v && v > 0) {
                setBudget(v);
                setEdited(null);
              }
            }}
          />
          <Muted>хв</Muted>
        </Row>
        <Title>
          {items.length} вправ · ~{totalMin} хв
        </Title>
      </Card>

      {items.length === 0 ? <Empty>Нічого не вміщається — збільш час або додай вправу нижче</Empty> : null}
      {items.map((item, index) => (
        <Card key={item.exerciseId}>
          <Row>
            <Body>{item.name}</Body>
            <Muted>~{Math.ceil(item.estimatedSec / 60)} хв</Muted>
          </Row>
          <Row>
            {index > 0 ? <Button small title="↑" onPress={() => move(index, -1)} /> : null}
            {index < items.length - 1 ? <Button small title="↓" onPress={() => move(index, 1)} /> : null}
            <Button small variant="destructive" title="Прибрати" onPress={() => setEdited(items.filter((i) => i.exerciseId !== item.exerciseId))} />
          </Row>
        </Card>
      ))}

      <Button
        variant="primary"
        title="Почати"
        disabled={items.length === 0}
        onPress={() => {
          const id = run(() => startCatchUp(appDeps, items));
          if (id) router.replace({ pathname: '/session/[id]', params: { id } });
        }}
      />

      {rest.length > 0 ? (
        <>
          <Heading>Ще пропущені</Heading>
          {rest.map((b) => (
            <Card key={b.exerciseId}>
              <Row>
                <Body>{b.name}</Body>
                <Row style={{ marginLeft: 'auto' }}>
                  <Button
                    small
                    title="Додати"
                    onPress={() =>
                      setEdited([
                        ...items,
                        { exerciseId: b.exerciseId, name: b.name, estimatedSec: estimates.get(b.exerciseId) ?? 0, targets: b.targets, restSec: b.restSec },
                      ])
                    }
                  />
                </Row>
              </Row>
            </Card>
          ))}
        </>
      ) : null}
    </Screen>
  );
}
