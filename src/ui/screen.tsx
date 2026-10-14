import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useColors } from './theme';

/** Базовий екран: безпечні відступи, прокрутка і заголовок. */
export function Screen({ title, children }: { title: string; children?: ReactNode }) {
  const colors = useColors();
  return (
    <SafeAreaView edges={['top']} style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Muted({ children }: { children: ReactNode }) {
  const colors = useColors();
  return <Text style={[styles.muted, { color: colors.textSecondary }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 16, gap: 12 },
  title: { fontSize: 32, fontWeight: '700' },
  muted: { fontSize: 15 },
});
