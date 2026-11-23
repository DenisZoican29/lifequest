import { format } from 'date-fns';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { fromLocalDate } from '@/domain/dates';
import { goalInsights } from '@/domain/goal-insights';
import { goalShares, type GoalShare, type ShareRange } from '@/domain/goal-share';
import type { LocalDate } from '@/domain/types';
import { useStore, useToday } from '@/state/store';

import { Button, Card, Chip, CoinAmount, Ionicons, Row, SectionLabel, StatusChip, T } from './components';
import { DateRangeDialog } from './date-range-dialog';
import { goalColor, TerritoryMap } from './goal-charts';
import { GoalMark } from './goal-mark';
import { font, radius, space, usePalette } from './theme';
import { healthStyle } from './visuals';

const PRESETS: { value: '7d' | '4w'; label: string }[] = [
  { value: '7d', label: 'Last 7 days' },
  { value: '4w', label: 'Last 4 weeks' },
];
const day = (d: LocalDate) => format(fromLocalDate(d), 'd MMM yyyy');

/** The exact applied dates, shown above the map even when the period is empty. */
function rangeText(from: LocalDate | undefined, to: LocalDate): string {
  if (!from) return `All time · through ${day(to)}`;
  if (from === to) return day(from);
  return `${day(from)} – ${day(to)}`;
}

function rangeWordFor(range: ShareRange): string {
  if (range === '7d') return 'in the last 7 days';
  if (range === '4w') return 'in the last 4 weeks';
  if (range === 'all') return 'so far';
  return 'in this period';
}

const openGoal = (id: string) => router.push({ pathname: '/goal/[id]', params: { id } });
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * Roadmap → Active (addendum A3 §6, A4 §3): each active goal's share of the quests you've done, as
 * territories on an island, then every active goal as a row. Tapping a territory previews it in
 * place; **Open goal** and the rows navigate. Roadmap stays mounted under the goal page, so range
 * and selection survive the trip. Render only when there is at least one active goal.
 */
export function GoalsOverview() {
  const p = usePalette();
  const s = useStore((st) => st.snapshot);
  const today = useToday();
  const [range, setRange] = useState<ShareRange>('4w');
  const [selectedId, setSelectedId] = useState<string>();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const calendarActive = typeof range === 'object' || range === 'all';
  const data = useMemo(() => goalShares(s, today, range, 'active'), [s, today, range]);
  const unlinkedQuests = s.tasks.filter((t) => t.active && t.taskType === 'main' && !t.goalId).length;
  const rangeWord = rangeWordFor(range);

  // Keep the chosen goal while it has a territory; otherwise the leading one. None when nothing was done.
  const mapped = data.parts.filter((x) => x.done > 0);
  const selected = mapped.find((x) => x.goal.id === selectedId) ?? mapped[0];

  return (
    <>
      <Card style={{ gap: space.md }}>
        <View style={{ gap: 4 }}>
          <T kind="eyebrow">Where your effort went</T>
          <T kind="h2">{data.total === 0 ? 'Nothing done yet' : `${plural(data.total, 'quest')} done`}</T>
          <Row gap={6} style={{ flexWrap: 'wrap' }}>
            <T kind="meta">
              {rangeText(data.from, data.to)}
              {data.total > 0 ? ` · ${plural(mapped.length, 'goal')} ·` : ''}
            </T>
            {data.total > 0 && <CoinAmount amount={data.coins} size={14} />}
          </Row>
          <T kind="small">Larger territories show more quests done.</T>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }} accessibilityLabel="Time range">
          {PRESETS.map((r) => (
            <Chip key={r.value} label={r.label} selected={range === r.value} onPress={() => setRange(r.value)} />
          ))}
          <Chip icon="calendar-outline" label="Calendar" selected={calendarActive} onPress={() => setCalendarOpen(true)} />
        </View>
        {calendarOpen && (
          <DateRangeDialog
            today={today}
            initial={typeof range === 'object' ? range : undefined}
            onClose={() => setCalendarOpen(false)}
            onAllTime={() => {
              setRange('all');
              setCalendarOpen(false);
            }}
            onApply={(r) => {
              setRange(r);
              setCalendarOpen(false);
            }}
          />
        )}

        {data.total === 0 || !selected ? (
          <View style={{ backgroundColor: p.canvas, borderRadius: radius.md, padding: space.lg, gap: 4 }}>
            <T kind="bodyStrong">No territories yet</T>
            <T kind="small">No linked quests were done {rangeWord}. Finish one and its goal claims land here.</T>
          </View>
        ) : (
          <>
            <TerritoryMap parts={data.parts} selectedId={selected.goal.id} onSelect={(x) => setSelectedId(x.goal.id)} />
            <Preview part={selected} />
          </>
        )}
      </Card>

      <SectionLabel>Your active goals</SectionLabel>
      <View style={{ gap: space.sm }}>
        {data.parts.map((part) => (
          <ShareRow key={part.goal.id} part={part} empty={data.total === 0} rangeWord={rangeWord} />
        ))}
      </View>

      {unlinkedQuests > 0 && (
        <Card tone="cream">
          <Row gap={space.md} style={{ alignItems: 'flex-start' }}>
            <Ionicons name="link-outline" size={20} color={p.forest} style={{ marginTop: 2 }} />
            <View style={{ flex: 1, gap: 2 }}>
              <T kind="bodyStrong">
                {unlinkedQuests} quest{unlinkedQuests === 1 ? ' is' : 's are'} not linked to a goal
              </T>
              <T kind="small">
                {data.unlinkedDone > 0 ? `${plural(data.unlinkedDone, 'completion')} ${rangeWord} aren’t part of this map. ` : ''}
                Open a quest and pick a goal to count it.
              </T>
            </View>
          </Row>
          <Button compact kind="secondary" title="Go to quests" onPress={() => router.push('/quests')} />
        </Card>
      )}
    </>
  );
}

