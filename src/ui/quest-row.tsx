import { router } from 'expo-router';
import { useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';

import { completeOccurrence, snoozeOccurrence } from '@/domain/commands';
import { formatFriendly } from '@/domain/dates';
import type { QuestItem, QuotaProgress } from '@/domain/selectors';
import { useStore } from '@/state/store';

import { Coin } from './art';
import { NotDoneSheet } from './not-done-sheet';
import { Button, Ionicons, Row, StatusChip, T } from './components';
import { nativeDriver, useReducedMotion } from './motion';
import { SwipeToLog } from './swipe-to-log';
import { font, radius, space, usePalette } from './theme';
import { toast } from './toast';
import { questContext, seeYouAgain, taskRepeatWord } from './visuals';

export async function completeQuest(item: QuestItem) {
  const res = await useStore.getState().run((s, c) => completeOccurrence(s, c, item.occurrence.id));
  if (!res.ok) return toast(res.message, 'error');
  const coins = item.task.rewardCoins;
  if (item.quota) {
    const q = item.quota;
    const msg = q.done + 1 >= q.times ? `${q.times} of ${q.times} ${q.periodLabel}. Target hit!` : `${q.done + 1} of ${q.times} ${q.periodLabel}`;
    toast(coins > 0 ? `${msg} · +${coins} coins` : msg, coins > 0 ? 'coin' : 'success');
  } else if (item.task.taskType === 'side') {
    const msg = `Done · ${seeYouAgain(item.task.recurrence)}`;
    toast(coins > 0 ? `${msg} · +${coins} coins` : msg, coins > 0 ? 'coin' : 'success');
  } else {
    toast(coins > 0 ? `Nice work! +${coins} coins` : 'Nice work!', coins > 0 ? 'coin' : 'success');
  }
}

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

/** Soft checkmark pulse; skipped when reduced motion is on. */
function useCheckPulse() {
  const reduced = useReducedMotion();
  const [scale] = useState(() => new Animated.Value(1));
  const pulse = () => {
    if (reduced) return;
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.18, duration: 110, useNativeDriver: nativeDriver }),
      Animated.timing(scale, { toValue: 1, duration: 160, useNativeDriver: nativeDriver }),
    ]).start();
  };
  return { scale, pulse };
}

function CheckCircle({ item }: { item: QuestItem }) {
  const p = usePalette();
  const { scale, pulse } = useCheckPulse();
  const { occurrence, task } = item;
  const done = occurrence.status === 'completed';
  const open = occurrence.status === 'open';
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done, disabled: !open }}
      accessibilityLabel={open ? `Complete ${task.title}` : `${task.title} ${done ? 'completed' : 'skipped'}`}
      disabled={!open}
      onPress={() => {
        pulse();
        void completeQuest(item);
      }}
      hitSlop={8}
      style={styles.checkHit}>
      <Animated.View
        style={[
          styles.check,
          { transform: [{ scale }], backgroundColor: done ? p.forest : 'transparent', borderColor: done ? p.forest : p.faint },
        ]}>
        {done && <Ionicons name="checkmark" size={17} color={p.onForest} />}
        {occurrence.status === 'skipped' && <Ionicons name="remove" size={17} color={p.faint} />}
      </Animated.View>
    </Pressable>
  );
}

/** "1/3" badge for times-per-period quests; filled once the period's target is met. */
function Counter({ done, times, active }: { done: number; times: number; active: boolean }) {
  const p = usePalette();
  const full = done >= times;
  return (
    <View style={styles.checkHit} accessible accessibilityLabel={`${done} of ${times} done`}>
      <View style={[styles.counter, { backgroundColor: full ? p.forest : active ? p.mint : 'transparent', borderColor: full || active ? p.forest : p.faint }]}>
        {full ? (
          <Ionicons name="checkmark" size={18} color={p.onForest} />
        ) : (
          <T kind="small" color={active ? p.forest : p.muted} style={{ fontFamily: font.bold }}>
            {done}/{times}
          </T>
        )}
      </View>
    </View>
  );
}

