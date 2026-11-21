import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { createGoal, updateGoal, type GoalInput } from '@/domain/commands';
import type { Cadence } from '@/domain/types';
import { useStore, useToday } from '@/state/store';
import { Button, Chip, Field, Row, Screen, T } from '@/ui/components';
import { DateField } from '@/ui/date-field';
import { space } from '@/ui/theme';
import { toast } from '@/ui/toast';

const CADENCES: { value: Cadence; label: string; hint: string }[] = [
  { value: 'daily', label: 'Daily', hint: 'Habits you work on every day' },
  { value: 'weekly', label: 'Weekly', hint: 'Short sprints' },
  { value: 'monthly', label: 'Monthly', hint: 'Medium-term targets' },
  { value: 'yearly', label: 'Yearly', hint: 'Big ambitions' },
];

export default function GoalForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const s = useStore((st) => st.snapshot);
  const run = useStore((st) => st.run);
  const today = useToday();
  const existing = id ? s.goals.find((g) => g.id === id) : undefined;

  const [title, setTitle] = useState(existing?.title ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [cadence, setCadence] = useState<Cadence>(existing?.cadence ?? 'monthly');
  const [deadline, setDeadline] = useState(existing?.deadline ?? '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (saving) return;
    const input: GoalInput = { title, description, cadence, deadline: deadline || undefined };
    setSaving(true);
    const res = await run((st, c) => (existing ? updateGoal(st, c, existing.id, input) : createGoal(st, c, input)));
    setSaving(false);
    if (!res.ok) return toast(res.message, 'error');
    toast(existing ? 'Goal updated' : 'Goal created');
    router.back();
  };

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: existing ? 'Edit goal' : 'New goal' }} />
      <Field label="Title" value={title} onChangeText={setTitle} placeholder="e.g. Run a half marathon" />
      <Field label="Description" value={description} onChangeText={setDescription} placeholder="Why it matters, what done looks like" multiline />
      <T kind="small">Cadence</T>
      <Row style={{ flexWrap: 'wrap' }}>
        {CADENCES.map((c) => (
          <Chip key={c.value} label={c.label} selected={cadence === c.value} onPress={() => setCadence(c.value)} />
        ))}
      </Row>
      <T kind="small" style={{ marginBottom: space.md }}>{CADENCES.find((c) => c.value === cadence)?.hint}</T>
      <DateField label="Deadline" value={deadline} onChange={setDeadline} today={today} optional />
      <Button title={saving ? 'Saving…' : existing ? 'Save changes' : 'Create goal'} onPress={save} disabled={saving} />
    </Screen>
  );
}
