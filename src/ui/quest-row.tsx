import { router } from 'expo-router';
import { useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';

import { completeOccurrence, snoozeOccurrence } from '@/domain/commands';
import { formatFriendly } from '@/domain/dates';
import type { QuestItem } from '@/domain/selectors';
import { useStore } from '@/state/store';

import { Coin } from './art';
import { Button, Ionicons, Row, StatusChip, T } from './components';
import { nativeDriver, useReducedMotion } from './motion';
import { font, radius, space, usePalette } from './theme';
import { toast } from './toast';
import { questContext, recurrenceWord, seeYouAgain } from './visuals';

export async function completeQuest(item: QuestItem) {
  const res = await useStore.getState().run((s, c) => completeOccurrence(s, c, item.occurrence.id));
  if (!res.ok) return toast(res.message, 'error');
  const coins = item.task.rewardCoins;
  if (item.task.taskType === 'side') {
    const msg = `Done · ${seeYouAgain(item.task.recurrence)}`;
    toast(coins > 0 ? `${msg} · +${coins} coins` : msg, coins > 0 ? 'coin' : 'success');
  } else {
    toast(coins > 0 ? `Nice work! +${coins} coins` : 'Nice work!', coins > 0 ? 'coin' : 'success');
  }
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

/** Task card: name, context, completion and coin value — nothing more (spec §07). */
export function QuestRow({ item, today, showDue = true }: { item: QuestItem; today: string; showDue?: boolean }) {
  const p = usePalette();
  const s = useStore((st) => st.snapshot);
  const { task, occurrence } = item;
  const open = occurrence.status === 'open';
  const due = occurrence.scheduledFor;

  return (
    <View style={[styles.row, { backgroundColor: p.surface, borderColor: p.border }]}>
      <CheckCircle item={item} />
      <Pressable
        style={{ flex: 1, paddingVertical: space.md, gap: 3 }}
        accessibilityRole="button"
        accessibilityLabel={`Edit ${task.title}`}
        onPress={() => router.push({ pathname: '/task-form', params: { id: task.id } })}>
        <T kind="bodyStrong" color={open ? p.ink : p.muted} numberOfLines={2}>
          {task.title}
        </T>
        <T kind="meta" numberOfLines={1}>
          {questContext(s, task)}
        </T>
        {open && (item.overdue || (showDue && due !== today)) && (
          <View style={{ marginTop: 4 }}>
            <StatusChip tone={item.overdue ? 'overdue' : 'neutral'} label={item.overdue ? 'Overdue' : formatFriendly(due, today)} />
          </View>
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
    : item.overdue
      ? { tone: 'overdue' as const, label: 'A little behind schedule' }
      : dueSoon
        ? { tone: 'due' as const, label: item.dueInDays === 0 ? 'Due today' : 'Due soon' }
        : { tone: 'demo' as const, label: 'Maintenance' };
  const when = done ? `Next due ${nextOpen ? formatFriendly(nextOpen.scheduledFor, today) : 'not scheduled'}` : `${recurrenceWord(task.recurrence)} · ${formatFriendly(occurrence.scheduledFor, today)}`;

  const snooze = async () => {
    const res = await useStore.getState().run((s, c) => snoozeOccurrence(s, c, occurrence.id, 3));
    toast(res.ok ? 'Snoozed for 3 days' : res.message, res.ok ? 'success' : 'error');
  };

  return (
    <View style={[styles.side, { backgroundColor: p.surface, borderColor: p.border }]}>
      <Row style={{ alignItems: 'flex-start' }}>
        <Pressable
          style={{ flex: 1, gap: 6 }}
          accessibilityRole="button"
          accessibilityLabel={`Edit ${task.title}`}
          onPress={() => router.push({ pathname: '/task-form', params: { id: task.id } })}>
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
      {!done && (
        <Row gap={space.sm} style={{ marginTop: space.sm }}>
          <Button compact kind="secondary" title="Complete" icon="checkmark" onPress={() => void completeQuest(item)} style={{ flex: 1 }} accessibilityLabel={`Complete ${task.title}`} />
          {item.overdue && <Button compact kind="tertiary" title="Snooze 3d" onPress={snooze} style={{ flex: 1 }} />}
          {item.overdue && (
            <Button compact kind="tertiary" title="Reschedule" onPress={() => router.push({ pathname: '/task-form', params: { id: task.id } })} style={{ flex: 1 }} />
          )}
        </Row>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: radius.md + 2, minHeight: 68 },
  checkHit: { width: 56, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  check: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  side: { borderWidth: 1, borderRadius: radius.lg, padding: space.lg + 2, gap: 2 },
});
