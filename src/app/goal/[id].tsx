import { format } from 'date-fns';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, View } from 'react-native';

import { setGoalStatus } from '@/domain/commands';
import { daysBetween, fromLocalDate } from '@/domain/dates';
import { goalInsights, type QuestStanding } from '@/domain/goal-insights';
import { goalProgress, quotaProgress, sortedMilestones, type QuestItem } from '@/domain/selectors';
import type { Snapshot } from '@/domain/types';
import { useStore, useToday } from '@/state/store';
import { Mascot } from '@/ui/art';
import { Button, Card, EmptyState, IconButton, Ionicons, ProgressBar, Row, Screen, SectionLabel, StatusChip, T } from '@/ui/components';
import { ActivityGrid, ConsistencyRing, StatTile, WeekBars } from '@/ui/goal-charts';
import { MilestonePath } from '@/ui/milestone-path';
import { QuestRow } from '@/ui/quest-row';
import { font, space, usePalette } from '@/ui/theme';
import { toast } from '@/ui/toast';
import { deadlineWord, healthStyle } from '@/ui/visuals';

/** The open occurrence of a linked quest as a list item, so it can be ticked or logged right here. */
function openItem(s: Snapshot, q: QuestStanding, today: string): QuestItem | undefined {
  const o = s.occurrences.find((x) => x.taskDefinitionId === q.task.id && x.status === 'open');
  if (!o) return undefined;
  const dueInDays = daysBetween(today, o.scheduledFor);
  const quota = quotaProgress(s, q.task, today);
  return { occurrence: o, task: q.task, dueInDays, quota, overdue: dueInDays < 0 && !quota, reminderActive: false };
}

/** Roadmap → goal: status, perseverance and the quests that drive it (spec addendum A1). */
export default function GoalDetail() {
  const p = usePalette();
  const { id } = useLocalSearchParams<{ id: string }>();
  const s = useStore((st) => st.snapshot);
  const run = useStore((st) => st.run);
  const today = useToday();
  const goal = s.goals.find((g) => g.id === id);
  const insights = useMemo(() => (goal ? goalInsights(s, goal, today) : undefined), [s, goal, today]);

  if (!goal || !insights) {
    return (
      <Screen edges={['bottom']}>
        <EmptyState mood="concerned" title="Goal not found" action={<Button title="Back" kind="tertiary" onPress={() => router.back()} />} />
      </Screen>
    );
  }

  const hs = healthStyle(insights.health);
  const milestones = sortedMilestones(s, goal.id);
  const checkpoints = goalProgress(s, goal.id);
  const linked = insights.quests.filter((q) => q.task.active);
  // Stats and charts appear once there is something to show; until then the next step is adding a quest.
  const hasHistory = insights.totalDone > 0 || insights.weeks.some((w) => w.ratio !== null);
  const editGoal = () => router.push({ pathname: '/goal-form', params: { id: goal.id } });
  const addQuest = () => router.push({ pathname: '/task-form', params: { goalId: goal.id } });

  const status = async (next: 'active' | 'completed' | 'archived') => {
    const res = await run((st, c) => setGoalStatus(st, c, goal.id, next));
    if (!res.ok) return toast(res.message, 'error');
    toast(next === 'completed' ? 'Goal reached. What a journey!' : next === 'archived' ? 'Goal archived' : 'Goal reopened');
  };

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: '', headerRight: () => <IconButton icon="create-outline" label="Edit goal" onPress={editGoal} /> }} />

      <Card hero tone={hs.card}>
        <Row style={{ justifyContent: 'space-between' }}>
          <T kind="eyebrow" color={p.ink}>
            End goal
          </T>
          <StatusChip tone="plain" icon={hs.icon} label={hs.label} />
        </Row>
        <T kind="title">{goal.title}</T>
        {goal.description ? (
          <T kind="small" color={p.ink}>
            {goal.description}
          </T>
        ) : null}
        <Row gap={space.lg} style={{ marginTop: space.sm }}>
          <ConsistencyRing ratio={insights.consistency} track={p.surface} />
          <View style={{ flex: 1, gap: 4 }}>
            <T kind="small" color={p.ink} style={{ fontFamily: font.bold }}>
              {insights.consistency === null ? 'Plan kept: not measured yet' : 'Plan kept, last 4 weeks'}
            </T>
            <T kind="small" color={p.ink}>
              {hs.message}
            </T>
          </View>
        </Row>
        <View style={{ marginTop: space.sm, gap: 6 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <T kind="meta" color={p.ink}>
              {goal.deadline ? `Deadline ${format(fromLocalDate(goal.deadline), 'd MMM yyyy')}` : 'No deadline yet'}
            </T>
            <T kind="meta" color={p.ink} style={{ fontFamily: font.bold }}>
              {goal.status === 'active' ? deadlineWord(insights.daysLeft) : hs.label}
            </T>
          </Row>
          {insights.timeUsed !== undefined && <ProgressBar ratio={insights.timeUsed} height={6} color={p.ink} track={p.surface} />}
          <T kind="meta" color={p.ink}>
            Started {format(fromLocalDate(insights.start), 'd MMM yyyy')}
            {insights.timeUsed !== undefined ? ` · ${Math.round(insights.timeUsed * 100)}% of the time used` : ''}
          </T>
        </View>
      </Card>

      {goal.status === 'active' && !goal.deadline && <Button kind="secondary" title="Set a deadline" onPress={editGoal} />}
      {insights.health === 'past-deadline' && (
        <Row>
          <Button compact title="Mark reached" onPress={() => status('completed')} style={{ flex: 1 }} />
          <Button compact kind="secondary" title="New deadline" onPress={editGoal} style={{ flex: 1 }} />
        </Row>
      )}

      {hasHistory && (
        <>
          <SectionLabel>Perseverance</SectionLabel>
          <Row style={{ flexWrap: 'wrap' }}>
            <StatTile icon="flame-outline" value={`${insights.streak} wk`} label="Week streak" sub={`Best ${insights.bestStreak} wk`} />
            <StatTile icon="checkmark-done-outline" value={String(insights.totalDone)} label="Quests done" sub="Since you started" />
          </Row>
          <Row style={{ flexWrap: 'wrap' }}>
            <StatTile icon="calendar-outline" value={String(insights.activeDays)} label="Days you showed up" sub="At least one quest done" />
            <StatTile icon="sparkles-outline" value={String(insights.coinsEarned)} label="Coins earned" sub="From this goal's quests" />
          </Row>
          <T kind="meta">A week counts toward the streak when you keep at least 80% of the plan. Weeks with nothing due don’t break it.</T>

          <Card>
            <T kind="eyebrow">Week by week</T>
            <WeekBars weeks={insights.weeks} />
          </Card>

          <Card>
            <T kind="eyebrow">Days you showed up</T>
            <ActivityGrid days={insights.days} />
          </Card>
        </>
      )}

      <SectionLabel right={<Button compact kind="ghost" title="+ Quest" onPress={addQuest} />}>Linked quests</SectionLabel>
      {linked.length === 0 ? (
        <Card tone="cream" style={{ alignItems: 'center' }}>
          <Mascot mood="happy" size={64} />
          <T kind="bodyStrong" style={{ textAlign: 'center' }}>
            What will move this goal forward?
          </T>
          <T kind="small" style={{ textAlign: 'center' }}>
            Add quests like “Apply to 3 jobs a week” or “Cook a new recipe every Sunday”. How well you keep them sets this goal’s status.
          </T>
          <Button title="Add a quest" onPress={addQuest} style={{ alignSelf: 'stretch' }} />
        </Card>
      ) : (
        <View style={{ gap: space.md }}>
          {linked.map((q) => (
            <LinkedQuest key={q.task.id} standing={q} item={openItem(s, q, today)} today={today} />
          ))}
        </View>
      )}

      <SectionLabel>Checkpoints (optional)</SectionLabel>
      {milestones.length > 0 && (
        <T kind="meta">
          {checkpoints.done} of {checkpoints.total} done
        </T>
      )}
      <MilestonePath goalId={goal.id} milestones={milestones} />

      <SectionLabel>Goal status</SectionLabel>
      <View style={{ gap: space.sm }}>
        {goal.status !== 'completed' && insights.health !== 'past-deadline' && <Button kind="secondary" title="Mark goal reached" onPress={() => status('completed')} />}
        {goal.status !== 'active' && <Button kind="secondary" title="Reopen goal" onPress={() => status('active')} />}
        {goal.status !== 'archived' && <Button kind="tertiary" title="Archive goal" onPress={() => status('archived')} />}
      </View>
    </Screen>
  );
}

