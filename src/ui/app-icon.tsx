import { Text, View } from 'react-native';

import { Ionicons } from './components';
import { font } from './theme';
import { appVisual } from './visuals';

export function AppIcon({ appRef, label, size = 44, locked }: { appRef: string; label: string; size?: number; locked?: boolean }) {
  const v = appVisual(appRef, label);
  return (
    <View style={{ width: size, height: size }}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size * 0.28,
          backgroundColor: v.bg,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: locked ? 0.45 : 1,
        }}>
        {v.icon ? (
          <Ionicons name={v.icon} size={size * 0.55} color="#fff" />
        ) : (
          <Text style={{ color: '#fff', fontFamily: font.black, fontSize: size * 0.45 }}>{v.letter}</Text>
        )}
      </View>
      {locked && (
        <View
          style={{
            position: 'absolute',
            right: -4,
            bottom: -4,
            width: size * 0.45,
            height: size * 0.45,
            borderRadius: size,
            backgroundColor: '#B4474B',
            borderWidth: 2,
            borderColor: '#fff',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Ionicons name="lock-closed" size={size * 0.22} color="#fff" />
        </View>
      )}
    </View>
  );
}
