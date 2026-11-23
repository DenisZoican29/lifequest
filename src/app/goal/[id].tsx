import { format } from 'date-fns';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { setGoalStatus } from '@/domain/commands';
import { fromLocalDate } from '@/domain/dates';
import { goalInsights, type QuestCompletions, type QuestStanding } from '@/domain/goal-insights';
import { goalSlots } from '@/domain/goal-share';
import { questItem, type QuestItem } from '@/domain/selectors';
import type { Snapshot } from '@/domain/types';
import { useStore, useToday } from '@/state/store';
import { Mascot } from '@/ui/art';
import { Button, Card, EmptyState, IconButton, Ionicons, ProgressBar, Row, Screen, SectionLabel, Segmented, StatusChip, T } from '@/ui/components';
import { ActivityGrid, ConsistencyRing, goalColor, StatTile, WeekBars } from '@/ui/goal-charts';
import { GoalMark, QuestMark } from '@/ui/goal-mark';
import { QuestRow } from '@/ui/quest-row';
import { font, space, usePalette } from '@/ui/theme';
import { toast } from '@/ui/toast';
import { deadlineWord, healthStyle } from '@/ui/visuals';

/** The open occurrence of a linked quest as a list item, so it can be ticked or logged right here. */
function openItem(s: Snapshot, q: QuestStanding, today: string): QuestItem | undefined {
  const o = s.occurrences.find((x) => x.taskDefinitionId === q.task.id && x.status === 'open');
  return o ? questItem(s, o, q.task, today) : undefined;
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

      <Row gap={space.md} style={{ alignItems: 'flex-start', paddingVertical: space.sm }}>
        <GoalMark goal={goal} size={48} ring={goalSlots(s).has(goal.id) ? goalColor(p, goalSlots(s).get(goal.id)!) : undefined} />
        <View style={{ flex: 1, gap: space.xs }}>
          <T kind="display" accessibilityRole="header">{goal.title}</T>
          {!!goal.description && <T kind="small">{goal.description}</T>}
        </View>
      </Row>

      <Card style={{ gap: space.md }}>
        <Row gap={space.md}>
          <ConsistencyRing ratio={insights.consistency} size={54} stroke={6} />
          <Row style={{ flex: 1, flexWrap: 'wrap', justifyContent: 'space-between' }}>
            <View style={{ flexGrow: 1, flexShrink: 1 }}>
              <T kind="bodyStrong">Plan kept</T>
              <T kind="meta">{insights.consistency === null ? 'No score yet' : 'Last 4 weeks'}</T>
            </View>
            <View style={{ maxWidth: '100%' }}>
              <StatusChip tone={hs.chip === 'overdue' ? 'due' : hs.chip} icon={hs.icon} label={hs.label} />
            </View>
          </Row>
        </Row>
        <Row gap={space.md} style={{ paddingTop: space.md, borderTopWidth: 1, borderTopColor: p.border }}>
          <View aria-hidden style={{ width: 54, alignItems: 'center' }}>
            <Ionicons name="calendar-outline" size={20} color={p.forest} />
          </View>
          <Row style={{ flex: 1, flexWrap: 'wrap', justifyContent: 'space-between' }}>
            <View style={{ flexGrow: 1, flexShrink: 1 }}>
              <T kind="bodyStrong">{goal.deadline ? `Due ${format(fromLocalDate(goal.deadline), 'd MMM yyyy')}` : 'No deadline'}</T>
              <T kind="meta">Started {format(fromLocalDate(insights.start), 'd MMM yyyy')}</T>
            </View>
            {goal.status === 'active' && insights.daysLeft !== undefined && (
              <T kind="meta" style={{ fontFamily: font.bold, maxWidth: '100%' }}>{deadlineWord(insights.daysLeft)}</T>
            )}
          </Row>
        </Row>
      </Card>

      {insights.health === 'past-deadline' && (
        <Row>
          <Button compact title="Mark reached" onPress={() => status('completed')} style={{ flex: 1 }} />
          <Button compact kind="secondary" title="New deadline" onPress={editGoal} style={{ flex: 1 }} />
        </Row>
      )}

      {insights.questCompletions.length > 0 && <QuestBreakdown key={goal.id} quests={insights.questCompletions} goalTitle={goal.title} onAdd={addQuest} />}

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

      <SectionLabel right={linked.length > 0 ? <Button compact kind="secondary" icon="add" title="Add quest" onPress={addQuest} accessibilityLabel={`Add a quest to ${goal.title}`} /> : undefined}>
        Linked quests
      </SectionLabel>
      {linked.length === 0 ? (
        <Card tone="cream" style={{ alignItems: 'center' }}>
          <Mascot mood="happy" size={64} />
          <T kind="bodyStrong" style={{ textAlign: 'center' }}>
            What will move this goal forward?
          </T>
          <T kind="small" style={{ textAlign: 'center' }}>
            Add quests like “Apply to 3 jobs a week” or “Cook a new recipe every Sunday”. How well you keep them sets this goal’s status.
          </T>
          <Button title="Add a quest" icon="add" onPress={addQuest} style={{ alignSelf: 'stretch' }} accessibilityLabel={`Add a quest to ${goal.title}`} />
        </Card>
      ) : (
        <View style={{ gap: space.md }}>
          {linked.map((q) => (
            <LinkedQuest key={q.task.id} standing={q} item={openItem(s, q, today)} today={today} />
          ))}
        </View>
      )}

      <SectionLabel>Goal status</SectionLabel>
      <View style={{ gap: space.sm }}>
        {goal.status !== 'completed' && insights.health !== 'past-deadline' && <Button kind="secondary" title="Mark goal reached" onPress={() => status('completed')} />}
        {goal.status !== 'active' && <Button kind="secondary" title="Reopen goal" onPress={() => status('active')} />}
        {goal.status !== 'archived' && <Button kind="tertiary" title="Archive goal" onPress={() => status('archived')} />}
      </View>
    </Screen>
  );
}

