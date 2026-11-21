/**
 * Original LifeQuest artwork (design spec §01–02): a flat gold coin, the leaf companion
 * ("Sprig"), and the soft sky-and-hills backdrop. Static by design — no idle animation.
 */
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';

import { useIsDark } from './theme';

// ---------------------------------------------------------------- coin

export function Coin({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={11} fill="#F9C766" stroke="#D9A03C" strokeWidth={1.4} />
      <Circle cx={12} cy={12} r={7.2} fill="none" stroke="#D9A03C" strokeWidth={1.1} opacity={0.75} />
    </Svg>
  );
}

// ---------------------------------------------------------------- companion

export type Mood = 'happy' | 'cheer' | 'sleepy' | 'concerned';

const BODY = '#42926A';
const LIMB = '#2F6B4F';
const EYE = '#1F2A26';

/** Sprig, the leaf companion. Use sparingly: onboarding, milestones, empty states. */
export function Mascot({ mood = 'happy', size = 110 }: { mood?: Mood; size?: number }) {
  const label = { happy: 'smiling', cheer: 'cheering', sleepy: 'resting', concerned: 'a little worried' }[mood];
  return (
    <View accessibilityRole="image" accessibilityLabel={`Sprig the leaf companion, ${label}`}>
      <Svg width={size} height={size} viewBox="0 0 120 120">
        <Ellipse cx={60} cy={107} rx={36} ry={6} fill="#2F6B4F" opacity={0.14} />
        {/* arms */}
        {mood === 'cheer' ? (
          <G fill={LIMB}>
            <Ellipse cx={22} cy={46} rx={7} ry={17} transform="rotate(-28 22 46)" />
            <Ellipse cx={98} cy={46} rx={7} ry={17} transform="rotate(28 98 46)" />
          </G>
        ) : (
          <G fill={LIMB}>
            <Ellipse cx={23} cy={74} rx={8} ry={19} />
            <Ellipse cx={97} cy={74} rx={8} ry={19} />
          </G>
        )}
        {/* feet */}
        <Ellipse cx={46} cy={103} rx={11} ry={6} fill={LIMB} />
        <Ellipse cx={74} cy={103} rx={11} ry={6} fill={LIMB} />
        {/* body */}
        <Circle cx={60} cy={64} r={40} fill={BODY} />
        {/* leaves */}
        <Ellipse cx={47} cy={28} rx={18} ry={10.5} fill="#BDEBA8" />
        <Ellipse cx={75} cy={24} rx={16} ry={10} fill="#D8F3CC" />
        <Path d="M63 16 L63 33" stroke={LIMB} strokeWidth={2.6} strokeLinecap="round" />
        {/* face */}
        <Eyes mood={mood} />
        <Ellipse cx={43} cy={72} rx={5.5} ry={3.6} fill="#F4A08A" />
        <Ellipse cx={77} cy={72} rx={5.5} ry={3.6} fill="#F4A08A" />
        <Mouth mood={mood} />
      </Svg>
    </View>
  );
}

function Eyes({ mood }: { mood: Mood }) {
  if (mood === 'sleepy' || mood === 'cheer') {
    const d = mood === 'sleepy' ? ['M44 61 Q49 65 54 61', 'M66 61 Q71 65 76 61'] : ['M44 63 Q49 57 54 63', 'M66 63 Q71 57 76 63'];
    return (
      <G stroke={EYE} strokeWidth={2.8} strokeLinecap="round" fill="none">
        <Path d={d[0]} />
        <Path d={d[1]} />
      </G>
    );
  }
  return (
    <G>
      <Circle cx={49} cy={60} r={4.2} fill={EYE} />
      <Circle cx={71} cy={60} r={4.2} fill={EYE} />
      {mood === 'concerned' && (
        <G stroke={EYE} strokeWidth={2.2} strokeLinecap="round">
          <Path d="M43 51 Q48 48 53 50" />
          <Path d="M77 51 Q72 48 67 50" />
        </G>
      )}
    </G>
  );
}

function Mouth({ mood }: { mood: Mood }) {
  if (mood === 'cheer') return <Path d="M53 71 Q60 81 67 71 Z" fill="#1F2A26" />;
  if (mood === 'sleepy') return <Ellipse cx={60} cy={74} rx={3} ry={2.4} fill={EYE} />;
  if (mood === 'concerned') return <Path d="M54 76 Q60 72 66 76" stroke={EYE} strokeWidth={2.6} strokeLinecap="round" fill="none" />;
  return <Path d="M53 72 Q60 79 67 72" stroke={EYE} strokeWidth={2.6} strokeLinecap="round" fill="none" />;
}

// ---------------------------------------------------------------- backdrop

/** Sky with soft circles and two mint hills (design spec cover). */
export function SkyHills({ height = 240, children }: { height?: number; children?: ReactNode }) {
  const dark = useIsDark();
  const c = dark
    ? { sky: '#18333F', orb1: '#1D3C4A', orb2: '#1F4251', hill1: '#24442F', hill2: '#2C5238' }
    : { sky: '#BDE7F6', orb1: '#D3F0FA', orb2: '#A9DEF0', hill1: '#B9EBA8', hill2: '#D5F2D1' };
  return (
    <View style={[styles.scene, { height, backgroundColor: c.sky }]}>
      <Svg width="100%" height="100%" viewBox="0 0 400 240" preserveAspectRatio="xMidYMax slice" style={StyleSheet.absoluteFill}>
        <Circle cx={360} cy={40} r={110} fill={c.orb1} />
        <Circle cx={30} cy={150} r={80} fill={c.orb2} opacity={0.6} />
        <Ellipse cx={90} cy={225} rx={210} ry={52} fill={c.hill1} />
        <Ellipse cx={330} cy={230} rx={180} ry={46} fill={c.hill2} />
      </Svg>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  scene: { width: '100%', overflow: 'hidden', alignItems: 'center', justifyContent: 'flex-end' },
});
