import { useEffect, useLayoutEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { Animated, PanResponder, Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Ionicons, T } from './components';
import { nativeDriver, useReducedMotion } from './motion';
import { font, space, usePalette } from './theme';

/** Web: keep vertical page scrolling on touch screens, and stop mouse drags from selecting text. */
const webDrag = (Platform.OS === 'web' ? { touchAction: 'pan-y', userSelect: 'none', cursor: 'grab' } : {}) as unknown as ViewStyle;

/**
 * Row you drag to the right to log one more. A deliberate swipe past ~45% of the width is
 * needed, so a stray tap can't count. Taps still reach the children (e.g. to open the editor).
 * Screen readers get an "activate" action instead of the gesture.
 */
export function SwipeToLog({
  enabled,
  onLog,
  label,
  borderRadius,
  style,
  children,
}: {
  enabled: boolean;
  onLog: () => void;
  /** Read out by screen readers, e.g. "Log one Go to the gym". */
  label: string;
  borderRadius: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const p = usePalette();
  const reduced = useReducedMotion();
  const [x] = useState(() => new Animated.Value(0));
  const [armed, setArmed] = useState(false);
  const width = useRef(0);
  // PanResponder is created once, so it reads the latest props through this ref.
  const latest = useRef({ enabled, onLog, reduced });
  useLayoutEffect(() => {
    latest.current = { enabled, onLog, reduced };
  });
  const armedRef = useRef(false);
  // Web: a mouse drag that starts and ends on the row still fires a click, which would open
  // the editor. Swallow that one click (capture phase, before React's root listener sees it).
  const dragged = useRef(false);
  const content = useRef<ComponentRef<typeof View>>(null);
  useEffect(() => {
    const node = content.current as unknown as HTMLElement | null;
    if (Platform.OS !== 'web' || !node?.addEventListener) return;
    const swallow = (e: Event) => {
      if (!dragged.current) return;
      dragged.current = false;
      e.stopPropagation();
      e.preventDefault();
    };
    node.addEventListener('click', swallow, true);
    return () => node.removeEventListener('click', swallow, true);
  }, []);

  const threshold = () => Math.max(96, width.current * 0.45);
  const setArmedOnce = (v: boolean) => {
    if (armedRef.current !== v) {
      armedRef.current = v;
      setArmed(v);
    }
  };
  const settle = () => {
    setArmedOnce(false);
    if (latest.current.reduced) x.setValue(0);
    else Animated.spring(x, { toValue: 0, useNativeDriver: nativeDriver, bounciness: 6 }).start();
  };

  // The handlers only read refs while a gesture is running, never during render.
  // eslint-disable-next-line react-hooks/refs
  const [responder] = useState(() =>
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, g) => latest.current.enabled && g.dx > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onMoveShouldSetPanResponder: (_, g) => latest.current.enabled && g.dx > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        dragged.current = true;
      },
      onPanResponderMove: (_, g) => {
        const dx = Math.max(0, Math.min(g.dx, width.current));
        x.setValue(dx);
        setArmedOnce(dx >= threshold());
      },
      onPanResponderRelease: (_, g) => {
        // A click (if any) follows mouseup immediately; after that, taps work again.
        setTimeout(() => (dragged.current = false), 50);
        if (g.dx < threshold()) return settle();
        setArmedOnce(false);
        const done = () => {
          latest.current.onLog();
          x.setValue(0);
        };
        if (latest.current.reduced) done();
        else Animated.timing(x, { toValue: width.current, duration: 140, useNativeDriver: nativeDriver }).start(done);
      },
      onPanResponderTerminate: settle,
    }),
  );

  const reveal = x.interpolate({ inputRange: [0, 24, 96], outputRange: [0, 0.6, 1], extrapolate: 'clamp' });

  return (
    <View
      style={[{ borderRadius, overflow: 'hidden' }, style]}
      onLayout={(e) => (width.current = e.nativeEvent.layout.width)}
      accessibilityActions={enabled ? [{ name: 'activate', label }] : undefined}
      onAccessibilityAction={(e) => e.nativeEvent.actionName === 'activate' && enabled && onLog()}>
      {enabled && (
        <Animated.View style={[StyleSheet.absoluteFill, styles.track, { backgroundColor: armed ? p.forest : p.mint, opacity: reveal }]}>
          <Ionicons name={armed ? 'checkmark-circle' : 'add-circle-outline'} size={22} color={armed ? p.onForest : p.forest} />
          <T kind="bodyStrong" color={armed ? p.onForest : p.forest} style={{ fontFamily: font.bold }}>
            {armed ? 'Release to log' : '+1'}
          </T>
        </Animated.View>
      )}
      <Animated.View style={[{ transform: [{ translateX: x }] }, enabled && webDrag]} {...(enabled ? responder.panHandlers : {})}>
        <View ref={content}>{children}</View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingLeft: space.lg },
});