const BREAKDOWN_RANGES = [
  { value: 'totalDone', label: 'All time' },
  { value: 'recentDone', label: 'Last 4 weeks' },
] as const;

function QuestBreakdown({ quests, goalTitle, onAdd }: { quests: QuestCompletions[]; goalTitle: string; onAdd: () => void }) {
  const [range, setRange] = useState<(typeof BREAKDOWN_RANGES)[number]['value']>('totalDone');
  const rows = [...quests].sort((a, b) => b[range] - a[range] || a.task.title.localeCompare(b.task.title));
  const total = rows.reduce((sum, quest) => sum + quest[range], 0);

  return (
    <>
      <SectionLabel right={
        <View accessibilityLiveRegion="polite">
          <T kind="meta">{total} {total === 1 ? 'completion' : 'completions'}</T>
        </View>
      }>Quest breakdown</SectionLabel>
      <Card style={{ gap: space.md }}>
        <Segmented options={[...BREAKDOWN_RANGES]} value={range} onChange={setRange} />
        {rows.map(({ task, ...counts }) => (
          <View key={task.id} style={{ gap: space.xs }}>
            <Row style={{ flexWrap: 'wrap', justifyContent: 'space-between' }}>
              <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 160 }}>
                <T kind="bodyStrong">{task.title}</T>
                {!task.active && <T kind="meta">Archived</T>}
              </View>
              <T kind="small">{counts[range]} done</T>
            </Row>
            <View aria-hidden>
              <ProgressBar ratio={total > 0 ? counts[range] / total : 0} height={5} />
            </View>
          </View>
        ))}
        <Button compact kind="secondary" icon="add" title="Add quest" onPress={onAdd} accessibilityLabel={`Add a quest to ${goalTitle}`} style={{ alignSelf: 'flex-start' }} />
      </Card>
    </>
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
              {task.icon || task.color ? <QuestMark task={task} /> : (
                <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: lastDone ? p.forest : p.track }}>
                  <Ionicons name={lastDone ? 'checkmark' : 'remove'} size={17} color={lastDone ? p.onForest : p.faint} />
                </View>
              )}
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