function LinkedQuest({ standing, item, today }: { standing: QuestStanding; item?: QuestItem; today: string }) {
  const p = usePalette();
  const s = useStore((st) => st.snapshot);
  const { ratio, kept, planned, task } = standing;
  // No open occurrence: a finished one-off (or a quest waiting on nothing). Show it as done.
  const lastDone = item
    ? undefined
    : s.occurrences
        .filter((o) => o.taskDefinitionId === task.id && o.status === 'completed' && o.completedOn)
        .map((o) => o.completedOn!)
        .sort()
        .pop();
  return (
    <View style={{ gap: 6 }}>
      {item ? (
        <QuestRow item={item} today={today} />
      ) : (
        <Pressable onPress={() => router.push({ pathname: '/task-form', params: { id: task.id } })} accessibilityRole="button" accessibilityLabel={`${task.title}, ${lastDone ? 'done' : 'not scheduled'}. Edit quest`}>
          <Card>
            <Row gap={space.md}>
              <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: lastDone ? p.forest : p.track }}>
                <Ionicons name={lastDone ? 'checkmark' : 'remove'} size={17} color={lastDone ? p.onForest : p.faint} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <T kind="bodyStrong" color={p.muted}>
                  {task.title}
                </T>
                <T kind="meta">{lastDone ? `${task.recurrence ? 'Last done' : 'One-off · done'} ${lastDone === today ? 'today' : format(fromLocalDate(lastDone), 'd MMM')}` : 'Not scheduled'}</T>
              </View>
            </Row>
          </Card>
        </Pressable>
      )}
      <View style={{ paddingHorizontal: space.xs, gap: 4 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <T kind="meta">Last 4 weeks</T>
          <T kind="meta" color={p.ink} style={{ fontFamily: font.bold }}>
            {ratio === null ? 'Nothing due yet' : `${kept} of ${planned} kept`}
          </T>
        </Row>
        <ProgressBar ratio={ratio ?? 0} height={6} />
      </View>
    </View>
  );
}
