import type { ReactNode } from 'react';
import { ScrollView, Text } from 'react-native';

import { colors } from './colors';

/**
 * Базовий екран з прокруткою. На екранах стеку заголовок задає Stack.Screen,
 * на вкладках (без заголовка стеку) — проп title.
 */
export function Screen({ title, children }: { title?: string; children?: ReactNode }) {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 48 }}
    >
      {title ? <Text style={{ fontSize: 32, fontWeight: '700', color: colors.label }}>{title}</Text> : null}
      {children}
    </ScrollView>
  );
}
