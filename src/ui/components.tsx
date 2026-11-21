/**
 * LifeQuest component kit (design spec §03): flat rounded actions, soft status chips,
 * tinted cards, calm progress. One primary action per screen.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Coin, Mascot, type Mood } from './art';
import { font, radius, softShadow, space, TAB_BAR_SPACE, TOUCH, usePalette, type Palette } from './theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];
export { Ionicons };

// ---------------------------------------------------------------- layout

export function Screen({
  children,
  edges,
  tabs,
  hero,
}: {
  children: ReactNode;
  edges?: ('top' | 'bottom')[];
  /** Reserve room for the bottom tab bar. */
  tabs?: boolean;
  /** Full-bleed content above the padded column. */
  hero?: ReactNode;
}) {
  const p = usePalette();
  return (
    <SafeAreaView edges={edges ?? (hero ? [] : ['top'])} style={{ flex: 1, backgroundColor: p.canvas }}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: tabs ? TAB_BAR_SPACE : space.xxl }}
        keyboardShouldPersistTaps="handled"
        style={{ backgroundColor: p.canvas }}>
        {hero}
        <View style={styles.column}>{children}</View>
      </ScrollView>
    </SafeAreaView>
  );
}

/** Eyebrow + title + subtitle, e.g. "KEEP GOING / Your quests / Choose what to do next." */
export function ScreenHeader({ eyebrow, title, subtitle, right }: { eyebrow?: string; title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.md, marginBottom: space.xs }}>
      <View style={{ flex: 1, gap: 2 }}>
        {eyebrow ? <T kind="eyebrow">{eyebrow}</T> : null}
        <T kind="display" accessibilityRole="header">
          {title}
        </T>
        {subtitle ? <T kind="muted">{subtitle}</T> : null}
      </View>
      {right}
    </View>
  );
}

export type CardTone = 'surface' | 'mint' | 'sky' | 'peach' | 'lavender' | 'cream' | 'rose';

export function toneBg(p: Palette, tone: CardTone): string {
  return { surface: p.surface, mint: p.mint, sky: p.sky, peach: p.peach, lavender: p.lavender, cream: p.cream, rose: p.rose }[tone];
}

export function Card({ children, style, tone = 'surface', hero }: { children: ReactNode; style?: StyleProp<ViewStyle>; tone?: CardTone; hero?: boolean }) {
  const p = usePalette();
  const surface = tone === 'surface';
  return (
    <View
      style={[
        styles.card,
        hero && styles.heroCard,
        { backgroundColor: toneBg(p, tone), borderColor: surface ? p.border : 'transparent' },
        style,
      ]}>
      {children}
    </View>
  );
}

