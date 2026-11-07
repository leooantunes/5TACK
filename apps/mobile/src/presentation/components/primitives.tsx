import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { colors, fonts, radius, space } from '../theme/tokens';

/* ---------------- Texto ---------------- */

type Variant = 'display' | 'title' | 'heading' | 'label' | 'body' | 'caption' | 'mono' | 'monoLg';

const variants: Record<Variant, TextStyle> = {
  display: { fontFamily: fonts.display, fontSize: 34, letterSpacing: 1, textTransform: 'uppercase', color: colors.text },
  title: { fontFamily: fonts.display, fontSize: 24, letterSpacing: 0.6, textTransform: 'uppercase', color: colors.text },
  heading: { fontFamily: fonts.heading, fontSize: 18, letterSpacing: 0.4, color: colors.text },
  label: { fontFamily: fonts.heading, fontSize: 12, letterSpacing: 1.6, textTransform: 'uppercase', color: colors.textDim },
  body: { fontFamily: fonts.body, fontSize: 16, color: colors.text },
  caption: { fontFamily: fonts.body, fontSize: 13, color: colors.textDim },
  mono: { fontFamily: fonts.mono, fontSize: 13, color: colors.text },
  monoLg: { fontFamily: fonts.monoBold, fontSize: 22, color: colors.text },
};

export function Txt({ variant = 'body', color, style, ...rest }: TextProps & { variant?: Variant; color?: string }) {
  return <Text {...rest} style={[variants[variant], color ? { color } : null, style]} />;
}

/* ---------------- Tela ---------------- */

export function Screen({ children, edges = ['top'], style }: { children: ReactNode; edges?: Edge[]; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={styles.screen}>
      <SafeAreaView edges={edges} style={[{ flex: 1 }, style]}>
        {children}
      </SafeAreaView>
    </View>
  );
}

/* ---------------- Painel HUD com cantoneiras ---------------- */

export function HudPanel({
  children,
  style,
  accent = colors.accent,
  highlighted = false,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  accent?: string;
  highlighted?: boolean;
}) {
  const c = highlighted ? accent : colors.borderHi;
  return (
    <View style={[styles.panel, highlighted && { borderColor: accent + '55' }, style]}>
      <View style={[styles.corner, { top: -1, left: -1, borderTopWidth: 2, borderLeftWidth: 2, borderColor: c }]} />
      <View style={[styles.corner, { top: -1, right: -1, borderTopWidth: 2, borderRightWidth: 2, borderColor: c }]} />
      <View style={[styles.corner, { bottom: -1, left: -1, borderBottomWidth: 2, borderLeftWidth: 2, borderColor: c }]} />
      <View style={[styles.corner, { bottom: -1, right: -1, borderBottomWidth: 2, borderRightWidth: 2, borderColor: c }]} />
      {children}
    </View>
  );
}

/* ---------------- Botões ---------------- */

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  style,
  accessibilityHint,
}: {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}) {
  const isDisabled = disabled || loading;
  const bg = variant === 'primary' ? colors.accent : variant === 'danger' ? colors.dangerDim : 'transparent';
  const border = variant === 'primary' ? colors.accent : variant === 'danger' ? colors.danger : colors.borderHi;
  const fg = variant === 'primary' ? colors.accentText : variant === 'danger' ? colors.danger : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, borderColor: border, opacity: isDisabled ? 0.45 : pressed ? 0.8 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>
      )}
    </Pressable>
  );
}

/* ---------------- Campo de texto ---------------- */

export function Field({ label, error, ...rest }: TextInputProps & { label: string; error?: string | null }) {
  return (
    <View style={{ gap: space.xs }}>
      <Txt variant="label">{label}</Txt>
      <TextInput
        placeholderTextColor={colors.textMute}
        selectionColor={colors.accent}
        {...rest}
        style={[styles.input, error ? { borderColor: colors.danger } : null]}
      />
      {error ? <Txt variant="caption" color={colors.danger}>{error}</Txt> : null}
    </View>
  );
}

/* ---------------- Chip ---------------- */

export function Chip({
  label,
  active,
  onPress,
  color = colors.accent,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  color?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      onPress={onPress}
      style={[styles.chip, active && { backgroundColor: color + '22', borderColor: color }]}
    >
      <Text style={[styles.chipText, active && { color }]}>{label}</Text>
    </Pressable>
  );
}

/* ---------------- Cabeçalho de seção ---------------- */

export function SectionHeader({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionBar} />
      <Txt variant="label" color={colors.text} style={{ flex: 1 }}>
        {title}
      </Txt>
      {right}
    </View>
  );
}

/* ---------------- Logo ---------------- */

export function Logo({ size = 40, subtitle = true }: { size?: number; subtitle?: boolean }) {
  return (
    <View accessibilityRole="header" accessibilityLabel="5TACK, fantasy de CS2">
      <Text style={{ fontFamily: fonts.display, fontSize: size, letterSpacing: 2, color: colors.text, lineHeight: size * 1.05 }}>
        <Text style={{ color: colors.accent }}>5</Text>TACK
      </Text>
      {subtitle ? (
        <Txt variant="label" color={colors.textDim} style={{ marginTop: -2 }}>
          CS2 · Fantasy League
        </Txt>
      ) : null}
    </View>
  );
}

/* ---------------- Estados ---------------- */

export function Loading({ label = 'Carregando…' }: { label?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.accent} size="large" />
      <Txt variant="label" style={{ marginTop: space.md }}>
        {label}
      </Txt>
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.center}>
      <Txt variant="heading" color={colors.danger}>
        Falha na conexão
      </Txt>
      <Txt variant="caption" style={{ textAlign: 'center', marginVertical: space.md }}>
        {message}
      </Txt>
      {onRetry ? <Button title="Tentar de novo" variant="ghost" onPress={onRetry} /> : null}
    </View>
  );
}

export function Banner({ message, tone = 'danger' }: { message: string; tone?: 'danger' | 'success' | 'info' }) {
  const c = tone === 'danger' ? colors.danger : tone === 'success' ? colors.success : colors.ct;
  return (
    <View accessibilityLiveRegion="polite" style={[styles.banner, { borderColor: c, backgroundColor: c + '1A' }]}>
      <Txt variant="caption" color={c}>
        {message}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  panel: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: space.lg,
  },
  corner: { position: 'absolute', width: 10, height: 10 },
  button: {
    minHeight: 52,
    paddingHorizontal: space.xl,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontFamily: fonts.display, fontSize: 16, letterSpacing: 1.8, textTransform: 'uppercase' },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 16,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    borderRadius: 12,
  },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.panel,
  },
  chipText: { fontFamily: fonts.heading, fontSize: 13, letterSpacing: 1, color: colors.textDim, textTransform: 'uppercase' },
  section: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.md, marginTop: space.lg },
  sectionBar: { width: 3, height: 14, backgroundColor: colors.accent },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  banner: { borderWidth: 1, borderRadius: radius.sm, paddingVertical: space.sm, paddingHorizontal: space.md },
});
