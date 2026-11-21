import { useState } from 'react';
import { View } from 'react-native';

import { setBaseAllowance, setOffers, setSelectedApps, setTheme } from '@/domain/commands';
import type { ThemePreference } from '@/domain/types';
import { enabledApps } from '@/domain/economy';
import { storageIsDurable, useStore } from '@/state/store';
import { AppPicker, type PickedApp } from '@/ui/app-picker';
import { Button, Card, ConfirmDialog, Field, Row, Screen, SectionLabel, Segmented, DemoBanner, T } from '@/ui/components';
import { space } from '@/ui/theme';
import { toast } from '@/ui/toast';

export default function Settings() {
  const s = useStore((st) => st.snapshot);
  const run = useStore((st) => st.run);

  const [minutes, setMinutes] = useState(String(s.settings.baseDailyMinutes));
  const [apps, setApps] = useState<PickedApp[]>(enabledApps(s.apps).map((a) => ({ appRef: a.appRef, label: a.label })));
  const [offers, setOffersDraft] = useState(s.settings.offers.map((o) => ({ ...o, minutes: String(o.minutes), coins: String(o.coins) })));
  const [confirmErase, setConfirmErase] = useState(false);

  const known = s.apps.map((a) => ({ appRef: a.appRef, label: a.label }));

  const saveMinutes = async () => {
    const res = await run((st, c) => setBaseAllowance(st, c, Number(minutes)));
    toast(res.ok ? 'Daily allowance saved' : res.message, res.ok ? 'success' : 'error');
  };
  const saveApps = async () => {
    if (apps.length === 0) return toast('Select at least one app', 'error');
    const res = await run((st, c) => setSelectedApps(st, c, apps));
    toast(res.ok ? 'Restricted apps saved' : res.message, res.ok ? 'success' : 'error');
  };
  const saveOffers = async () => {
    const parsed = offers.map((o) => ({ id: o.id, minutes: Number(o.minutes), coins: Number(o.coins) }));
    const res = await run((st, c) => setOffers(st, c, parsed));
    toast(res.ok ? 'Prices saved' : res.message, res.ok ? 'success' : 'error');
  };

  return (
    <Screen edges={['bottom']}>
      <SectionLabel>Appearance</SectionLabel>
      <Segmented<ThemePreference>
        value={s.settings.theme}
        onChange={async (theme) => {
          const res = await run((st, c) => setTheme(st, c, theme));
          if (!res.ok) toast(res.message, 'error');
        }}
        options={[
          { value: 'system', label: 'System' },
          { value: 'light', label: 'Light' },
          { value: 'dark', label: 'Dark' },
        ]}
      />

      <SectionLabel>Daily allowance</SectionLabel>
      <Card>
        <Field
          label="Free minutes per day"
          value={minutes}
          onChangeText={setMinutes}
          numeric
          hint="Shared by all restricted apps. Changes apply to today immediately."
        />
        <Button title="Save allowance" onPress={saveMinutes} />
      </Card>

      <SectionLabel>Restricted apps</SectionLabel>
      <Card>
        <AppPicker value={apps} onChange={setApps} known={known} />
        <T kind="small">
          Removing an app stops tracking it from now on. Minutes it already used today still count — time is never refunded.
        </T>
        <Button title="Save apps" onPress={saveApps} />
      </Card>

      <SectionLabel>Time pack prices</SectionLabel>
      <Card>
        {offers.map((o, i) => (
          <Row key={o.id} style={{ alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Field label="Minutes" value={o.minutes} numeric onChangeText={(v) => setOffersDraft(offers.map((x, j) => (j === i ? { ...x, minutes: v } : x)))} />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Coins" value={o.coins} numeric onChangeText={(v) => setOffersDraft(offers.map((x, j) => (j === i ? { ...x, coins: v } : x)))} />
            </View>
          </Row>
        ))}
        <Button title="Save prices" kind="primary" onPress={saveOffers} />
      </Card>

      <SectionLabel>Reminders</SectionLabel>
      <Card>
        <T kind="muted">
          Side quests can show an in-app reminder a few days before they are due (set per side quest). System push notifications come with the phone app.
        </T>
      </Card>

      <SectionLabel>Data</SectionLabel>
      <Card>
        <T kind="muted">
          {storageIsDurable
            ? 'Everything is stored only in this browser (IndexedDB). Clearing site data erases it. Nothing is sent to a server.'
            : 'This build keeps data in memory only — it will be lost when the app closes.'}
        </T>
        <Button title="Erase all data" kind="danger" icon="trash-outline" onPress={() => setConfirmErase(true)} />
      </Card>

      <View style={{ marginTop: space.md }}>
        <DemoBanner />
      </View>

      <ConfirmDialog
        visible={confirmErase}
        title="Erase everything?"
        body="Goals, quests, coins, purchases and usage will be permanently deleted from this browser."
        confirmLabel="Erase"
        kind="danger"
        onCancel={() => setConfirmErase(false)}
        onConfirm={async () => {
          setConfirmErase(false);
          await useStore.getState().eraseAll(); // route guard returns to onboarding
        }}
      />
    </Screen>
  );
}