export function Row({ children, style, gap = space.sm }: { children: ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

// ---------------------------------------------------------------- text

type TextKind = 'display' | 'title' | 'h2' | 'h3' | 'big' | 'body' | 'bodyStrong' | 'muted' | 'small' | 'meta' | 'eyebrow';

export function T({
  kind = 'body',
  color,
  style,
  children,
  numberOfLines,
  accessibilityRole,
}: {
  kind?: TextKind;
  color?: string;
  style?: StyleProp<TextStyle>;
  children: ReactNode;
  numberOfLines?: number;
  accessibilityRole?: 'header';
}) {
  const p = usePalette();
  const c = color ?? (kind === 'eyebrow' ? p.forest : kind === 'muted' || kind === 'small' || kind === 'meta' ? p.muted : p.ink);
  return (
    <Text accessibilityRole={accessibilityRole} numberOfLines={numberOfLines} style={[textStyles[kind], { color: c }, style]}>
      {children}
    </Text>
  );
}

export function SectionLabel({ children, right }: { children: string; right?: ReactNode }) {
  return (
    <Row style={{ justifyContent: 'space-between', marginTop: space.md }}>
      <T kind="eyebrow">{children}</T>
      {right}
    </Row>
  );
}

// ---------------------------------------------------------------- actions

export type ButtonKind = 'primary' | 'secondary' | 'tertiary' | 'danger' | 'ghost';

function buttonColors(p: Palette, kind: ButtonKind) {
  return {
    primary: { bg: p.forest, fg: p.onForest, border: p.forest },
    secondary: { bg: p.mint, fg: p.forest, border: p.mint },
    tertiary: { bg: p.surface, fg: p.ink, border: p.border },
    danger: { bg: p.rose, fg: p.roseInk, border: p.rose },
    ghost: { bg: 'transparent', fg: p.forest, border: 'transparent' },
  }[kind];
}

export function Button({
  title,
  onPress,
  kind = 'primary',
  icon,
  disabled,
  compact,
  style,
  accessibilityLabel,
  trailing,
}: {
  title: string;
  onPress: () => void;
  kind?: ButtonKind;
  icon?: IconName;
  disabled?: boolean;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  trailing?: ReactNode;
}) {
  const p = usePalette();
  const c = buttonColors(p, kind);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        { backgroundColor: c.bg, borderColor: c.border, opacity: disabled ? 0.45 : pressed ? 0.85 : 1 },
        style,
      ]}>
      {icon && <Ionicons name={icon} size={compact ? 16 : 18} color={c.fg} />}
      <Text style={[compact ? textStyles.buttonSmall : textStyles.button, { color: c.fg }]}>{title}</Text>
      {trailing}
    </Pressable>
  );
}

export function IconButton({ icon, onPress, label }: { icon: IconName; onPress: () => void; label: string }) {
  const p = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [styles.iconButton, { backgroundColor: p.surface, borderColor: p.border, opacity: pressed ? 0.7 : 1 }]}>
      <Ionicons name={icon} size={20} color={p.ink} />
    </Pressable>
  );
}

/** Selectable filter pill. */
export function Chip({ label, selected, onPress, icon }: { label: string; selected?: boolean; onPress: () => void; icon?: IconName }) {
  const p = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: selected ? p.mint : p.surface, borderColor: selected ? p.mint : p.border, opacity: pressed ? 0.8 : 1 },
      ]}>
      {icon && <Ionicons name={icon} size={15} color={selected ? p.forest : p.muted} />}
      <Text style={[textStyles.chip, { color: selected ? p.forest : p.ink }]}>{label}</Text>
    </Pressable>
  );
}

/** Pill tabs on a white track (Daily · Weekly · Side quests). */
export function Segmented<V extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: V; label: string; count?: number }[];
  value: V;
  onChange: (v: V) => void;
}) {
  const p = usePalette();
  return (
    <View style={[styles.segmented, { backgroundColor: p.surface, borderColor: p.border }]} accessibilityRole="tablist">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o.value)}
            style={[styles.segment, active && { backgroundColor: p.mint }]}>
            <Text numberOfLines={1} style={[textStyles.chip, { color: active ? p.forest : p.muted }]}>
              {o.label}
            </Text>
            {o.count ? (
              <View style={[styles.count, { backgroundColor: active ? p.forest : p.rose }]}>
                <Text style={[textStyles.meta, { color: active ? p.onForest : p.roseInk, fontFamily: font.bold }]}>{o.count}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  numeric,
  hint,
  error,
}: {
  label: string;
  value: string;
  onChangeText: (s: string) => void;
  placeholder?: string;
  multiline?: boolean;
  numeric?: boolean;
  hint?: string;
  error?: string;
}) {
  const p = usePalette();
  return (
    <View style={{ gap: 6, marginBottom: space.md }}>
      <T kind="small" color={p.ink} style={{ fontFamily: font.bold }}>
        {label}
      </T>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={p.faint}
        multiline={multiline}
        keyboardType={numeric ? 'number-pad' : 'default'}
        inputMode={numeric ? 'numeric' : 'text'}
        style={[
          styles.input,
          multiline && { minHeight: 88, textAlignVertical: 'top', paddingTop: space.md },
          { color: p.ink, backgroundColor: p.surface, borderColor: error ? p.roseInk : p.border },
        ]}
      />
      {error ? (
        <T kind="small" color={p.roseInk}>
          {error}
        </T>
      ) : hint ? (
        <T kind="small">{hint}</T>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------- display

export function ProgressBar({ ratio, color, height = 10, track }: { ratio: number; color?: string; height?: number; track?: string }) {
  const p = usePalette();
  const pct = Math.max(0, Math.min(1, ratio)) * 100;
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct) }}
      style={{ height, borderRadius: height, backgroundColor: track ?? p.track, overflow: 'hidden' }}>
      <View style={{ width: `${pct}%`, height: '100%', backgroundColor: color ?? p.forestBright, borderRadius: height }} />
    </View>
  );
}

