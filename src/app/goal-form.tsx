import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { createGoal, updateGoal, type GoalInput } from '@/domain/commands';
import { useStore, useToday } from '@/state/store';
import { Button, Field, Screen, T } from '@/ui/components';
import { DateField } from '@/ui/date-field';
import { toast } from '@/ui/toast';

/** An end goal: what you want to reach, why, and by when. Quests linked to it drive its status. */
export default function GoalForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const s = useStore((st) => st.snapshot);
  const run = useStore((st) => st.run);
  const today = useToday();
  const existing = id ? s.goals.find((g) => g.id === id) : undefined;

  const [title, setTitle] = useState(existing?.title ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [deadline, setDeadline] = useState(existing?.deadline ?? '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (saving) return;
    const input: GoalInput = { title, description, deadline };
    setSaving(true);
    const res = await run((st, c) => (existing ? updateGoal(st, c, existing.id, input) : createGoal(st, c, input)));
    setSaving(false);
    if (!res.ok) return toast(res.message, 'error');
    if (existing) {
      toast('Goal updated');
      return router.back();
    }
    toast('Goal created. Now link a quest to it.');
    const created = useStore.getState().snapshot.goals.find((g) => !s.goals.some((old) => old.id === g.id));
    if (created) router.replace({ pathname: '/goal/[id]', params: { id: created.id } });
    else router.back();
  };

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: existing ? 'Edit goal' : 'New goal' }} />
      <T kind="small">
        Something you want to reach, like getting a new job, getting in better shape or cooking better. You will link quests to it next.
      </T>
      <Field label="Goal" value={title} onChangeText={setTitle} placeholder="e.g. Get a new job" />
      <Field label="Why it matters (optional)" value={description} onChangeText={setDescription} placeholder="What does done look like?" multiline />
      <DateField label="Deadline" value={deadline} onChange={setDeadline} today={today} horizon="far" />
      <Button title={saving ? 'Saving…' : existing ? 'Save changes' : 'Create goal'} onPress={save} disabled={saving || !title.trim() || !deadline} />
    </Screen>
  );
}
