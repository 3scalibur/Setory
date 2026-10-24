// Прості будівельні блоки технічного інтерфейсу (дизайн — окремим етапом).

import { useState, type ReactNode } from 'react';
import { Pressable, Text, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors } from './colors';
import { formatNumber, parseNumber } from './format';

// ---------- Текст ----------

export function Title({ children }: { children: ReactNode }) {
  return <Text style={{ fontSize: 17, fontWeight: '600', color: colors.label }}>{children}</Text>;
}

export function Heading({ children }: { children: ReactNode }) {
  return (
    <Text style={{ fontSize: 13, fontWeight: '600', color: colors.secondaryLabel, textTransform: 'uppercase', marginTop: 8 }}>
      {children}
    </Text>
  );
}

export function Body({ children, selectable }: { children: ReactNode; selectable?: boolean }) {
  return (
    <Text selectable={selectable} style={{ fontSize: 15, color: colors.label }}>
      {children}
    </Text>
  );
}

export function Muted({ children }: { children: ReactNode }) {
  return <Text style={{ fontSize: 14, color: colors.secondaryLabel }}>{children}</Text>;
}

// ---------- Контейнери ----------

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ backgroundColor: colors.card, borderRadius: 12, borderCurve: 'continuous', padding: 12, gap: 8 }, style]}>
      {children}
    </View>
  );
}

export function Row({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 8 }, style]}>{children}</View>;
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <Card style={{ alignItems: 'center', paddingVertical: 24 }}>
      <Muted>{children}</Muted>
    </Card>
  );
}

// ---------- Кнопки ----------

type Variant = 'primary' | 'secondary' | 'destructive' | 'plain';

export function Button({
  title,
  onPress,
  variant = 'secondary',
  small,
  disabled,
  flex,
}: {
  title: string;
  onPress: () => void;
  variant?: Variant;
  small?: boolean;
  disabled?: boolean;
  flex?: boolean;
}) {
  const bg = variant === 'primary' ? colors.accent : variant === 'plain' ? 'transparent' : colors.fill;
  const fg = variant === 'primary' ? colors.onAccent : variant === 'destructive' ? colors.danger : colors.accent;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        backgroundColor: bg,
        opacity: disabled ? 0.4 : pressed ? 0.6 : 1,
        paddingVertical: small ? 6 : 12,
        paddingHorizontal: small ? 10 : 16,
        borderRadius: 10,
        borderCurve: 'continuous',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: small ? 32 : 44,
        flex: flex ? 1 : undefined,
      })}
    >
      <Text style={{ color: fg, fontSize: small ? 14 : 16, fontWeight: '600' }}>{title}</Text>
    </Pressable>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 16,
        backgroundColor: selected ? colors.accent : colors.fill,
      }}
    >
      <Text style={{ color: selected ? colors.onAccent : colors.label, fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}

/** Рядок-посилання: заголовок, підпис, натиснути — перейти. */
export function LinkRow({ title, subtitle, onPress, right }: { title: string; subtitle?: string; onPress: () => void; right?: ReactNode }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
      <Row style={{ paddingVertical: 6 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Body>{title}</Body>
          {subtitle ? <Muted>{subtitle}</Muted> : null}
        </View>
        {right}
        <Text style={{ color: colors.tertiaryLabel, fontSize: 18 }}>›</Text>
      </Row>
    </Pressable>
  );
}

// ---------- Поля ----------

/**
 * Числове поле: показує те, що вводиш («62,»), а в БД пише лише коректні числа.
 * Коли поле не в фокусі, показує значення з БД.
 */
export function NumberField({
  value,
  onChange,
  placeholder,
  decimal,
  width = 64,
  label,
}: {
  value: number | undefined;
  onChange: (value: number | null) => void;
  placeholder?: string;
  decimal?: boolean;
  width?: number;
  /** Підпис для VoiceOver і тестів: «кг, підхід 1». */
  label?: string;
}) {
  const [text, setText] = useState<string | null>(null);
  const shown = text ?? (value !== undefined ? formatNumber(value) : '');
  return (
    <TextInput
      accessibilityLabel={label}
      value={shown}
      placeholder={placeholder}
      placeholderTextColor={colors.tertiaryLabel}
      keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
      selectTextOnFocus
      onFocus={() => setText(shown)}
      onBlur={() => setText(null)}
      onChangeText={(t) => {
        setText(t);
        const n = parseNumber(t);
        if (n !== undefined) onChange(n);
      }}
      style={{
        width,
        textAlign: 'center',
        fontSize: 16,
        fontVariant: ['tabular-nums'],
        color: colors.label,
        backgroundColor: colors.fill,
        borderRadius: 8,
        paddingVertical: 6,
      }}
    />
  );
}

export function TextField({
  value,
  onChangeText,
  placeholder,
  autoFocus,
  multiline,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  multiline?: boolean;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.tertiaryLabel}
      autoFocus={autoFocus}
      multiline={multiline}
      clearButtonMode="while-editing"
      style={{
        fontSize: 16,
        color: colors.label,
        backgroundColor: colors.card,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        minHeight: multiline ? 80 : undefined,
      }}
    />
  );
}
