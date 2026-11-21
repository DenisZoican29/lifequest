import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { goalProgress, sortedMilestones } from '@/domain/selectors';
import type { Cadence } from '@/domain/types';
import { useStore } from '@/state/store';
import { Button, Card, Chip, EmptyState, IconButton, Ionicons, ProgressBar, Row, Screen, ScreenHeader, SectionLabel, T } from '@/ui/components';
import { MilestonePath } from '@/ui/milestone-path';
import { font, space, usePalette } from '@/ui/theme';
import { cadenceStyle } from '@/ui/visuals';

const FILTERS: { value: Cadence | 'all' | 'archived'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'daily', label: 'Daily' },
  { value: 'archived', label: 'Archived' },
];

/** Roadmap: a featured goal and its milestone path (spec §06). */
export default function Roadmap() {
  const p = usePalette();
  const s = useStore((st) => st.snapshot);
  const [filter, setFilter] = useState<Cadence | 'all' | 'archived'>('all');
  const [picked, setPicked] = useState<string | null>(null);

  const goals = s.goals
    .filter((g) => (filter === 'archived' ? g.status === 'archived' : g.status !== 'archived'))
    .filter((g) => filter === 'all' || filter === 'archived' || g.cadence === filter)
    .sort((a, b) => (a.status === b.status ? (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999') : a.status === 'active' ? -1 : 1));
  const goal = goals.find((g) => g.id === picked) ?? goals[0];

  return (
    <Screen tabs>
      <ScreenHeader
        eyebrow="Your direction"
        title="My roadmap"
        subtitle="Big plans, smaller steps."
        right={<IconButton icon="add" label="New goal" onPress={() => router.push('/goal-form')} />}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
        {FILTERS.map((f) => (
          <Chip key={f.value} label={f.label} selected={filter === f.value} onPress={() => setFilter(f.value)} />
        ))}
      </ScrollView>

      {!goal ? (
        <EmptyState
          mood={filter === 'archived' ? 'sleepy' : 'happy'}
          title={filter === 'archived' ? 'No archived goals' : 'Where would you like to go?'}
          body={filter === 'archived' ? undefined : 'Start with one goal. We will break it into small checkpoints together.'}
          action={filter !== 'archived' && <Button title="Create a goal" onPress={() => router.push('/goal-form')} />}
        />
      ) : (
        <>
          {goals.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
              {goals.map((g) => {
                const on = g.id === goal.id;
                return (
                  <Pressable
                    key={g.id}
                    onPress={() => setPicked(g.id)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: on }}
                    style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: on ? p.forest : p.border, backgroundColor: on ? p.surface : 'transparent' }}>
                    <T kind="small" color={on ? p.forest : p.muted} style={on ? { fontFamily: font.bold } : undefined}>
                      {g.title}
                    </T>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          <FeaturedGoal goalId={goal.id} />

          <SectionLabel>Your milestone path</SectionLabel>
          <MilestonePath goalId={goal.id} milestones={sortedMilestones(s, goal.id)} />
        </>
      )}
    </Screen>
  );
}

function FeaturedGoal({ goalId }: { goalId: string }) {
  const p = usePalette();
  const s = useStore((st) => st.snapshot);
  const goal = s.goals.find((g) => g.id === goalId)!;
  const progress = goalProgress(s, goal.id);
  const cs = cadenceStyle(goal.cadence);
  return (
    <Pressable onPress={() => router.push({ pathname: '/goal/[id]', params: { id: goal.id } })} accessibilityRole="button" accessibilityLabel={`Open goal ${goal.title}`}>
      <Card hero tone={cs.tone}>
        <Row style={{ justifyContent: 'space-between' }}>
          <T kind="eyebrow" color={p.ink}>
            {goal.status === 'completed' ? 'Completed goal' : cs.label}
          </T>
          <Ionicons name="chevron-forward" size={18} color={p.ink} />
        </Row>
        <T kind="title">{goal.title}</T>
        <View style={{ marginTop: space.xs, gap: 6 }}>
          <ProgressBar ratio={progress.ratio} color={p.forestBright} track={p.surface} />
          <T kind="meta" color={p.ink} style={{ alignSelf: 'flex-end', fontFamily: font.bold }}>
            {progress.total ? `${Math.round(progress.ratio * 100)}% complete` : 'Add a milestone to track progress'}
          </T>
        </View>
      </Card>
    </Pressable>
  );
}