/** "›› Swipe to log" hint under a quest you can log right now. */
function SwipeHint() {
  const p = usePalette();
  return (
    <Row gap={2}>
      <Ionicons name="chevron-forward" size={12} color={p.faint} />
      <Ionicons name="chevron-forward" size={12} color={p.faint} style={{ marginLeft: -8 }} />
      <T kind="meta" color={p.faint}>
        Swipe to log
      </T>
    </Row>
  );
}

/** Task card: name, context, completion and coin value — nothing more (spec §07). */
export function QuestRow({ item, today, showDue = true }: { item: QuestItem; today: string; showDue?: boolean }) {
  const p = usePalette();
  const s = useStore((st) => st.snapshot);
  const { task, occurrence } = item;
  const open = occurrence.status === 'open';
  const due = occurrence.scheduledFor;
  const quota = item.quota;
  const missed = !!quota?.missed && open;
  const [sheet, setSheet] = useState(false);
  // Times-per-period quests are logged by swiping, and only once they're due (not tomorrow's).
  const canLog = !!quota && open && item.dueInDays <= 0 && !missed && quota.done < quota.times;
  const nextOpen = quota && !open ? s.occurrences.find((o) => o.taskDefinitionId === task.id && o.status === 'open') : undefined;
  const nextWord = task.window ? 'Starts' : 'Next';

  return (
    <SwipeToLog enabled={canLog} onLog={() => void completeQuest(item)} label={`Log one ${task.title}`} borderRadius={radius.md + 2}>
      <View style={[styles.row, { backgroundColor: p.surface, borderColor: p.border }]}>
        {quota ? <Counter done={quota.done} times={quota.times} active={canLog} /> : <CheckCircle item={item} />}
        <Pressable
          style={{ flex: 1, paddingVertical: space.md, gap: 3 }}
          accessibilityRole="button"
          accessibilityLabel={missed ? `${task.title}, not done. Give it more time or delete it` : `Edit ${task.title}`}
          onPress={() => (missed ? setSheet(true) : router.push({ pathname: '/task-form', params: { id: task.id } }))}>
          <T kind="bodyStrong" color={open ? p.ink : p.muted} numberOfLines={2}>
            {task.title}
          </T>
          <T kind="meta" numberOfLines={1}>
            {questContext(s, task)}
          </T>
          {quota ? (
            <Row gap={6} style={{ marginTop: 4, flexWrap: 'wrap' }}>
              <StatusChip {...quotaChip(quota)} />
              {open && item.dueInDays > 0 && <StatusChip tone="neutral" label={`${nextWord} ${formatFriendly(due, today)}`} />}
              {nextOpen && quota.done < quota.times && <StatusChip tone="neutral" label={`${nextWord} ${formatFriendly(nextOpen.scheduledFor, today)}`} />}
              {missed && quota.endsOn && <StatusChip tone="neutral" icon="hand-left-outline" label="Tap to reschedule or delete" />}
              {canLog && <SwipeHint />}
            </Row>
          ) : (
            open &&
            (item.overdue || (showDue && due !== today)) && (
              <View style={{ marginTop: 4 }}>
                <StatusChip tone={item.overdue ? 'overdue' : 'neutral'} label={item.overdue ? 'Overdue' : formatFriendly(due, today)} />
              </View>
            )
          )}
        </Pressable>
        {task.rewardCoins > 0 && (
          <Row gap={5} style={{ paddingRight: space.lg }}>
            <Coin size={20} />
            <T kind="small" color={p.goldInk} style={{ fontFamily: font.bold }}>
              {task.rewardCoins}
            </T>
          </Row>
        )}
      </View>
      {sheet && <NotDoneSheet task={task} onClose={() => setSheet(false)} />}
    </SwipeToLog>
  );
}

