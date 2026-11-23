import { useEffect, useRef, useState, type ComponentRef } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { inputStyles, useInputFrame } from './form-controls';
import { font, radius, TOUCH } from './theme';

const ITEM = 18;
/** The wheel fits in an ordinary input row and keeps a full touch target. */
export const WHEEL_HEIGHT = TOUCH;
const CENTER_INSET = (WHEEL_HEIGHT - ITEM) / 2;
/** Pixels of mouse-wheel travel per number on web. */
const NOTCH = 100;
const web = Platform.OS === 'web';

/**
 * An iPhone-style scroll wheel for picking a whole number: scroll (or swipe) until the number
 * sits in the highlighted band, or tap a neighbour. Arrow keys and screen-reader adjust actions
 * move it by one row. With `step`, the rows are min, min+step, … (e.g. 0, 5, 10 … 50).
 */
export function NumberWheel({ value, onChange, min, max, step = 1, label, width = 64 }: {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  /** Gap between rows; values snap to it. */
  step?: number;
  /** What the number is, for screen readers ("Repeat every how many weeks"). */
  label: string;
  width?: number;
}) {
  const { palette: p, frame, focusHandlers } = useInputFrame();
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const last = min + Math.floor((max - min) / step) * step;
  const clamp = (n: number) => Math.min(last, Math.max(min, Number.isFinite(n) ? min + Math.round((n - min) / step) * step : min));
  const current = clamp(value);
  const [centered, setCentered] = useState(current);
  // The value this wheel last reported, so our own changes don't scroll it again.
  const reported = useRef(current);
  const previousMin = useRef(min);

  // While the wheel animates to a value it already chose (keys, taps, outside changes), scroll
  // events only move the highlight; committing them could land on a stale in-between row.
  const gliding = useRef<{ to: number; until: number } | null>(null);
  const scrollToValue = (n: number, animated: boolean) => {
    gliding.current = animated ? { to: n, until: Date.now() + 1000 } : null;
    scroller.current?.scrollTo({ y: ((n - min) / step) * ITEM, animated });
  };

  useEffect(() => {
    const movedStart = previousMin.current !== min;
    previousMin.current = min;
    if (current === reported.current && !movedStart) return;
    if (settle.current) clearTimeout(settle.current);
    reported.current = current;
    setCentered(current);
    scrollToValue(current, !movedStart);
    // scrollToValue only reads refs and props; re-run when the value changes from outside.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, min]);

  useEffect(() => () => {
    if (settle.current) clearTimeout(settle.current);
  }, []);

  // Web: one mouse-wheel notch moves one number (the browser would jump several rows); small
  // trackpad deltas add up. Needs a non-passive listener so the page doesn't scroll as well.
  const box = useRef<ComponentRef<typeof View>>(null);
  const stepRef = useRef<(delta: number) => void>(() => {});
  useEffect(() => {
    const node = box.current as unknown as HTMLElement | null;
    if (!web || !node?.addEventListener) return;
    let pending = 0;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      // A mouse notch is about 100px (or 3 lines); trackpads send many small deltas.
      pending += e.deltaMode === 0 ? e.deltaY : e.deltaY * (NOTCH / 3);
      if (Math.abs(pending) < NOTCH / 2) return;
      const steps = Math.max(1, Math.round(Math.abs(pending) / NOTCH));
      stepRef.current(pending > 0 ? steps : -steps);
      pending = 0;
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, []);

  const commit = (n: number) => {
    const next = clamp(n);
    setCentered(next);
    if (next !== reported.current) {
      reported.current = next;
      onChange(next);
    }
  };

  const fromOffset = (y: number) => clamp(min + Math.round(y / ITEM) * step);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    setCentered(fromOffset(y));
    const glide = gliding.current;
    if (glide) {
      if (fromOffset(y) === glide.to || Date.now() > glide.until) gliding.current = null;
      if (settle.current) clearTimeout(settle.current);
      return;
    }
    if (web) {
      // Browsers have no momentum-end event: commit once scrolling has paused.
      if (settle.current) clearTimeout(settle.current);
      settle.current = setTimeout(() => commit(fromOffset(y)), 140);
    }
  };
  const onEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => commit(fromOffset(e.nativeEvent.contentOffset.y));

  /** Moves by `rows` rows (each one `step` apart). */
  const move = (rows: number) => {
    const next = clamp(reported.current + rows * step);
    commit(next);
    scrollToValue(next, true);
  };
  useEffect(() => {
    stepRef.current = move;
  });

  // Web-only props (keyboard focus and arrow keys); React Native's View types don't describe them.
  const keys: object = web
    ? {
        focusable: true,
        ...focusHandlers,
        onKeyDown: (e: { key: string; preventDefault: () => void }) => {
          const delta = { ArrowUp: -1, ArrowDown: 1, PageUp: -5, PageDown: 5 }[e.key];
          if (delta !== undefined) {
            e.preventDefault();
            move(delta);
          } else if (e.key === 'Home' || e.key === 'End') {
            e.preventDefault();
            move(((e.key === 'Home' ? min : last) - current) / step);
          }
        },
      }
    : {};

  const values = Array.from({ length: (last - min) / step + 1 }, (_, i) => min + i * step);

  return (
    <View
      ref={box}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min, max: last, now: current }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => move(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
      {...(web ? { role: 'spinbutton' as const, 'aria-valuenow': current, 'aria-valuemin': min, 'aria-valuemax': last } : {})}
      {...keys}
      style={[inputStyles.frame, styles.wheel, { width }]}>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, inputStyles.frame, frame]} />
      <View pointerEvents="none" style={[styles.band, { backgroundColor: p.input.selection }]} />
      <ScrollView
        ref={scroller}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        snapToInterval={ITEM}
        decelerationRate="fast"
        scrollEventThrottle={16}
        onScroll={onScroll}
        onMomentumScrollEnd={onEnd}
        onScrollEndDrag={(e) => {
          // No fling: settle here (with one, momentum end does).
          if (!e.nativeEvent.velocity || Math.abs(e.nativeEvent.velocity.y) < 0.05) onEnd(e);
        }}
        onLayout={() => scrollToValue(current, false)}
        style={web ? webStyles.snap : undefined}
        contentContainerStyle={styles.items}>
        {values.map((n) => {
          const distance = Math.abs(n - centered) / step;
          return (
            <Pressable
              key={n}
              aria-hidden
              focusable={false}
              onPress={() => {
                commit(n);
                scrollToValue(n, true);
              }}
              style={[styles.item, web && webStyles.snapItem]}>
              <Text
                style={[
                  styles.text,
                  { color: distance === 0 ? p.ink : p.muted, opacity: distance === 0 ? 1 : distance === 1 ? 0.65 : 0.3 },
                  distance === 0 && styles.selected,
                ]}>
                {n}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wheel: { height: WHEEL_HEIGHT, overflow: 'hidden' },
  band: { position: 'absolute', left: 4, right: 4, top: CENTER_INSET, height: ITEM, borderRadius: radius.sm / 2 },
  items: { paddingVertical: CENTER_INSET },
  item: { height: ITEM, alignItems: 'center', justifyContent: 'center' },
  text: { fontSize: 11, lineHeight: 12, fontFamily: font.regular, fontVariant: ['tabular-nums'], includeFontPadding: false },
  selected: { fontSize: 16, lineHeight: ITEM, fontFamily: font.bold },
});

// react-native-web has no snapToInterval; CSS scroll snapping does the same job (web-only styles).
const webStyles = {
  snap: { scrollSnapType: 'y mandatory' } as object,
  snapItem: { scrollSnapAlign: 'center' } as object,
};
