import { format } from 'date-fns';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { fromLocalDate } from '@/domain/dates';
import { allowanceFor, coinBalance, enabledApps } from '@/domain/economy';
import { questBoard, sideQuestWarning, todayProgress, type TodayProgress } from '@/domain/selectors';
import { useStore, useToday } from '@/state/store';
import { Coin, Mascot } from '@/ui/art';
import {
  Button,
  Card,
  IconButton,
  IconTile,
  Ionicons,
  Row,
  Screen,
  ScreenHeader,
  StatusChip,
  T,
  UnderlineTabs,
} from '@/ui/components';
import { ProgressRing } from '@/ui/progress-ring';
import { QuestListCard, QuestRows } from '@/ui/quest-row';
import { font, space, usePalette } from '@/ui/theme';

const QUEST_PREVIEW_LIMIT = 3;
const SIDE_PREVIEW_LIMIT = 2;

type TodayTab = 'main' | 'side';

/**
 * Today (addendum A4 §2): doing a quest comes first. Main and Side quest tabs (the selected
 * Underline design) sit right under the heading and show one list at a time. Completed today
 * stays below either tab and shows that tab's quest type; the Time Bank summary is shared.
 */
export default function Today() {
  const p = usePalette();
  const s = useStore((st) => st.snapshot);
  const today = useToday();
  const date = fromLocalDate(today);
  const [tab, setTab] = useState<TodayTab>('main');
  const [showCompleted, setShowCompleted] = useState(false);
  const [expandedOn, setExpandedOn] = useState<string>();
  const day = allowanceFor(s, today);
  const balance = coinBalance(s.wallet);
  const screenTimeReady = enabledApps(s.apps).length > 0;
  const board = questBoard(s, today, 'today');
  const sideBoard = questBoard(s, today, 'today', 'side');
  const due = [...board.overdue, ...board.todo];
  const sideDue = [...sideBoard.overdue, ...sideBoard.todo];
  // Side quests inside their warning period show up before they're due (e.g. an oil change 2 weeks out).
  const sideSoon = sideBoard.upcoming.filter((i) => i.warning === 'soon');
  // Oldest due first (overdue, then today), then those due soon; with neither, the next upcoming one.
  const sideUrgent = [...sideDue, ...sideSoon];
  const sidePreview = sideUrgent.length > 0 ? sideUrgent.slice(0, SIDE_PREVIEW_LIMIT) : sideBoard.upcoming.slice(0, 1);
  const warning = sideQuestWarning(s, today);
  const warningLabel = warning.level === 'overdue'
    ? `${warning.overdue} overdue`
    : warning.level === 'soon' ? `${warning.soon} due soon` : undefined;
  // Completed today follows the selected tab: main quests under Main, side quests under Side.
  const tabBoard = tab === 'main' ? board : sideBoard;
  const completed = tabBoard.completed;
  const completedCount = tabBoard.doneCount;
  const progress = todayProgress(s, today, tab);
  const remaining = due.slice(QUEST_PREVIEW_LIMIT);
  const showMore = expandedOn === today;
  const hasUpcoming = board.upcoming.length > 0;
  const openBank = () => router.push('/bank');
  const planAhead = () => router.push({ pathname: '/quests', params: { view: 'all' } });
  const addQuest = () => router.push('/task-form');
  const addSideQuest = () => router.push({ pathname: '/task-form', params: { type: 'side' } });
  const openSideQuests = () => router.push({ pathname: '/quests', params: { view: 'side' } });
  const emptyTitle = board.doneCount > 0 ? 'All done for today' : hasUpcoming ? 'Nothing due today' : 'Your list is clear';
  const rowDivider = { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: p.border };

  return (
    <Screen tabs>
      <ScreenHeader
        title={format(date, 'EEEE')}
        subtitle={`${format(date, 'd MMMM')}${s.settings.dayOffset ? ' · simulated' : ''}`}
        right={<IconButton icon="settings-outline" label="Settings" onPress={() => router.push('/settings')} />}
      />

      <UnderlineTabs
        label="Quest type"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'main', label: 'Main quests' },
          {
            value: 'side',
            label: 'Side quests',
            accessibilityLabel: warningLabel ? `Side quests, ${warningLabel}` : undefined,
            trailing: warning.level && <Ionicons name="warning" size={16} color={warning.level === 'overdue' ? p.roseInk : p.goldInk} aria-hidden />,
          },
        ]}
      />

      {progress.total > 0 && (tab === 'main' ? due.length === 0 : sidePreview.length === 0) && (
        <TodayRing progress={progress} side={tab === 'side'} />
      )}

      {tab === 'main' ? (
        <View style={styles.section}>
          {due.length > 0 ? (
            <>
              <QuestListCard>
                <ActiveHeader progress={progress} side={false} />
                <QuestRows items={due.slice(0, QUEST_PREVIEW_LIMIT)} today={today} divideFirst />
                {remaining.length > 0 && (
                  <>
                    <Pressable
                      accessibilityRole="button"
                      aria-expanded={showMore}
                      onPress={() => setExpandedOn(showMore ? undefined : today)}
                      style={({ pressed }) => [styles.moreQuests, rowDivider, pressed && styles.pressed]}>
                      <T kind="bodyStrong" color={p.forest}>
                        {showMore ? 'Show fewer quests' : `Show ${remaining.length} more ${remaining.length === 1 ? 'quest' : 'quests'}`}
                      </T>
                      <Ionicons name={showMore ? 'chevron-up' : 'chevron-down'} size={16} color={p.forest} aria-hidden />
                    </Pressable>
                    {showMore && <QuestRows items={remaining} today={today} divideFirst />}
                  </>
                )}
              </QuestListCard>
            </>
          ) : (
            <Card style={styles.emptyCard}>
              <Row gap={space.md}>
                <View aria-hidden style={{ flexShrink: 0 }}>
                  <Mascot mood={board.doneCount > 0 ? 'cheer' : 'happy'} size={64} />
                </View>
                <View style={styles.grow}>
                  <T kind="h2" accessibilityRole="header">{emptyTitle}</T>
                  <T kind="small">
                    {hasUpcoming ? 'Your next quests are on the board.' : board.doneCount > 0 ? 'You’ve cleared your list.' : 'Pick something small you can do today.'}
                  </T>
                </View>
              </Row>
              <Button
                compact
                title={hasUpcoming ? 'Plan ahead' : 'Add a quest'}
                icon={hasUpcoming ? 'calendar-outline' : 'add'}
                onPress={hasUpcoming ? planAhead : addQuest}
                style={styles.emptyAction}
              />
            </Card>
          )}
        </View>
      ) : (
        <View style={styles.section}>
          {sidePreview.length > 0 ? (
            <QuestListCard>
              <ActiveHeader
                progress={progress}
                side
                note={sideUrgent.length > 0
                  ? [sideDue.length > 0 && `${sideDue.length} due`, sideSoon.length > 0 && `${sideSoon.length} due soon`].filter(Boolean).join(' · ')
                  : 'Nothing due · next up'}
                trailing={<Button compact kind="ghost" title="See all" accessibilityLabel="See all side quests" onPress={openSideQuests} />}
              />
              <QuestRows items={sidePreview} today={today} divideFirst />
            </QuestListCard>
          ) : (
            <Card style={styles.emptyCard}>
              <Row gap={space.md}>
                <View aria-hidden style={{ flexShrink: 0 }}>
                  <Mascot mood="happy" size={64} />
                </View>
                <View style={styles.grow}>
                  <T kind="h2" accessibilityRole="header">No side quests</T>
                  <T kind="small">Errands and one-off jobs go here, apart from your goals.</T>
                </View>
              </Row>
              <Button compact title="Add a side quest" icon="add" onPress={addSideQuest} style={styles.emptyAction} />
            </Card>
          )}
        </View>
      )}

      <QuestListCard>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Completed today, ${completedCount} ${completedCount === 1 ? 'completion' : 'completions'}`}
          aria-expanded={showCompleted}
          onPress={() => setShowCompleted((open) => !open)}
          style={({ pressed }) => [
            styles.completedToggle,
            pressed && styles.pressed,
          ]}>
          <T kind="bodyStrong" style={styles.grow}>Completed today</T>
          <T kind="meta">{completedCount}</T>
          <Ionicons name={showCompleted ? 'chevron-up' : 'chevron-down'} size={16} color={p.muted} aria-hidden />
        </Pressable>
        {showCompleted && (
          completed.length > 0 ? (
            <QuestRows items={completed} today={today} divideFirst />
          ) : (
            <T kind="small" style={styles.completedEmpty}>{tab === 'main' ? 'No quests' : 'No side quests'} completed yet today.</T>
          )
        )}
      </QuestListCard>

      <Pressable
        onPress={openBank}
        accessibilityRole="button"
        accessibilityLabel={`Open Time Bank. ${screenTimeReady ? `${day.remainingMinutes} minutes of screen time left.` : 'Screen time setup available.'} ${balance} coins. Demo mode.`}
        style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}>
        <Card style={styles.bankCard}>
          <Row style={styles.bankHeading}>
            <T kind="h3" style={styles.grow}>Time Bank</T>
            <StatusChip tone="demo" icon="flask-outline" label="Demo mode" />
            <Ionicons name="chevron-forward" size={16} color={p.muted} aria-hidden />
          </Row>
          <Row gap={space.md} style={[styles.bankMetrics, { borderTopColor: p.border }]}>
            <Row style={styles.metric}>
              <IconTile icon="time-outline" bg={p.sky} color={p.ink} size={32} />
              <View style={styles.grow}>
                <T kind={screenTimeReady ? 'h2' : 'bodyStrong'}>{screenTimeReady ? `${day.remainingMinutes} min` : 'Set up'}</T>
                <T kind="meta">{screenTimeReady ? 'Screen time left' : 'Screen time'}</T>
              </View>
            </Row>
            <Row style={styles.metric}>
              <Coin size={29} />
              <View style={styles.grow}>
                <T kind="h2">{balance}</T>
                <T kind="meta">Coins</T>
              </View>
            </Row>
          </Row>
          {screenTimeReady && day.blocked && <T kind="small" color={p.forest}>Time used up today · Buy extra time</T>}
        </Card>
      </Pressable>
    </Screen>
  );
}

/**
 * The top of the Active quests card: the progress ring, the title, and how many are logged and
 * left (plus, for side quests, what's due and a See all link).
 */
function ActiveHeader({ progress, side, note, trailing }: {
  progress: TodayProgress;
  side: boolean;
  note?: string;
  trailing?: ReactNode;
}) {
  const { logged, total, left } = progress;
  const noun = side ? 'side quest' : 'quest';
  const count = left === 0 ? `All ${noun}s logged today` : `${logged} of ${total} logged today · ${left} left`;
  return (
    <View style={styles.activeHeader}>
      {total > 0 && <RingDial progress={progress} size={52} />}
      <View style={styles.grow}>
        <T kind="h3" accessibilityRole="header">{side ? 'Active side quests' : 'Active quests'}</T>
        <T kind="meta">{total > 0 ? count : note}</T>
        {total > 0 && !!note && <T kind="meta">{note}</T>}
      </View>
      {trailing}
    </View>
  );
}

/** The ring itself: rose at zero, amber while it builds, green when full. */
function RingDial({ progress, size }: { progress: TodayProgress; size: number }) {
  const p = usePalette();
  const { logged, total, left } = progress;
  const tone = logged === 0
    ? { arc: p.roseInk, track: p.rose, ink: p.roseInk }
    : left === 0 ? { arc: p.forestBright, track: p.track, ink: p.forest }
    : { arc: p.gold, track: p.track, ink: p.goldInk };
  const plural = (n: number) => `${n} quest${n === 1 ? '' : 's'}`;
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`${logged} of ${plural(total)} logged today${left === 0 ? '' : `, ${left} left`}`}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={logged}>
      <ProgressRing ratio={total ? logged / total : 0} size={size} stroke={6} color={tone.arc} track={tone.track}>
        {/* Capped so large text sizes keep the count inside the ring; the row beside it scales freely. */}
        <Text maxFontSizeMultiplier={1.2} style={[styles.ringCount, { color: tone.ink, fontSize: `${logged}/${total}`.length > 4 ? 12 : 14 }]}>
          {logged}/{total}
        </Text>
      </ProgressRing>
    </View>
  );
}

/**
 * One ring above the selected list (addendum A4 §2, Today progress ring): distinct quests logged
 * today out of those available or logged today. Rose at zero, amber while it builds, green when full.
 */
function TodayRing({ progress, side }: { progress: TodayProgress; side: boolean }) {
  const { logged, total, left } = progress;
  const noun = side ? 'side quest' : 'quest';
  const plural = (n: number) => `${n} ${noun}${n === 1 ? '' : 's'}`;
  return (
    <View style={styles.ring}>
      <RingDial progress={progress} size={64} />
      <View style={styles.grow}>
        <T kind="bodyStrong">{left === 0 ? `All ${noun}s logged today` : `${plural(left)} left to log`}</T>
        <T kind="meta">{logged} of {plural(total)} logged today</T>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  activeHeader: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md },
  ring: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  ringCount: { fontFamily: font.bold, fontVariant: ['tabular-nums'] },
  section: { gap: space.sm },
  grow: { flex: 1 },
  moreQuests: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm,
    paddingVertical: space.sm, paddingHorizontal: space.md, minHeight: 44,
  },
  emptyCard: { gap: space.md },
  emptyAction: { alignSelf: 'flex-start' },
  completedToggle: { flexDirection: 'row', alignItems: 'center', minHeight: 44, paddingHorizontal: space.md, gap: space.sm },
  completedEmpty: { paddingHorizontal: space.md, paddingBottom: space.md },
  bankCard: { gap: space.sm },
  bankHeading: { flexWrap: 'wrap' },
  bankMetrics: { borderTopWidth: 1, paddingTop: space.md, flexWrap: 'wrap' },
  metric: { flexGrow: 1, flexShrink: 1, flexBasis: 100 },
  pressed: { opacity: 0.72 },
});
