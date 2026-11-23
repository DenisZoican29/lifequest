import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { completeOnboarding, createTask, MOCK_APP_CATALOG } from '@/domain/commands';
import { useStore, useToday } from '@/state/store';
import { AppPicker, type PickedApp } from '@/ui/app-picker';
import { Mascot, SkyHills, type Mood } from '@/ui/art';
import { RepeatPicker, repeatFromRule, ruleFromRepeat, type RepeatValue } from '@/ui/repeat-picker';
import { Button, Card, Chip, DemoBanner, Field, Row, Screen, T, toneBg, type CardTone } from '@/ui/components';
import { space, usePalette } from '@/ui/theme';
import { toast } from '@/ui/toast';

const STEPS: { title: string; quote: string; tone: CardTone; mood: Mood }[] = [
  { title: 'Welcome', quote: 'Make progress. Enjoy your breaks.', tone: 'sky', mood: 'cheer' },
  { title: 'Create your first quest', quote: 'What is one thing you want to do?', tone: 'lavender', mood: 'cheer' },
  { title: 'Screen time (optional)', quote: 'Trade coins for extra screen time, when you choose to.', tone: 'mint', mood: 'happy' },
];

/**
 * First run (addendum A4 §4): the first quest comes early. App selection and the daily allowance
 * can wait until Time Bank is needed; simulation is explained on that step, where it first appears.
 */
export default function Onboarding() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const run = useStore((st) => st.run);
  const today = useToday();
  const [step, setStep] = useState(0);
  const [apps, setApps] = useState<PickedApp[]>(MOCK_APP_CATALOG.slice(0, 3));
  const [minutes, setMinutes] = useState('30');
  const [quest, setQuest] = useState('');
  const [repeat, setRepeat] = useState<RepeatValue>(() => ({ ...repeatFromRule(undefined), mode: 'repeating' }));
  const [coins, setCoins] = useState(10);
  const [saving, setSaving] = useState(false);

  const minutesNum = Number(minutes);
  const minutesValid = Number.isInteger(minutesNum) && minutesNum >= 0 && minutesNum <= 1440;
  const last = step === STEPS.length - 1;
  const current = STEPS[step];

  const finish = async (setUpScreenTime: boolean) => {
    setSaving(true);
    if (quest.trim()) {
      const res = await run((st, c) =>
        createTask(st, c, {
          title: quest,
          description: '',
          taskType: 'main',
          rewardCoins: coins,
          dueAt: today,
          recurrence: ruleFromRepeat(repeat),
          // No date picker here: the first quest is flexible (any time, or any time each period).
          noDueDate: true,
        }),
      );
      if (!res.ok) {
        setSaving(false);
        return toast(res.message, 'error');
      }
    }
    // Deferring keeps no apps and the default 30 free minutes; Time Bank offers setup later.
    const res = await run((st, c) => completeOnboarding(st, c, setUpScreenTime ? apps : [], setUpScreenTime ? minutesNum : 30));
    if (!res.ok) {
      setSaving(false);
      toast(res.message, 'error');
    }
    // The root layout's route guard moves to Today once `onboarded` flips.
  };

  const hero = (
    <SkyHills height={220 + insets.top}>
      <View accessible accessibilityLabel={`Step ${step + 1} of ${STEPS.length}`} style={[styles.dots, { top: insets.top + space.lg }]}>
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
          <T kind="title" accessibilityRole="header">{current.title}</T>
        </View>
        <View style={{ padding: space.sm, gap: space.md }}>
          <T kind="body" color={p.ink}>
            “{current.quote}”
          </T>

          {step === 0 && (
            <T kind="muted">LifeQuest turns your goals into small quests. Completing them earns coins, which you can later trade for extra screen time, only when you choose to.</T>
          )}

          {step === 1 && (
            <>
              <Field label="Your first quest" value={quest} onChangeText={setQuest} placeholder="e.g. Read for 20 minutes" />
              <RepeatPicker value={repeat} onChange={setRepeat} />
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

          {step === 2 && (
            <>
              <DemoBanner />
              <T kind="small">
                Pick the apps that share one daily allowance. These are sample app names: on iPhone and Android this step will use the system app picker. You can also do this later in Time Bank.
              </T>
              <AppPicker value={apps} onChange={setApps} />
              <T kind="muted">All selected apps draw from this one budget. It resets every midnight; coins can buy more.</T>
              <Row style={{ flexWrap: 'wrap' }}>
                {[15, 30, 45, 60, 90].map((m) => (
                  <Chip key={m} label={`${m} min`} selected={minutes === String(m)} onPress={() => setMinutes(String(m))} />
                ))}
              </Row>
              <Field label="Minutes per day" value={minutes} onChangeText={setMinutes} numeric error={minutesValid ? undefined : 'Enter 0–1440 minutes'} />
            </>
          )}
        </View>
      </Card>

      <View style={{ gap: space.sm }}>
        {step === 0 && <Button title="Create your first quest" onPress={() => setStep(1)} />}
        {step === 1 && (
          <>
            <Button title="Continue" onPress={() => setStep(2)} disabled={!quest.trim()} />
            <Button
              title="Skip the quest for now"
              kind="tertiary"
              onPress={() => {
                setQuest('');
                setStep(2);
              }}
            />
          </>
        )}
        {last && (
          <>
            <Button
              title={saving ? 'Saving…' : 'Start my journey'}
              onPress={() => finish(true)}
              disabled={saving || apps.length === 0 || !minutesValid}
            />
            <Button title="Set up screen time later" kind="tertiary" onPress={() => finish(false)} disabled={saving} />
            {apps.length === 0 && (
              <T kind="small" style={{ textAlign: 'center' }}>
                Select at least one app, or set up screen time later.
              </T>
            )}
          </>
        )}
        {step > 0 && <Button title="Back" kind="ghost" onPress={() => setStep(step - 1)} disabled={saving} />}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  dots: { position: 'absolute', flexDirection: 'row', gap: 6, alignSelf: 'center' },
  dot: { height: 8, borderRadius: 4 },
  stepHead: { borderRadius: 16, padding: space.lg, gap: 2 },
});