export type ChipTone = 'due' | 'done' | 'weekly' | 'coins' | 'demo' | 'overdue' | 'neutral' | 'plain';

export function chipColors(p: Palette, tone: ChipTone): [string, string] {
  return {
    due: [p.peach, p.ink],
    done: [p.mint, p.forest],
    weekly: [p.lavender, p.ink],
    coins: [p.cream, p.goldInk],
    demo: [p.sky, p.ink],
    overdue: [p.rose, p.roseInk],
    neutral: [p.track, p.muted],
    plain: [p.surface, p.ink],
  }[tone] as [string, string];
}

/** Status chip. Colour supports the message; the text always states it (spec §03). */
export function StatusChip({ label, tone = 'neutral', icon }: { label: string; tone?: ChipTone; icon?: IconName }) {
  const p = usePalette();
  const [bg, fg] = chipColors(p, tone);
  return (
    <View style={[styles.status, { backgroundColor: bg }]}>
      {icon && <Ionicons name={icon} size={12} color={fg} />}
      <Text style={[textStyles.meta, { color: fg, fontFamily: font.bold }]}>{label}</Text>
    </View>
  );
}

export function CoinAmount({ amount, prefix = '', size = 18 }: { amount: number; prefix?: string; size?: number }) {
  const p = usePalette();
  return (
    <Row gap={5}>
      <Coin size={size} />
      <Text style={[textStyles.coin, { color: p.goldInk, fontSize: size > 20 ? 18 : 14 }]}>
        {prefix}
        {amount}
      </Text>
    </Row>
  );
}

export function IconTile({ icon, bg, color, size = 44 }: { icon: IconName; bg: string; color: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.32, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={icon} size={size * 0.48} color={color} />
    </View>
  );
}

export function EmptyState({ mood = 'happy', title, body, action }: { mood?: Mood; title: string; body?: string; action?: ReactNode }) {
  const p = usePalette();
  return (
    <View style={[styles.empty, { backgroundColor: p.surface, borderColor: p.border }]}>
      <Mascot mood={mood} size={88} />
      <T kind="h3" style={{ textAlign: 'center' }}>
        {title}
      </T>
      {body && (
        <T kind="muted" style={{ textAlign: 'center', maxWidth: 300 }}>
          {body}
        </T>
      )}
      {action}
    </View>
  );
}

