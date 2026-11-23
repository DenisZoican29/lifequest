import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { goalInsights, type GoalInsights } from '@/domain/goal-insights';
import { goalSlots } from '@/domain/goal-share';
import type { Goal } from '@/domain/types';
import { useStore, useToday } from '@/state/store';
import { Button, Card, EmptyState, Ionicons, Row, Screen, ScreenHeader, StatusChip, T, UnderlineTabs } from '@/ui/components';
import { goalColor } from '@/ui/goal-charts';
import { GoalMark } from '@/ui/goal-mark';
import { GoalsOverview } from '@/ui/goals-overview';
import { space, usePalette } from '@/ui/theme';
import { healthStyle } from '@/ui/visuals';

type RoadmapView = 'active' | 'reached';

const VIEWS: { value: RoadmapView; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'reached', label: 'Reached' },
];

const byDeadline = (a: Goal, b: Goal) => (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999') || a.title.localeCompare(b.title);

/**
 * Roadmap (addendum A4 §3): **Active** is the goals overview (territory map and every active goal);
 * **Reached** lists finished goals, with archived ones in a collapsed section below.
 */
export default function Roadmap() {
  const p = usePalette();
  const s = useStore((st) => st.snapshot);
  const today = useToday();
  const [view, setView] = useState<RoadmapView>('active');
  const [showArchived, setShowArchived] = useState(false);
  const newGoal = () => router.push('/goal-form');

  const activeCount = s.goals.filter((g) => g.status === 'active').length;
  const reached = useMemo(() => s.goals.filter((g) => g.status === 'completed').sort(byDeadline), [s.goals]);
  const archived = useMemo(() => s.goals.filter((g) => g.status === 'archived').sort(byDeadline), [s.goals]);
  // The goal's map colour (fixed by creation order), so its mark looks the same here and on the map.
  const slotOf = goalSlots(s);
  const row = (goal: Goal) => (
    <GoalRow
      key={goal.id}
      goal={goal}
      insights={goalInsights(s, goal, today)}
      ring={slotOf.has(goal.id) ? goalColor(p, slotOf.get(goal.id)!) : undefined}
    />
  );

  return (
    <Screen tabs>
      <ScreenHeader
        title="My roadmap"
        right={<Button compact icon="add" title="New goal" onPress={newGoal} />}
      />

      <UnderlineTabs options={VIEWS} value={view} onChange={setView} label="Goal status" />

      {view === 'active' ? (
        activeCount > 0 ? (
          <GoalsOverview />
        ) : (
          <EmptyState
            mood="happy"
            title="Where would you like to go?"
            body="Add an end goal, like getting a new job, getting in better shape or cooking better. Then link quests to it and we'll show how you're doing."
            action={<Button title="Create a goal" icon="add" onPress={newGoal} />}
          />
        )
      ) : (
        <>
          {reached.length > 0 ? (
            <View style={{ gap: space.sm }}>{reached.map(row)}</View>
          ) : (
            <EmptyState mood="sleepy" title="No goals reached yet" body="When you mark a goal as reached, it moves here." />
          )}
          {archived.length > 0 && (
            <>
              <Pressable
                onPress={() => setShowArchived((v) => !v)}
                accessibilityRole="button"
                aria-expanded={showArchived}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 44, opacity: pressed ? 0.7 : 1 })}>
                <Ionicons name={showArchived ? 'chevron-down' : 'chevron-forward'} size={18} color={p.forest} />
                <T kind="bodyStrong" color={p.forest}>
                  Archived goals ({archived.length})
                </T>
              </Pressable>
              {showArchived && <View style={{ gap: space.sm }}>{archived.map(row)}</View>}
            </>
          )}
        </>
      )}
    </Screen>
  );
}

/** One goal: its mark, full title, status and one progress signal (plan kept, last 4 weeks). */
function GoalRow({ goal, insights, ring }: { goal: Goal; insights: GoalInsights; ring?: string }) {
  const p = usePalette();
  const hs = healthStyle(insights.health);
  const signal =
    insights.consistency === null ? 'No progress score yet' : `Kept ${Math.round(insights.consistency * 100)}% of the plan · last 4 weeks`;
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/goal/[id]', params: { id: goal.id } })}
      accessibilityRole="button"
      accessibilityLabel={`${goal.title}. ${hs.label}. ${signal}. Open goal.`}
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
      <Card style={{ gap: space.sm }}>
        <Row gap={space.md} style={{ alignItems: 'flex-start' }}>
          <GoalMark goal={goal} size={40} ring={ring} />
          <View style={{ flex: 1, gap: 6 }}>
            <T kind="h3">{goal.title}</T>
            <Row style={{ flexWrap: 'wrap' }}>
              <StatusChip tone={hs.chip} icon={hs.icon} label={hs.label} />
              <T kind="meta">{signal}</T>
            </Row>
          </View>
          <Ionicons name="chevron-forward" size={18} color={p.faint} style={{ marginTop: 10 }} />
        </Row>
      </Card>
    </Pressable>
  );
}
