// Папка: створити або перейменувати, зробити активною, змінити порядок програм, видалити.

import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';

import { appDeps } from '@/services/app-deps';
import { createFolder, deleteFolder, getFolders, renameFolder, setActiveFolder } from '@/services/folderService';
import { getWorkoutTab, reorderRoutines } from '@/services/routineService';
import { Button, Card, Heading, Muted, Row, TextField, Body } from '@/ui/kit';
import { confirm, run, succeeded } from '@/ui/run';
import { Screen } from '@/ui/screen';
import { useLive } from '@/ui/use-live';

export default function FolderEditScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const folder = useLive(useCallback(() => (id ? getWorkoutTab(appDeps).folders.find((f) => f.id === id) : undefined), [id]));
  const [name, setName] = useState<string | null>(null);
  const shownName = name ?? folder?.name ?? '';

  if (!id) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Нова папка' }} />
        <TextField value={shownName} onChangeText={setName} placeholder="Назва: PPL, Додаткове…" autoFocus />
        <Button
          variant="primary"
          title="Створити"
          onPress={() => {
            if (succeeded(() => createFolder(appDeps, shownName))) router.back();
          }}
        />
      </Screen>
    );
  }

  if (!folder) {
    return (
      <Screen>
        <Muted>Папку не знайдено</Muted>
      </Screen>
    );
  }

  const routineIds = folder.routines.map((r) => r.id);
  const move = (index: number, delta: number) => {
    const next = [...routineIds];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item);
    run(() => reorderRoutines(appDeps, folder.id, next));
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: folder.name }} />
      <Heading>Назва</Heading>
      <TextField value={shownName} onChangeText={setName} />
      {name !== null && name !== folder.name ? (
        <Button
          title="Зберегти назву"
          onPress={() => {
            if (succeeded(() => renameFolder(appDeps, folder.id, name))) setName(null);
          }}
        />
      ) : null}

      <Card>
        {folder.isActive ? (
          <Muted>Активна папка: з неї береться «Наступне» на головному екрані.</Muted>
        ) : (
          <Button title="Зробити активною" onPress={() => run(() => setActiveFolder(appDeps, folder.id))} />
        )}
      </Card>

      <Heading>Порядок програм</Heading>
      <Card>
        {folder.routines.length === 0 ? <Muted>У папці ще немає програм</Muted> : null}
        {folder.routines.map((r, index) => (
          <Row key={r.id}>
            <Body>{r.name}</Body>
            <Row style={{ marginLeft: 'auto' }}>
              {index > 0 ? <Button small title="↑" onPress={() => move(index, -1)} /> : null}
              {index < folder.routines.length - 1 ? <Button small title="↓" onPress={() => move(index, 1)} /> : null}
            </Row>
          </Row>
        ))}
      </Card>

      <Button
        variant="destructive"
        title="Видалити папку"
        onPress={() =>
          confirm(
            'Видалити папку?',
            folder.routines.length > 0
              ? `Разом з нею видаляться програми (${folder.routines.length}). Історія тренувань і рекорди залишаться. Щоб зберегти програму, спершу перенеси її в іншу папку.`
              : 'Історія тренувань не зміниться.',
            'Видалити',
            () => {
              if (succeeded(() => deleteFolder(appDeps, folder.id))) router.back();
            },
          )
        }
      />
      {getFolders(appDeps).length === 1 ? <Muted>Це остання папка. Нова «Мої програми» створиться, коли додаси програму.</Muted> : null}
    </Screen>
  );
}
