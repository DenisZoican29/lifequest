import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { Coin } from './art';
import { Ionicons } from './components';
import { nativeDriver, useReducedMotion } from './motion';
import { font, radius, softShadow, space, usePalette } from './theme';

export interface Celebration {
  kind: 'goal' | 'log' | 'complete';
  title: string;
  detail?: string;
  coins?: number;
  progress?: { done: number; total: number };
}

const sparks = [
  { x: -26, y: -16, tilt: -38, size: 5 },
  { x: -21, y: 19, tilt: 32, size: 4 },
  { x: -5, y: -25, tilt: -12, size: 4 },
  { x: 15, y: -23, tilt: 25, size: 5 },
  { x: 30, y: -10, tilt: 50, size: 4 },
  { x: 29, y: 15, tilt: -27, size: 5 },
];

/** Compact success feedback anchored to the existing toast area. */
export function CelebrationCard({ kind, title, detail, coins = 0, progress }: Celebration) {
  const p = usePalette();
  const reduced = useReducedMotion();
  const [motion] = useState(() => new Animated.Value(1));
  const quiet = kind === 'log';
  const color = kind === 'goal' ? p.questColors.blue : p.forest;
  const tint = kind === 'goal' ? p.sky : p.mint;
  const icon = kind === 'goal' ? 'flag' : quiet ? 'checkmark' : 'trophy-outline';

  useEffect(() => {
    motion.setValue(reduced ? 1 : 0);
    if (reduced) return;
    const animation = Animated.timing(motion, {
      toValue: 1,
      duration: quiet ? 340 : 680,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: nativeDriver,
      isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [motion, quiet, reduced]);

  const badgeScale = motion.interpolate({ inputRange: [0, 0.48, 1], outputRange: [0.86, quiet ? 1.08 : 1.15, 1] });
  const sparkOpacity = motion.interpolate({ inputRange: [0, 0.24, 0.65, 1], outputRange: [0, 1, 0.85, 0] });

  return (
    <View testID={`celebration-${kind}`} style={[styles.card, softShadow(p), { backgroundColor: p.surface, borderColor: p.border }]}>
      <View style={styles.row}>
        <View style={styles.badgeSlot} aria-hidden>
          <Animated.View style={[styles.badge, { backgroundColor: tint, transform: [{ scale: badgeScale }] }]}>
            <Ionicons name={icon} size={21} color={color} />
          </Animated.View>
          {!quiet && !reduced && (
            <View testID="celebration-sparks" pointerEvents="none" style={StyleSheet.absoluteFill}>
              {sparks.map(({ x, y, tilt, size }, index) => (
                <Animated.View
                  key={x}
                  style={[
                    styles.spark,
                    {
                      width: size,
                      height: size * 1.55,
                      backgroundColor: index % 2 ? color : p.gold,
                      opacity: sparkOpacity,
                      transform: [
                        { translateX: motion.interpolate({ inputRange: [0, 1], outputRange: [0, x] }) },
                        { translateY: motion.interpolate({ inputRange: [0, 1], outputRange: [0, y] }) },
                        { rotate: `${tilt}deg` },
                      ],
                    },
                  ]}
                />
              ))}
            </View>
          )}
        </View>
        <View style={styles.copy}>
          <Text style={[styles.title, { color: p.ink }]}>{title}</Text>
          {detail && <Text style={[styles.detail, { color: p.muted }]}>{detail}</Text>}
        </View>
        {coins > 0 && (
          <View style={[styles.reward, { backgroundColor: p.cream }]}>
            <View aria-hidden><Coin size={15} /></View>
            <Text accessibilityLabel={`+${coins} ${coins === 1 ? 'coin' : 'coins'}`} style={[styles.rewardText, { color: p.goldInk }]}>+{coins}</Text>
          </View>
        )}
      </View>
      {progress && (
        <View aria-hidden style={[styles.track, { backgroundColor: p.track }]}>
          <Animated.View
            style={[
              styles.fill,
              {
                backgroundColor: color,
                transform: [{
                  scaleX: motion.interpolate({
                    inputRange: [0, 1],
                    outputRange: [(progress.done - 1) / progress.total, progress.done / progress.total],
                  }),
                }],
              },
            ]}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%', maxWidth: 360, borderWidth: 1, borderRadius: radius.lg, padding: space.md, gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  badgeSlot: { width: 38, height: 38 },
  badge: { flex: 1, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  spark: { position: 'absolute', top: 16, left: 17, borderRadius: radius.pill },
  copy: { flex: 1, gap: 2 },
  title: { fontFamily: font.bold, fontSize: 16, lineHeight: 20 },
  detail: { fontFamily: font.regular, fontSize: 13, lineHeight: 17 },
  reward: { flexDirection: 'row', alignItems: 'center', gap: space.xs, borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 6 },
  rewardText: { fontFamily: font.bold, fontSize: 14 },
  track: { height: 4, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { flex: 1, borderRadius: radius.pill, transformOrigin: 'left center' },
});
