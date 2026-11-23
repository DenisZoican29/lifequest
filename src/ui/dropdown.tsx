import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Ionicons, T } from './components';
import { InputButton } from './form-controls';
import { radius, space, TOUCH, usePalette } from './theme';

/**
 * A compact select: shows the current choice with a chevron and opens the options right below it.
 * Picking one closes the list.
 */
export function Dropdown<V extends string>({ value, options, onChange, label }: {
  value: V;
  options: { value: V; label: string }[];
  onChange: (value: V) => void;
  /** What the choice is about, for screen readers ("Repeat unit"). */
  label: string;
}) {
  const p = usePalette();
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value)?.label ?? value;

  return (
    <View style={styles.wrap}>
      <InputButton
        accessibilityLabel={`${label}: ${current}`}
        aria-expanded={open}
        active={open}
        style={styles.trigger}
        onPress={() => setOpen((v) => !v)}>
        <T kind="bodyStrong" style={styles.grow}>{current}</T>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={14} color={open ? p.input.accent : p.muted} aria-hidden />
      </InputButton>
      {open && (
        <View role="radiogroup" aria-label={label} style={[styles.menu, { borderColor: p.input.border, backgroundColor: p.input.fill }]}>
          {options.map((o) => {
            const selected = o.value === value;
            return (
              <Pressable
                key={o.value}
                role="radio"
                aria-checked={selected}
                accessibilityLabel={o.label}
                onPress={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                style={({ pressed }) => [styles.option, { backgroundColor: selected || pressed ? p.input.selection : 'transparent' }]}>
                <T kind={selected ? 'bodyStrong' : 'body'} color={p.ink} style={styles.grow}>{o.label}</T>
                {selected && <Ionicons name="checkmark" size={15} color={p.input.accent} aria-hidden />}
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  trigger: { minHeight: TOUCH },
  grow: { flex: 1 },
  menu: { borderWidth: 1, borderRadius: radius.md, padding: space.xs },
  option: { flexDirection: 'row', alignItems: 'center', minHeight: TOUCH, paddingHorizontal: space.sm, borderRadius: radius.sm },
});
