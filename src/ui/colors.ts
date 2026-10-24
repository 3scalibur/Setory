// Системні кольори iOS / Android: самі підлаштовуються під світлу і темну тему.
// Технічна палітра до етапу дизайну.

import { Color } from 'expo-router';
import { Platform } from 'react-native';

export const colors = {
  label: Platform.select({ ios: Color.ios.label, android: Color.android.dynamic.onSurface, default: '#000000' })!,
  secondaryLabel: Platform.select({
    ios: Color.ios.secondaryLabel,
    android: Color.android.dynamic.onSurfaceVariant,
    default: '#3c3c43',
  })!,
  tertiaryLabel: Platform.select({
    ios: Color.ios.tertiaryLabel,
    android: Color.android.dynamic.outline,
    default: '#8e8e93',
  })!,
  background: Platform.select({
    ios: Color.ios.systemGroupedBackground,
    android: Color.android.dynamic.background,
    default: '#f2f2f7',
  })!,
  card: Platform.select({
    ios: Color.ios.secondarySystemGroupedBackground,
    android: Color.android.dynamic.surfaceVariant,
    default: '#ffffff',
  })!,
  fill: Platform.select({
    ios: Color.ios.tertiarySystemFill,
    android: Color.android.dynamic.secondaryContainer,
    default: '#e5e5ea',
  })!,
  separator: Platform.select({
    ios: Color.ios.separator,
    android: Color.android.dynamic.outlineVariant,
    default: '#c6c6c8',
  })!,
  accent: Platform.select({ ios: Color.ios.systemBlue, android: Color.android.dynamic.primary, default: '#007aff' })!,
  onAccent: Platform.select({ ios: '#ffffff', android: Color.android.dynamic.onPrimary, default: '#ffffff' })!,
  success: Platform.select({ ios: Color.ios.systemGreen, android: Color.android.dynamic.tertiary, default: '#34c759' })!,
  danger: Platform.select({ ios: Color.ios.systemRed, android: Color.android.dynamic.error, default: '#ff3b30' })!,
  warning: Platform.select({ ios: Color.ios.systemOrange, android: Color.android.dynamic.tertiary, default: '#ff9500' })!,
};