/** Side-quest card with a calm status chip (spec §08). Overdue ones offer snooze / reschedule / complete. */
export function SideQuestCard({ item, today }: { item: QuestItem; today: string }) {
  const p = usePalette();
  const s = useStore((st) => st.snapshot);
  const { task, occurrence } = item;
  const done = occurrence.status === 'completed';
  const nextOpen = s.occurrences.find((o) => o.taskDefinitionId === task.id && o.status === 'open');
  const dueSoon = !done && !item.overdue && (item.reminderActive || item.dueInDays <= 7);
  const chip = done
    ? { tone: 'done' as const, label: 'Done recently' }
    : item.quota
      ? quotaChip(item.quota)
    : item.overdue
      ? { tone: 'overdue' as const, label: 'A little behind schedule' }
      : dueSoon
        ? { tone: 'due' as const, label: item.dueInDays === 0 ? 'Due today' : 'Due soon' }
        : { tone: 'demo' as const, label: 'Maintenance' };
  const when = done ? `Next due ${nextOpen ? formatFriendly(nextOpen.scheduledFor, today) : 'not scheduled'}` : `${taskRepeatWord(task)} · ${formatFriendly(occurrence.scheduledFor, today)}`;

  const missed = !!item.quota?.missed && !done;
  const [sheet, setSheet] = useState(false);
  const canLog = !!item.quota && !done && item.dueInDays <= 0 && !missed && item.quota.done < item.quota.times;
  const snooze = async () => {
    const res = await useStore.getState().run((s, c) => snoozeOccurrence(s, c, occurrence.id, 3));
    toast(res.ok ? 'Snoozed for 3 days' : res.message, res.ok ? 'success' : 'error');
  };

  return (
    <SwipeToLog enabled={canLog} onLog={() => void completeQuest(item)} label={`Log one ${task.title}`} borderRadius={radius.lg}>
      <View style={[styles.side, { backgroundColor: p.surface, borderColor: p.border }]}>
        <Row style={{ alignItems: 'flex-start' }}>
          <Pressable
            style={{ flex: 1, gap: 6 }}
            accessibilityRole="button"
            accessibilityLabel={missed ? `${task.title}, not done. Give it more time or delete it` : `Edit ${task.title}`}
            onPress={() => (missed ? setSheet(true) : router.push({ pathname: '/task-form', params: { id: task.id } }))}>
            <StatusChip tone={chip.tone} label={chip.label} />
            <T kind="h3">{task.title}</T>
            <T kind="meta">{when}</T>
          </Pressable>
          {task.rewardCoins > 0 && (
            <Row gap={5}>
              <Coin size={22} />
              <T kind="small" color={p.goldInk} style={{ fontFamily: font.bold }}>
                {task.rewardCoins}
              </T>
            </Row>
          )}
        </Row>
        {canLog && (
          <View style={{ marginTop: space.sm }}>
            <SwipeHint />
          </View>
        )}
        {missed && <Button compact kind="secondary" title="Reschedule or delete" onPress={() => setSheet(true)} style={{ marginTop: space.sm }} />}
        {!done && !item.quota && (
          <Row gap={space.sm} style={{ marginTop: space.sm }}>
            <Button compact kind="secondary" title="Complete" icon="checkmark" onPress={() => void completeQuest(item)} style={{ flex: 1 }} accessibilityLabel={`Complete ${task.title}`} />
            {item.overdue && <Button compact kind="tertiary" title="Snooze 3d" onPress={snooze} style={{ flex: 1 }} />}
            {item.overdue && (
              <Button compact kind="tertiary" title="Reschedule" onPress={() => router.push({ pathname: '/task-form', params: { id: task.id } })} style={{ flex: 1 }} />
            )}
          </Row>
        )}
      </View>
      {sheet && <NotDoneSheet task={task} onClose={() => setSheet(false)} />}
    </SwipeToLog>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: radius.md + 2, minHeight: 68 },
  checkHit: { width: 56, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  counter: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  check: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  side: { borderWidth: 1, borderRadius: radius.lg, padding: space.lg + 2, gap: 2 },
});