/** The selected territory, in place: full name, share, quests done and **Open goal**. Announced once on change. */
function Preview({ part }: { part: GoalShare }) {
  const p = usePalette();
  return (
    <View style={{ borderColor: p.border, borderLeftColor: goalColor(p, part.slot), borderWidth: 1, borderLeftWidth: 3, borderRadius: radius.md, padding: space.md, gap: space.sm }}>
      <View
        accessible
        accessibilityLiveRegion="polite"
        accessibilityLabel={`Selected: ${part.goal.title}. ${part.percent}% of quests done, ${plural(part.done, 'quest')} done.`}
        style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <View style={{ flex: 1, gap: 2 }}>
          <T kind="bodyStrong">{part.goal.title}</T>
          <T kind="meta">{plural(part.done, 'quest')} done</T>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <T kind="h2" style={{ fontVariant: ['tabular-nums'] }}>{part.percent}%</T>
          <T kind="meta">of total</T>
        </View>
      </View>
      <Button compact kind="secondary" title="Open goal" onPress={() => openGoal(part.goal.id)} />
    </View>
  );
}

/** One goal: its mark (ringed in its map colour when it has a territory), full name, share and a bar. Opens the goal. */
function ShareRow({ part, empty, rangeWord }: { part: GoalShare; empty: boolean; rangeWord: string }) {
  const p = usePalette();
  const s = useStore((st) => st.snapshot);
  const today = useToday();
  const hs = healthStyle(useMemo(() => goalInsights(s, part.goal, today).health, [s, part.goal, today]));
  const mappedColor = part.done > 0 ? goalColor(p, part.slot) : undefined;
  const share = empty ? '–' : `${part.percent}%`;
  return (
    <Pressable
      onPress={() => openGoal(part.goal.id)}
      accessibilityRole="button"
      accessibilityLabel={`${part.goal.title}. ${empty ? 'No share yet' : `${part.percent}% of quests done`}, ${plural(part.done, 'quest')} done ${rangeWord}. ${hs.label}. Open goal.`}
      style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}>
      <Card style={{ gap: space.sm }}>
        <Row gap={space.md}>
          <GoalMark goal={part.goal} size={36} ring={mappedColor} />
          <T kind="bodyStrong" style={{ flex: 1 }}>
            {part.goal.title}
          </T>
          <T kind="h3" style={{ fontFamily: font.bold }}>
            {share}
          </T>
          <Ionicons name="chevron-forward" size={18} color={p.faint} />
        </Row>
        {mappedColor && (
          <View style={{ height: 6, borderRadius: 3, backgroundColor: p.track, overflow: 'hidden' }}>
            <View style={{ width: `${part.share * 100}%`, height: 6, borderRadius: 3, backgroundColor: mappedColor }} />
          </View>
        )}
        <Row style={{ flexWrap: 'wrap' }}>
          <T kind="meta" style={{ flexGrow: 1, flexShrink: 1 }}>
            {part.done === 0 ? `No quests done ${rangeWord}` : `${plural(part.done, 'quest')} done · ${part.coins} coins`}
          </T>
          <StatusChip tone={hs.chip} icon={hs.icon} label={hs.label} />
        </Row>
      </Card>
    </Pressable>
  );
}
