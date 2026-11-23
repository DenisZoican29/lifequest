import { Pressable, StyleSheet, View } from 'react-native';

import { QUEST_COLORS, type QuestColor } from '@/domain/types';

import { Ionicons, T } from './components';
import { radius, space, TOUCH, usePalette } from './theme';

export const questColorName = (color?: QuestColor) => color ? color[0].toUpperCase() + color.slice(1) : 'Default';

export function QuestColorOptions({ value, onChange, defaultLabel = 'Default' }: {
  value?: QuestColor;
  onChange: (color?: QuestColor) => void;
  defaultLabel?: string;
}) {
  const p = usePalette();
  return (
    <View style={styles.options} accessibilityRole="radiogroup" accessibilityLabel="Quest colors">
      {[undefined, ...QUEST_COLORS].map((color) => {
        const selected = value === color;
        const label = color ? questColorName(color) : defaultLabel;
        return (
          <Pressable
            key={color ?? 'default'}
            accessibilityRole="radio"
            aria-checked={selected}
            accessibilityLabel={label}
            onPress={() => onChange(color)}
            style={({ pressed }) => [
              styles.option,
              { borderColor: selected ? p.forest : p.border, backgroundColor: selected ? p.mint : p.surface },
              pressed && styles.pressed,
            ]}>
            <View aria-hidden style={[styles.swatch, { backgroundColor: color ? p.questColors[color] : p.track, borderColor: p.border }]} />
            <T kind="small" color={p.ink}>{label}</T>
            {selected && <Ionicons name="checkmark" size={14} color={p.forest} aria-hidden />}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.xs },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.sm,
    minHeight: TOUCH, borderRadius: radius.sm, borderWidth: 1,
  },
  swatch: { width: 14, height: 14, borderRadius: 7, borderWidth: 1 },
  pressed: { opacity: 0.75 },
});