/** Visible "Demo mode" label wherever usage or blocking is simulated (spec §10/§11). */
export function DemoBanner({ compact }: { compact?: boolean }) {
  const p = usePalette();
  return (
    <View accessibilityRole="text" style={[styles.demo, { backgroundColor: p.sky }]}>
      <Ionicons name="flask-outline" size={16} color={p.ink} />
      <Text style={[textStyles.small, { color: p.ink, flex: 1 }]}>
        <Text style={{ fontFamily: font.bold }}>Demo mode</Text>
        {compact ? ' · simulated usage, no real apps are blocked.' : ' · Simulated usage — no real apps on your phone or PC are tracked or blocked.'}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------- dialog

export function ConfirmDialog({
  visible,
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
  kind = 'primary',
  busy,
  children,
  art,
}: {
  visible: boolean;
  title: string;
  body?: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  kind?: ButtonKind;
  busy?: boolean;
  children?: ReactNode;
  art?: ReactNode;
}) {
  const p = usePalette();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel} accessibilityLabel="Close dialog">
        <Pressable style={[styles.dialog, { backgroundColor: p.surface }, softShadow(p)]} onPress={() => undefined}>
          {art && <View style={{ alignItems: 'center' }}>{art}</View>}
          <T kind="h2">{title}</T>
          {body && <T kind="muted">{body}</T>}
          {children}
          <View style={{ gap: space.sm, marginTop: space.sm }}>
            <Button title={busy ? 'Working…' : confirmLabel} kind={kind} onPress={onConfirm} disabled={busy} />
            <Button title="Not now" kind="tertiary" onPress={onCancel} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ---------------------------------------------------------------- styles

export const textStyles = StyleSheet.create({
  display: { fontFamily: font.bold, fontSize: 30, lineHeight: 36, letterSpacing: -0.4 },
  title: { fontFamily: font.bold, fontSize: 24, lineHeight: 30 },
  h2: { fontFamily: font.bold, fontSize: 20, lineHeight: 26 },
  h3: { fontFamily: font.bold, fontSize: 17, lineHeight: 23 },
  big: { fontFamily: font.bold, fontSize: 36, lineHeight: 42, letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  body: { fontFamily: font.regular, fontSize: 16, lineHeight: 23 },
  bodyStrong: { fontFamily: font.bold, fontSize: 16, lineHeight: 22 },
  muted: { fontFamily: font.regular, fontSize: 15, lineHeight: 21 },
  small: { fontFamily: font.regular, fontSize: 14, lineHeight: 19 },
  meta: { fontFamily: font.regular, fontSize: 12.5, lineHeight: 17 },
  eyebrow: { fontFamily: font.bold, fontSize: 12.5, letterSpacing: 0.6, textTransform: 'uppercase' },
  chip: { fontFamily: font.bold, fontSize: 14 },
  coin: { fontFamily: font.bold, fontVariant: ['tabular-nums'] },
  button: { fontFamily: font.bold, fontSize: 16 },
  buttonSmall: { fontFamily: font.bold, fontSize: 14 },
});

const styles = StyleSheet.create({
  column: { width: '100%', paddingHorizontal: space.lg + 2, paddingTop: space.lg, gap: space.md },
  card: { borderRadius: radius.lg, padding: space.lg + 2, gap: space.sm, borderWidth: 1 },
  heroCard: { borderRadius: radius.xl, padding: space.xl },
  button: {
    minHeight: 50,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  buttonCompact: { minHeight: TOUCH, paddingHorizontal: space.md, borderRadius: radius.sm },
  iconButton: { width: TOUCH, height: TOUCH, borderRadius: TOUCH / 2, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  chip: { minHeight: 38, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  segmented: { flexDirection: 'row', borderRadius: radius.pill, padding: 4, borderWidth: 1 },
  segment: { flex: 1, flexDirection: 'row', gap: 6, minHeight: TOUCH - 4, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, paddingHorizontal: 6 },
  count: { minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  input: { minHeight: 50, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md + 2, fontSize: 16, fontFamily: font.regular },
  status: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, alignSelf: 'flex-start' },
  empty: { borderWidth: 1, borderRadius: radius.lg, padding: space.xl, alignItems: 'center', gap: space.sm },
  demo: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderRadius: radius.md, paddingHorizontal: space.md + 2, paddingVertical: space.md },
  backdrop: { flex: 1, backgroundColor: 'rgba(39,61,53,0.45)', alignItems: 'center', justifyContent: 'center', padding: space.lg },
  dialog: { width: '100%', maxWidth: 380, borderRadius: radius.xl, padding: space.xl, gap: space.md },
});
