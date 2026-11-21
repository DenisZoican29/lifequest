import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { completeOnboarding, createTask, MOCK_APP_CATALOG } from '@/domain/commands';
import { useStore, useToday } from '@/state/store';
import { AppPicker, type PickedApp } from '@/ui/app-picker';
import { Mascot, SkyHills, type Mood } from '@/ui/art';
import { Button, Card, Chip, DemoBanner, Field, Row, Screen, T, toneBg, type CardTone } from '@/ui/components';
import { space, usePalette } from '@/ui/theme';
import { toast } from '@/ui/toast';

const STEPS: { title: string; quote: string; tone: CardTone; mood: Mood }[] = [
  { title: 'Welcome', quote: 'Make progress. Enjoy your breaks.', tone: 'sky', mood: 'cheer' },
  { title: 'Choose apps', quote: 'Which apps should share one daily allowance?', tone: 'mint', mood: 'happy' },
  { title: 'Set daily limit', quote: 'Start with 30 free minutes.', tone: 'peach', mood: 'happy' },
  { title: 'Create first quest', quote: 'What is one thing you want to do?', tone: 'lavender', mood: 'cheer' },
];

/** First run (spec §11): purpose first, then only the settings the POC needs. */
export default function Onboarding() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const run = useStore((st) => st.run);
  const today = useToday();
  const [step, setStep] = useState(0);
  const [apps, setApps] = useState<PickedApp[]>(MOCK_APP_CATALOG.slice(0, 3));
  const [minutes, setMinutes] = useState('30');
  const [quest, setQuest] = useState('');
  const [daily, setDaily] = useState(true);
  const [coins, setCoins] = useState(10);
  const [saving, setSaving] = useState(false);

  const minutesNum = Number(minutes);
  const minutesValid = Number.isInteger(minutesNum) && minutesNum >= 0 && minutesNum <= 1440;
  const last = step === STEPS.length - 1;
  const current = STEPS[step];

  const finish = async (withQuest: boolean) => {
    setSaving(true);
    if (withQuest && quest.trim()) {
      const res = await run((st, c) =>
        createTask(st, c, {
          title: quest,
          description: '',
          taskType: 'main',
          rewardCoins: coins,
          dueAt: today,
          recurrence: daily ? { frequency: 'day', interval: 1, anchorPolicy: 'completion' } : undefined,
        }),
      );
      if (!res.ok) {
        setSaving(false);
        return toast(res.message, 'error');
      }
    }
    const res = await run((st, c) => completeOnboarding(st, c, apps, minutesNum));
    if (!res.ok) {
      setSaving(false);
      toast(res.message, 'error');
    }
    // The root layout's route guard moves to Today once `onboarded` flips.
  };

  const hero = (
    <SkyHills height={220 + insets.top}>
      <View style={[styles.dots, { top: insets.top + space.lg }]}>
        {STEPS.map((_, i) => (
          <View key={i} style={[styles.dot, { width: i === step ? 24 : 8, backgroundColor: i <= step ? p.forest : 'rgba(49,110,84,0.25)' }]} />
        ))}
      </View>
      <View style={{ marginBottom: 18 }}>
        <Mascot mood={current.mood} size={110} />
      </View>
    </SkyHills>
  );

  return (
    <Screen hero={hero}>
      <Card style={{ padding: space.md }}>
        <View style={[styles.stepHead, { backgroundColor: toneBg(p, current.tone) }]}>
          <T kind="eyebrow" color={p.ink}>
            Step {String(step + 1).padStart(2, '0')}
          </T>
          <T kind="title">{current.title}</T>
        </View>
        <View style={{ padding: space.sm, gap: space.md }}>
          <T kind="body" color={p.ink}>
            “{current.quote}”
          </T>

          {step === 0 && (
            <>
              <T kind="muted">LifeQuest turns your goals into small quests. Completing them earns coins, which you can later trade for extra screen time, only when you choose to.</T>
              <DemoBanner />
            </>
          )}

          {step === 1 && (
            <>
              <DemoBanner compact />
              <T kind="small">These are sample app names. On iPhone and Android, this step will use the system app picker.</T>
              <AppPicker value={apps} onChange={setApps} />
            </>
          )}

          {step === 2 && (
            <>
              <T kind="muted">All selected apps draw from this one budget. It resets every midnight; coins can buy more.</T>
              <Row style={{ flexWrap: 'wrap' }}>
                {[15, 30, 45, 60, 90].map((m) => (
                  <Chip key={m} label={`${m} min`} selected={minutes === String(m)} onPress={() => setMinutes(String(m))} />
                ))}
              </Row>
              <Field label="Minutes per day" value={minutes} onChangeText={setMinutes} numeric error={minutesValid ? undefined : 'Enter 0–1440 minutes'} />
            </>
          )}

          {step === 3 && (
            <>
              <Field label="Your first quest" value={quest} onChangeText={setQuest} placeholder="e.g. Read for 20 minutes" />
              <Row style={{ flexWrap: 'wrap' }}>
                <Chip label="Every day" selected={daily} onPress={() => setDaily(true)} />
                <Chip label="Just once" selected={!daily} onPress={() => setDaily(false)} />
              </Row>
              <T kind="small" color={p.ink}>
                Reward
              </T>
              <Row style={{ flexWrap: 'wrap' }}>
                {[5, 10, 20].map((n) => (
                  <Chip key={n} label={`+${n} coins`} selected={coins === n} onPress={() => setCoins(n)} />
                ))}
              </Row>
            </>
          )}
        </View>
      </Card>

      <View style={{ gap: space.sm }}>
        {last ? (
          <>
            <Button title={saving ? 'Saving…' : 'Start my journey'} onPress={() => finish(true)} disabled={saving || !quest.trim()} />
            <Button title="Skip for now" kind="tertiary" onPress={() => finish(false)} disabled={saving} />
          </>
        ) : (
          <Button
            title="Continue"
            onPress={() => setStep(step + 1)}
            disabled={(step === 1 && apps.length === 0) || (step === 2 && !minutesValid)}
          />
        )}
        {step > 0 && <Button title="Back" kind="ghost" onPress={() => setStep(step - 1)} disabled={saving} />}
        {step === 1 && apps.length === 0 && (
          <T kind="small" style={{ textAlign: 'center' }}>
            Select at least one app to continue.
          </T>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  dots: { position: 'absolute', flexDirection: 'row', gap: 6, alignSelf: 'center' },
  dot: { height: 8, borderRadius: 4 },
  stepHead: { borderRadius: 16, padding: space.lg, gap: 2 },
});
