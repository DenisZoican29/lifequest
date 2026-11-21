import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { MOCK_APP_CATALOG } from '@/domain/commands';
import { newId } from '@/domain/ids';

import { AppIcon } from './app-icon';
import { Button, Field, Ionicons, Row, T } from './components';
import { radius, space, usePalette } from './theme';

export interface PickedApp {
  appRef: string;
  label: string;
}

/**
 * Mock app picker for the browser. On iOS this is replaced by Apple's FamilyActivityPicker
 * via AppBlocker.selectApps().
 */
export function AppPicker({
  value,
  onChange,
  known = [],
}: {
  value: PickedApp[];
  onChange: (apps: PickedApp[]) => void;
  /** Previously added custom apps, so they can be re-selected. */
  known?: PickedApp[];
}) {
  const p = usePalette();
  const [custom, setCustom] = useState('');
  const options = [...MOCK_APP_CATALOG];
  for (const k of [...known, ...value]) if (!options.some((o) => o.appRef === k.appRef)) options.push(k);
  const selected = new Set(value.map((v) => v.appRef));

  const toggle = (app: PickedApp) =>
    onChange(selected.has(app.appRef) ? value.filter((v) => v.appRef !== app.appRef) : [...value, app]);

  const addCustom = () => {
    const label = custom.trim();
    if (!label) return;
    const existing = options.find((o) => o.label.toLowerCase() === label.toLowerCase());
    if (existing) {
      if (!selected.has(existing.appRef)) onChange([...value, existing]);
    } else {
      onChange([...value, { appRef: `custom:${newId()}`, label }]);
    }
    setCustom('');
  };

  return (
    <View style={{ gap: space.sm }}>
      <View style={styles.grid}>
        {options.map((o) => {
          const on = selected.has(o.appRef);
          return (
            <Pressable
              key={o.appRef}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={o.label}
              onPress={() => toggle(o)}
              style={({ pressed }) => [
                styles.tile,
                { backgroundColor: on ? p.mint : p.surface, borderColor: on ? p.forest : p.border, transform: [{ scale: pressed ? 0.96 : 1 }] },
              ]}>
              <AppIcon appRef={o.appRef} label={o.label} size={40} />
              <T kind="small" color={p.ink} numberOfLines={1}>
                {o.label}
              </T>
              <View style={[styles.tick, { backgroundColor: on ? p.forest : p.track }]}>
                <Ionicons name={on ? 'checkmark' : 'add'} size={13} color={on ? '#fff' : p.muted} />
              </View>
            </Pressable>
          );
        })}
      </View>
      <Row style={{ alignItems: 'flex-end' }}>
        <View style={{ flex: 1 }}>
          <Field label="Custom app" value={custom} onChangeText={setCustom} placeholder="e.g. Twitch" />
        </View>
        <Button title="Add" kind="tertiary" onPress={addCustom} disabled={!custom.trim()} style={{ marginBottom: space.md }} />
      </Row>
      <T kind="small">{value.length} selected · all share one daily time budget</T>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tile: { width: '31%', flexGrow: 1, alignItems: 'center', gap: 6, paddingVertical: space.md, paddingHorizontal: 6, borderRadius: radius.md, borderWidth: 1.5 },
  tick: { position: 'absolute', top: 6, right: 6, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
