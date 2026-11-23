import { useState, type ComponentProps } from 'react';
import { Platform, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { radius, space, TOUCH, usePalette } from './theme';

/** The same surface and focus treatment for typed inputs, pickers, and wheels. */
export function useInputFrame({ active = false, invalid = false }: { active?: boolean; invalid?: boolean } = {}) {
  const palette = usePalette();
  const [focused, setFocused] = useState(false);
  const highlighted = focused || active;

  return {
    palette,
    focusHandlers: {
      onFocus: () => setFocused(true),
      onBlur: () => setFocused(false),
    },
    frame: {
      backgroundColor: highlighted ? palette.surface : palette.input.fill,
      borderColor: invalid ? palette.roseInk : highlighted ? palette.input.accent : palette.input.border,
      borderWidth: highlighted ? 2 : 1,
    },
    highlighted,
  };
}

/** A field that opens a picker or menu. Supply its accessible name and contents. */
export function InputButton({
  children, style, active, invalid, ...props
}: Pick<ComponentProps<typeof Pressable>, 'children' | 'accessibilityLabel' | 'aria-expanded' | 'onPress'> & {
  style?: StyleProp<ViewStyle>;
  active?: boolean;
  invalid?: boolean;
}) {
  const { focusHandlers, frame, highlighted } = useInputFrame({ active, invalid });

  return (
    <Pressable
      {...props}
      {...focusHandlers}
      accessibilityRole="button"
      style={({ pressed }) => [
        inputStyles.frame,
        styles.button,
        frame,
        highlighted && styles.activeInsets,
        style,
        pressed && styles.pressed,
      ]}>
      {children}
    </Pressable>
  );
}

export const inputStyles = StyleSheet.create({
  frame: { borderRadius: radius.md },
  label: { letterSpacing: 0.1 },
  ownFocusOutline: Platform.OS === 'web' ? { outlineWidth: 0 } : {},
});

const styles = StyleSheet.create({
  button: {
    minHeight: TOUCH + 4,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.md,
    paddingVertical: space.xs + 1,
    gap: space.sm,
  },
  activeInsets: { paddingHorizontal: space.md - 1, paddingVertical: space.xs },
  pressed: { opacity: 0.8 },
});
