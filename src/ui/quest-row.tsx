import { format } from 'date-fns';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { formatFriendly, fromLocalDate } from '@/domain/dates';
import type { QuestItem, QuotaProgress } from '@/domain/selectors';
import { useStore } from '@/state/store';

import { Coin } from './art';
import { Card, Ionicons, Row, StatusChip, T } from './components';
import { QuestMark } from './goal-mark';
import { NotDoneSheet } from './not-done-sheet';
import { completeQuest } from './quest-completion';
import { SwipeToLog } from './swipe-to-log';
import { radius, space, usePalette } from './theme';
import { taskRepeatWord } from './visuals';

/** "1 of 3 this week", or "2 to go · 1 day left" when running behind. */
export function quotaChip(q: QuotaProgress): { tone: 'done' | 'overdue' | 'weekly'; label: string } {
  if (q.missed) return { tone: 'overdue', label: `Not done · ${q.done} of ${q.times}` };
  if (q.done >= q.times) return { tone: 'done', label: `${q.times} of ${q.times} ${q.periodLabel}` };
  if (q.behind) {
    const left = q.times - q.done;
    return { tone: 'overdue', label: `${left} to go · ${q.daysLeft} day${q.daysLeft === 1 ? '' : 's'} left` };
  }
  return { tone: 'weekly', label: `${q.done} of ${q.times} ${q.periodLabel}` };
}

/** The shared card surface for Today and Quests. */
export function QuestListCard({ children }: { children: ReactNode }) {
  return <Card style={styles.list}>{children}</Card>;
}

export function QuestRows({ items, today, divideFirst = false, showDue = true, showType = false }: {
  items: QuestItem[];
  today: string;
  divideFirst?: boolean;
  showDue?: boolean;
  /** Quests library: name the quest type under the title when no goal is linked. */
  showType?: boolean;
}) {
  const p = usePalette();
  return items.map((item, index) => (
    <View
      key={item.occurrence.id}
      style={(divideFirst || index > 0) && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: p.border }}>
      <QuestRow item={item} today={today} showDue={showDue} showType={showType} grouped />
    </View>
  ));
}

