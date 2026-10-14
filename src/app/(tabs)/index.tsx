import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { StyleSheet, Text, View } from 'react-native';

import { exerciseCountQuery } from '@/data/exercises';
import { foldersQuery } from '@/data/folders';
import { db } from '@/db/client';
import { Muted, Screen } from '@/ui/screen';
import { useColors } from '@/ui/theme';

// Етап 2: технічний екран, який показує, що база створилась і каталог завантажився.
// Повна вкладка «Тренування» (SPEC.md, розділ 10б) — етап 5.
export default function WorkoutTab() {
  const colors = useColors();
  const { data: countRows } = useLiveQuery(exerciseCountQuery(db));
  const { data: folderRows } = useLiveQuery(foldersQuery(db));

  return (
    <Screen title="Тренування">
      <Muted>Вправ у каталозі: {countRows[0]?.n ?? 0}</Muted>
      {folderRows.map((folder) => (
        <View key={folder.id} style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>{folder.name}</Text>
          {folder.isActive ? <Muted>Активна папка</Muted> : null}
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 12, padding: 16, gap: 4 },
  cardTitle: { fontSize: 17, fontWeight: '600' },
});
