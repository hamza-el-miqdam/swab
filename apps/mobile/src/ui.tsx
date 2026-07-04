/**
 * Minimal shared primitives for the onboarding surfaces. Calm by design
 * (product law 5) and RTL-safe: logical style props only (marginStart, not
 * marginLeft) — Arabic is on the roadmap.
 */
import type { PropsWithChildren } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import { colors, spacing } from './theme';

export function Screen({ children }: PropsWithChildren): React.JSX.Element {
  return <View style={styles.screen}>{children}</View>;
}

export function Brand(): React.JSX.Element {
  return <Text style={styles.brand}>swab · صواب</Text>;
}

export function Title({ children }: PropsWithChildren): React.JSX.Element {
  return (
    <Text accessibilityRole="header" style={styles.title}>
      {children}
    </Text>
  );
}

export function Body({ children }: PropsWithChildren): React.JSX.Element {
  return <Text style={styles.body}>{children}</Text>;
}

interface ButtonProps {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'ghost';
  disabled?: boolean;
}

export function Button({
  label,
  onPress,
  kind = 'primary',
  disabled = false,
}: ButtonProps): React.JSX.Element {
  const primary = kind === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        primary ? styles.buttonPrimary : styles.buttonGhost,
        pressed && styles.buttonPressed,
        disabled && styles.buttonDisabled,
      ]}
    >
      <Text style={primary ? styles.buttonPrimaryText : styles.buttonGhostText}>{label}</Text>
    </Pressable>
  );
}

export function Field(props: TextInputProps): React.JSX.Element {
  return (
    <TextInput
      placeholderTextColor={colors.textDim}
      style={styles.field}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.xl,
    gap: spacing.m,
  },
  brand: {
    color: colors.textDim,
    fontSize: 14,
    letterSpacing: 1,
  },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '500',
    lineHeight: 36,
  },
  body: {
    color: colors.textDim,
    fontSize: 15,
    lineHeight: 22,
  },
  button: {
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: spacing.l,
    alignItems: 'center',
  },
  buttonPrimary: { backgroundColor: colors.accent },
  buttonGhost: { borderWidth: 1, borderColor: colors.line },
  buttonPressed: { opacity: 0.85 },
  buttonDisabled: { opacity: 0.4 },
  buttonPrimaryText: { color: colors.accentInk, fontSize: 16, fontWeight: '600' },
  buttonGhostText: { color: colors.text, fontSize: 16 },
  field: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    color: colors.text,
    fontSize: 18,
    paddingHorizontal: spacing.m,
    paddingVertical: 12,
    backgroundColor: colors.surface,
  },
});