/** A compact row with a quest mark, context, and its schedule or progress. Tap to open. */
export function QuestRow({ item, today, showDue = true, showType = false, grouped = false }: {
  item: QuestItem;
  today: string;
  showDue?: boolean;
  showType?: boolean;
  grouped?: boolean;
}) {
  const p = usePalette();
  const { task, occurrence, quota } = item;
  const [sheet, setSheet] = useState(false);
  const goalTitle = useStore((st) => st.snapshot.goals.find((goal) => goal.id === task.goalId)?.title);
  const open = occurrence.status === 'open' && task.active;
  const typeLabel = showType && !goalTitle ? (task.taskType === 'side' ? 'Side quest' : 'Main quest') : undefined;
  const contextLabel = goalTitle ?? typeLabel;
  const done = occurrence.status === 'completed';
  const missed = open && !!quota?.missed;
  const future = item.dueInDays > 0;
  const side = task.taskType === 'side';
  const canSwipe = open && !future && !missed && (!quota || quota.done < quota.times);
  const due = occurrence.scheduledFor;
  const progress = side && future ? undefined : quota;
  const count = progress ? `${progress.done} of ${progress.times}` : undefined;
  const period = progress?.missed
    ? progress.periodLabel.replace(/^by /, 'Ended ')
    : progress?.periodLabel.replace(/^./, (letter) => letter.toUpperCase());
  // Side quests inside their warning period (e.g. 2 weeks before an oil change) turn amber.
  const soon = side && item.warning === 'soon';
  const timing = item.undated && !future ? (task.recurrence ? taskRepeatWord(task) : 'No due date')
    : side ? (item.overdue ? 'Overdue' : soon && item.dueInDays >= 7 ? `In ${item.dueInDays} days` : formatFriendly(due, today))
    : taskRepeatWord(task);
  const dateChip = open && !side && (
    item.overdue && !quota ? 'Overdue' : showDue && future ? `${task.window ? 'Starts ' : ''}${formatFriendly(due, today)}` : undefined
  );
  const completedOn = occurrence.completedOn;
  const closedLabel = !task.active ? 'Archived'
    : done
    ? completedOn === today ? 'Completed today' : completedOn ? `Completed ${format(fromLocalDate(completedOn), 'd MMM yyyy')}` : 'Completed'
    : 'Skipped';
  const progressLabel = count && progress
    ? `${count} completed ${progress.missed ? progress.periodLabel.replace(/^by /, 'ended ') : progress.periodLabel}`
    : timing;
  const label = open
    ? [`Open ${task.title}`, progressLabel, dateChip, soon && 'due soon'].filter(Boolean).join(', ')
    : `Open ${task.title}, ${closedLabel.toLowerCase()}`;
  const openQuest = () => {
    if (missed) setSheet(true);
    else router.push({ pathname: '/task-form', params: { id: task.id } });
  };

  return (
    <SwipeToLog
      enabled={canSwipe}
      onLog={() => void completeQuest(occurrence.id)}
      label={quota ? `Log one ${task.title}` : `Complete ${task.title}`}
      borderRadius={grouped ? 0 : radius.lg}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={openQuest}
        style={({ pressed }) => [
          styles.row,
          { backgroundColor: p.surface, borderColor: p.border },
          !grouped && styles.standalone,
          pressed && styles.pressed,
        ]}>
        <View style={{ opacity: open ? 1 : 0.6 }}>
          <QuestMark task={task} />
        </View>
        <View style={styles.details}>
          <T kind="bodyStrong" color={open ? p.ink : p.muted} numberOfLines={3}>
            {task.title}
          </T>
          {open ? (
            <>
              {(contextLabel || task.rewardCoins > 0) && (
                <Row gap={6} style={{ flexWrap: 'wrap' }}>
                  {!!contextLabel && <T kind="meta" style={styles.questContext}>{contextLabel}</T>}
                  {task.rewardCoins > 0 && (
                    <Row gap={4}>
                      <Coin size={15} />
                      <T kind="small" color={p.goldInk}>{task.rewardCoins}</T>
                    </Row>
                  )}
                </Row>
              )}
              {!!dateChip && <StatusChip tone={item.overdue ? 'overdue' : 'neutral'} label={dateChip} />}
            </>
          ) : <T kind="meta">{contextLabel ? `${contextLabel} · ${closedLabel}` : closedLabel}</T>}
        </View>
        {open ? (
          count ? (
            <View style={styles.quota}>
              <T kind="bodyStrong" style={styles.quotaCount}>{count}</T>
              <T kind="meta" color={missed ? p.roseInk : p.muted} style={styles.quotaPeriod}>{period}</T>
            </View>
          ) : (
            <View style={[styles.repeat, { backgroundColor: side && item.overdue ? p.rose : soon ? p.cream : p.track }, soon && styles.soon]}>
              {soon && <Ionicons name="warning" size={13} color={p.goldInk} aria-hidden />}
              <T kind="meta" color={side && item.overdue ? p.roseInk : soon ? p.goldInk : p.ink} style={styles.repeatText}>{timing}</T>
            </View>
          )
        ) : done && <Ionicons name="checkmark" size={18} color={p.forest} aria-hidden />}
      </Pressable>
      {sheet && <NotDoneSheet task={task} onClose={() => setSheet(false)} />}
    </SwipeToLog>
  );
}

const styles = StyleSheet.create({
  list: { padding: 0, gap: 0, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.md, gap: space.sm, minHeight: 60 },
  standalone: { borderWidth: 1, borderRadius: radius.lg },
  pressed: { opacity: 0.75 },
  details: { flex: 1, paddingVertical: space.sm + 2, gap: 3 },
  repeat: { maxWidth: '38%', borderRadius: radius.md, paddingHorizontal: space.sm, paddingVertical: space.xs },
  quota: { maxWidth: '38%', alignItems: 'flex-end', gap: 1, paddingLeft: space.sm },
  repeatText: { textAlign: 'center' },
  soon: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  quotaCount: { textAlign: 'right', fontVariant: ['tabular-nums'] },
  quotaPeriod: { textAlign: 'right' },
  questContext: { flexShrink: 1 },
});
