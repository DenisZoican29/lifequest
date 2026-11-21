import { router, Stack, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { setGoalStatus } from '@/domain/commands';
import { daysBetween, formatFriendly } from '@/domain/dates';
import { goalProgress, quotaProgress, sortedMilestones, type QuestItem } from '@/domain/selectors';
import { useStore, useToday } from '@/state/store';
import { Mascot } from '@/ui/art';
import { Button, Card, EmptyState, IconButton, ProgressBar, Row, Screen, SectionLabel, StatusChip, T } from '@/ui/components';
import { MilestonePath } from '@/ui/milestone-path';
import { QuestRow } from '@/ui/quest-row';
import { font, space, usePalette } from '@/ui/theme';
import { toast } from '@/ui/toast';
import { cadenceStyle } from '@/ui/visuals';

/** Roadmap → goal → milestone (spec §04). */
export default function GoalDetail() {
  const p = usePalette();
  const { id } = useLocalSearchParams<{ id: string }>();
  const s = useStore((st) => st.snapshot);
  const run = useStore((st) => st.run);
  const today = useToday();
  const goal = s.goals.find((g) => g.id === id);

  if (!goal) {
    return (
      <Screen edges={['bottom']}>
        <EmptyState mood="concerned" title="Goal not found" action={<Button title="Back" kind="tertiary" onPress={() => router.back()} />} />
      </Screen>
    );
  }

  const progress = goalProgress(s, goal.id);
  const cs = cadenceStyle(goal.cadence);
  const milestones = sortedMilestones(s, goal.id);
  const linked: QuestItem[] = s.tasks
    .filter((t) => t.goalId === goal.id && t.active)
    .flatMap((t) => {
      const o = s.occurrences.find((x) => x.taskDefinitionId === t.id && x.status === 'open');
      if (!o) return [];
      const dueInDays = daysBetween(today, o.scheduledFor);
      const quota = quotaProgress(s, t, today);
      return [{ occurrence: o, task: t, dueInDays, quota, overdue: dueInDays < 0 && !quota, reminderActive: false }];
    });
  const allDone = progress.total > 0 && progress.done === progress.total && goal.status === 'active';

  const status = async (next: 'active' | 'completed' | 'archived') => {
    const res = await run((st, c) => setGoalStatus(st, c, goal.id, next));
    if (!res.ok) return toast(res.message, 'error');
    toast(next === 'completed' ? 'Goal reached. What a journey!' : next === 'archived' ? 'Goal archived' : 'Goal reopened');
  };

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen
        options={{
          title: '',
          headerRight: () => <IconButton icon="create-outline" label="Edit goal" onPress={() => router.push({ pathname: '/goal-form', params: { id: goal.id } })} />,
        }}
      />
      <Card hero tone={cs.tone}>
        <Row style={{ justifyContent: 'space-between' }}>
          <T kind="eyebrow" color={p.ink}>
            {cs.label}
          </T>
          {goal.status !== 'active' && <StatusChip tone={goal.status === 'completed' ? 'done' : 'neutral'} label={goal.status === 'completed' ? 'Completed' : 'Archived'} />}
        </Row>
        <T kind="title">{goal.title}</T>
        {goal.description ? (
          <T kind="small" color={p.ink}>
            {goal.description}
          </T>
        ) : null}
        <View style={{ marginTop: space.xs, gap: 6 }}>
          <ProgressBar ratio={progress.ratio} track={p.surface} />
          <Row style={{ justifyContent: 'space-between' }}>
            <T kind="meta" color={p.ink}>
              {goal.deadline ? `Target: ${formatFriendly(goal.deadline, today)}` : 'No deadline'}
            </T>
            <T kind="meta" color={p.ink} style={{ fontFamily: font.bold }}>
              {progress.total ? `${Math.round(progress.ratio * 100)}% complete` : 'Not started'}
            </T>
          </Row>
        </View>
      </Card>

      {allDone && (
        <Card tone="mint" style={{ alignItems: 'center' }}>
          <Mascot mood="cheer" size={80} />
          <T kind="h3">Every checkpoint reached!</T>
          <Button title="Mark goal completed" onPress={() => status('completed')} style={{ alignSelf: 'stretch' }} />
        </Card>
      )}

      <SectionLabel>Your milestone path</SectionLabel>
      <MilestonePath goalId={goal.id} milestones={milestones} />

      <SectionLabel right={<Button compact kind="ghost" title="+ Quest" onPress={() => router.push({ pathname: '/task-form', params: { goalId: goal.id } })} />}>Linked quests</SectionLabel>
      {linked.length === 0 ? (
        <T kind="muted">No open quests linked to this goal yet.</T>
      ) : (
        <View style={{ gap: space.sm }}>
          {linked.map((item) => (
            <QuestRow key={item.occurrence.id} item={item} today={today} />
          ))}
        </View>
      )}

      <SectionLabel>Goal status</SectionLabel>
      <View style={{ gap: space.sm }}>
        {goal.status !== 'completed' && !allDone && <Button kind="secondary" title="Mark goal completed" onPress={() => status('completed')} />}
        {goal.status !== 'active' && <Button kind="secondary" title="Reopen goal" onPress={() => status('active')} />}
        {goal.status !== 'archived' && <Button kind="tertiary" title="Archive goal" onPress={() => status('archived')} />}
      </View>
    </Screen>
  );
}
