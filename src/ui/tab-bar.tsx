import type { BottomTabBarProps } from 'expo-router/tabs';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Coin } from './art';
import { Ionicons, type IconName } from './components';
import { font, radius, softShadow, usePalette } from './theme';

const ICONS: Record<string, IconName | 'coin'> = {
  index: 'home-outline',
  roadmap: 'trail-sign-outline',
  quests: 'document-text-outline',
  bank: 'coin',
};

/** Four tabs, no maze (spec §04). The active tab sits on a mint pill. */
export function LifeQuestTabBar({ state, descriptors, navigateToTab, insets }: BottomTabBarProps) {
  const p = usePalette();
  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 10), backgroundColor: p.canvas }]}>
      <View style={[styles.bar, { backgroundColor: p.surface, borderColor: p.border }, softShadow(p)]} accessibilityRole="tablist">
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const options = descriptors[route.key]?.options ?? {};
          const label = typeof options.title === 'string' ? options.title : route.name;
          const icon = ICONS[route.name] ?? 'ellipse-outline';
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected: focused }}
              onPress={() => !focused && navigateToTab(route.key)}
              style={[styles.item, focused && { backgroundColor: p.mint }]}>
              {icon === 'coin' ? <Coin size={20} /> : <Ionicons name={icon} size={21} color={focused ? p.forest : p.muted} />}
              <Text style={[styles.label, { color: focused ? p.forest : p.muted, fontFamily: focused ? font.bold : font.regular }]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 12, paddingTop: 6 },
  bar: { flexDirection: 'row', borderRadius: radius.lg + 2, borderWidth: 1, padding: 6, gap: 4 },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, minHeight: 54, borderRadius: radius.md },
  label: { fontSize: 12 },
});
