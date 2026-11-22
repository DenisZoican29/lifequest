import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { goalInsights, type GoalInsights } from '@/domain/goal-insights';
import type { Goal, GoalStatus } from '@/domain/types';
import { useStore, useToday } from '@/state/store';
import { Button, Card, EmptyState, IconButton, Ionicons, ProgressBar, Row, Screen, ScreenHeader, Segmented, StatusChip, T } from '@/ui/components';
import { ConsistencyRing, WeekSpark } from '@/ui/goal-charts';
import { font, space, usePalette } from '@/ui/theme';
import { deadlineWord, healthStyle } from '@/ui/visuals';

const VIEWS: { value: GoalStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Reached' },
  { value: 'archived', label: 'Archived' },
];

/** Roadmap: your end goals, each with a status driven by its linked quests (spec addendum A1). */
export default function Roadmap() {
  const p = usePalette();
  const s = useStore((st) => st.snapshot);
  const today = useToday();
  const [view, setView] = useState<GoalStatus>('active');

  const goals = useMemo(
    () =>
      s.goals
        .filter((g) => g.status === view)
        .sort((a, b) => (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999') || a.title.localeCompare(b.title))
        .map((g) => ({ goal: g, insights: goalInsights(s, g, today) })),
    [s, view, today],
  );
  const unlinked = s.tasks.filter((t) => t.active && t.taskType === 'main' && !t.goalId).length;

  return (
    <Screen tabs>
      <ScreenHeader
        eyebrow="Your direction"
        title="My roadmap"
        subtitle="Big goals, small steps."
        right={<IconButton icon="add" label="New goal" onPress={() => router.push('/goal-form')} />}
      />

      <Segmented options={VIEWS} value={view} onChange={setView} />

      {goals.length === 0 ? (
        view === 'active' ? (
          <EmptyState
            mood="happy"
            title="Where would you like to go?"
            body="Add an end goal with a deadline, like getting a new job, getting in better shape or cooking better. Then link quests to it and we'll show how you're doing."
            action={<Button title="Create a goal" onPress={() => router.push('/goal-form')} />}
          />
        ) : (
          <EmptyState mood="sleepy" title={view === 'completed' ? 'No goals reached yet' : 'No archived goals'} />
        )
      ) : (
        <View style={{ gap: space.md }}>
          {goals.map(({ goal, insights }) => (
            <GoalCard key={goal.id} goal={goal} insights={insights} />
          ))}
        </View>
      )}

      {view === 'active' && unlinked > 0 && (
        <Card tone="cream">
          <Row gap={space.md} style={{ alignItems: 'flex-start' }}>
            <Ionicons name="link-outline" size={20} color={p.forest} style={{ marginTop: 2 }} />
            <View style={{ flex: 1, gap: 2 }}>
              <T kind="bodyStrong">
                {unlinked} quest{unlinked === 1 ? ' is' : 's are'} not linked to a goal
              </T>
              <T kind="small">Open a quest and pick a goal, and it will count toward that goal’s status.</T>
            </View>
          </Row>
          <Button compact kind="secondary" title="Go to quests" onPress={() => router.push('/quests')} />
        </Card>
      )}
    </Screen>
  );
}

function GoalCard({ goal, insights }: { goal: Goal; insights: GoalInsights }) {
  const p = usePalette();
  const hs = healthStyle(insights.health);
  const linked = insights.quests.filter((q) => q.task.active).length;
  const summary =
    insights.consistency === null
      ? hs.message
      : `Kept ${Math.round(insights.consistency * 100)}% of your plan in the last 4 weeks.`;
  return (
    <Pressable onPress={() => router.push({ pathname: '/goal/[id]', params: { id: goal.id } })} accessibilityRole="button" accessibilityLabel={`${goal.title}. ${hs.label}. ${deadlineWord(insights.daysLeft)}.`}>
      <Card style={{ gap: space.md }}>
        <Row style={{ alignItems: 'flex-start' }}>
          <T kind="h3" style={{ flex: 1 }} numberOfLines={2}>
            {goal.title}
          </T>
          <Ionicons name="chevron-forward" size={18} color={p.faint} style={{ marginTop: 3 }} />
        </Row>
        <Row style={{ flexWrap: 'wrap' }}>
          <StatusChip tone={hs.chip} icon={hs.icon} label={hs.label} />
          <StatusChip tone={insights.daysLeft !== undefined && insights.daysLeft < 0 && goal.status === 'active' ? 'overdue' : 'neutral'} icon="flag-outline" label={deadlineWord(insights.daysLeft)} />
        </Row>
        <Row gap={space.md}>
          <ConsistencyRing ratio={insights.consistency} size={56} stroke={7} />
          <View style={{ flex: 1, gap: 2 }}>
            <T kind="small" color={p.ink}>
              {summary}
            </T>
            <T kind="meta">
              {linked} quest{linked === 1 ? '' : 's'}
              {insights.streak > 0 ? ` · ${insights.streak}-week streak` : ''}
            </T>
          </View>
          <WeekSpark weeks={insights.weeks.slice(-8)} />
        </Row>
        {insights.timeUsed !== undefined && goal.status === 'active' && (
          <View style={{ gap: 4 }}>
            <ProgressBar ratio={insights.timeUsed} height={6} color={p.faint} />
            <Row style={{ justifyContent: 'space-between' }}>
              <T kind="meta">Time used</T>
              <T kind="meta" style={{ fontFamily: font.bold }}>
                {Math.round(insights.timeUsed * 100)}%
              </T>
            </Row>
          </View>
        )}
      </Card>
    </Pressable>
  );
}
