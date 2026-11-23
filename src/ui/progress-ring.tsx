import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { usePalette } from './theme';

export function ProgressRing({
  ratio,
  size,
  stroke,
  track,
  color,
  accessibilityLabel,
  children,
}: {
  ratio: number;
  size: number;
  stroke: number;
  track?: string;
  color?: string;
  accessibilityLabel?: string;
  children: ReactNode;
}) {
  const p = usePalette();
  const center = size / 2;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(1, ratio));

  return (
    <View
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
      accessible={!!accessibilityLabel}
      accessibilityLabel={accessibilityLabel}
      aria-hidden={!accessibilityLabel}>
      <View aria-hidden style={StyleSheet.absoluteFill}>
        <Svg width={size} height={size}>
          <Circle cx={center} cy={center} r={radius} stroke={track ?? p.track} strokeWidth={stroke} fill="none" />
          {progress > 0 && (
            <Circle
              cx={center}
              cy={center}
              r={radius}
              stroke={color ?? p.forestBright}
              strokeWidth={stroke}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={progress === 1 ? undefined : [circumference * progress, circumference]}
              transform={`rotate(-90 ${center} ${center})`}
            />
          )}
        </Svg>
      </View>
      {children}
    </View>
  );
}
