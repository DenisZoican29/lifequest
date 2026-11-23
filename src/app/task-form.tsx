import { format } from 'date-fns';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  archiveTask,
  createTask,
  MAX_REWARD_COINS,
  MAX_SNOOZE_DAYS,
  nextDueOf,
  restoreTask,
  skipOccurrence,
  snoozeOccurrence,
  updateTask,
  type TaskInput,
} from '@/domain/commands';
import { addPeriod, daysBetween, fromLocalDate, isLocalDate, type Clock } from '@/domain/dates';
import { questIconPreset, type QuestIcon } from '@/domain/quest-mark';
import { canWarn, isUndated } from '@/domain/recurrence';
import { isQuestColor, type ChangeSet, type QuestColor, type Snapshot, type TaskType } from '@/domain/types';
import { quotaProgress } from '@/domain/selectors';
import { useStore, useToday } from '@/state/store';
import { Button, Card, ConfirmDialog, DisclosureCard, DisclosureRow, Field, FormFooter, Ionicons, Row, Screen, Segmented, T, type ChipTone, type IconName } from '@/ui/components';
import { CalendarDateField, NoDueDateField } from '@/ui/date-field';
import { DatePickerDialog } from '@/ui/date-range-dialog';
import { QuestMark } from '@/ui/goal-mark';
import { GoalSelect } from '@/ui/goal-select';
import { QuestAppearancePicker } from '@/ui/quest-appearance-picker';
import { completeQuest } from '@/ui/quest-completion';
import { quotaChip } from '@/ui/quest-row';
import { NotDoneSheet } from '@/ui/not-done-sheet';
import { NumberWheel } from '@/ui/number-wheel';
import { isDates, RepeatPicker, repeatFromRule, ruleFromRepeat, windowFromRepeat } from '@/ui/repeat-picker';
import { radius, space, usePalette } from '@/ui/theme';
import { toast } from '@/ui/toast';
import { WarningPicker, warningLabel } from '@/ui/warning-picker';

/** The reward wheel moves in fives: 0, 5, 10 … 50. */
const REWARD_STEP = 5;

const dayLabel = (day: string) => format(fromLocalDate(day), 'd MMM yyyy');

export default function TaskForm() {
  const p = usePalette();
  const params = useLocalSearchParams<{ id?: string; type?: TaskType; goalId?: string }>();
  const s = useStore((st) => st.snapshot);
  const run = useStore((st) => st.run);
  const today = useToday();
  const existing = params.id ? s.tasks.find((t) => t.id === params.id) : undefined;

  const [taskType, setTaskType] = useState<TaskType>(existing?.taskType ?? params.type ?? 'main');
  const [title, setTitle] = useState(existing?.title ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [dueAt, setDueAt] = useState(existing?.window ? existing.window.start : existing ? nextDueOf(s, existing) : today);
  const [repeat, setRepeat] = useState(() => repeatFromRule(existing?.recurrence, existing?.window));
  // The due date is optional for one-off and repeating quests, and new ones start without one (addendum A4 §4).
  const [noDate, setNoDate] = useState(existing ? !!existing.noDueDate : true);
  const [notDone, setNotDone] = useState(false);
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  // Rewards come in steps of 5 up to the cap; an older quest's odd or larger amount snaps to the nearest step.
  const [coins, setCoins] = useState(Math.min(MAX_REWARD_COINS, Math.round((existing?.rewardCoins ?? 10) / REWARD_STEP) * REWARD_STEP));
  const [goalId, setGoalId] = useState<string | undefined>(existing?.goalId ?? params.goalId);
  const [icon, setIcon] = useState<QuestIcon | undefined>(() => questIconPreset(existing?.icon)?.key);
  const [color, setColor] = useState<QuestColor | undefined>(isQuestColor(existing?.color) ? existing.color : undefined);
  const [reminder, setReminder] = useState<number | undefined>(existing?.reminderDaysBefore);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [saving, setSaving] = useState(false);
  const [more, setMore] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState<boolean>();

  if (params.id && !existing) {
    return (
      <Screen edges={[]}>
        <T kind="muted">This quest no longer exists.</T>
      </Screen>
    );
  }

  const goals = s.goals.filter((g) => g.status === 'active' || g.id === goalId);
  const isSide = taskType === 'side';
  const quota = existing ? quotaProgress(s, existing, today) : undefined;
  const coinWord = coins === 0 ? 'No reward' : `${coins} coin${coins === 1 ? '' : 's'}`;
  // Every 1 day is always available each day; a date range always has dates; otherwise the date is optional.
  const daily = !isDates(repeat) && isUndated({ recurrence: ruleFromRepeat(repeat) });
  const noDueDate = !isDates(repeat) && !daily && noDate;
  const undated = noDueDate || daily;
  // Side quests can warn before a due date, or before the end of each period when repeating without one.
  const warns = isSide && canWarn({ recurrence: ruleFromRepeat(repeat), window: isDates(repeat) ? { start: '', end: '', times: 1 } : undefined, noDueDate });
  const wasUndated = !!existing && isUndated(existing);

  const save = async () => {
    if (saving) return;
    if (warns && reminder !== undefined && Number.isNaN(reminder)) {
      return toast('Enter how many days or weeks before the deadline to warn.', 'error');
    }
    // Undated quests become available today; a daily quest already done today stays on tomorrow.
    const nextDue = existing ? nextDueOf(s, existing) : today;
    // A repeating quest already done this period keeps waiting for the next one.
    const keepNext = wasUndated && (nextDue <= today || repeat.mode === 'repeating');
    const due = undated ? (keepNext ? nextDue : today) : dueAt;
    const input: TaskInput = {
      title,
      description,
      taskType,
      goalId: isSide ? undefined : goalId,
      icon: icon ?? null,
      color: color ?? null,
      rewardCoins: coins,
      dueAt: due,
      recurrence: ruleFromRepeat(repeat),
      window: windowFromRepeat(repeat, dueAt),
      noDueDate,
      reminderDaysBefore: warns ? reminder : undefined,
    };
    setSaving(true);
    const res = await run((st, c) => (existing ? updateTask(st, c, existing.id, input) : createTask(st, c, input)));
    setSaving(false);
    if (!res.ok) return toast(res.message, 'error');
    toast(existing ? 'Quest updated' : isSide ? 'Side quest added' : 'Quest added');
    router.back();
  };

  const open = existing ? s.occurrences.find((o) => o.taskDefinitionId === existing.id && o.status === 'open') : undefined;

  /** Runs a status change from the Status card, optionally closing the form afterwards. */
  const act = async (cmd: (st: Snapshot, c: Clock) => ChangeSet, message: string, close = false) => {
    if (saving) return;
    setSaving(true);
    const res = await run(cmd);
    setSaving(false);
    if (!res.ok) return toast(res.message, 'error');
    toast(message);
    if (close) router.back();
  };

  const markDone = async (occurrenceId: string) => {
    if (saving) return;
    setSaving(true);
    const completed = await completeQuest(occurrenceId);
    setSaving(false);
    if (completed) router.back();
  };

  const archive = async () => {
    if (!existing || saving) return;
    setSaving(true);
    const res = await run((st, c) => archiveTask(st, c, existing.id));
    setSaving(false);
    setConfirmArchive(false);
    if (!res.ok) return toast(res.message, 'error');
    toast('Quest archived — history kept');
    router.back();
  };

  const titleField = <Field label="Title" value={title} onChangeText={setTitle} placeholder={isSide ? 'e.g. Clean the oven' : 'e.g. Study 30 minutes'} />;
  const descriptionField = <Field label="Description (optional)" value={description} onChangeText={setDescription} placeholder="Optional details" multiline />;
  const appearance = { title, taskType, goalId: isSide ? undefined : goalId, icon, color };
  const hasWindow = isDates(repeat);
  const startsOn = hasWindow || (!existing && repeat.mode === 'repeating' && repeat.times !== '1');
  const dateLabel = startsOn ? 'Start date' : existing ? 'Next due date' : 'Due date';
  const rewardFields = (
    <View style={styles.rewardRow}>
      <View style={styles.grow}>
        <T kind="bodyStrong">Coins per completion</T>
        <T kind="small">{isSide ? `Optional for side quests. 0 to ${MAX_REWARD_COINS}.` : `Paid each time you complete it. Up to ${MAX_REWARD_COINS}.`}</T>
      </View>
      <NumberWheel label="Coin reward" value={coins} min={0} max={MAX_REWARD_COINS} step={REWARD_STEP} onChange={setCoins} />
    </View>
  );

  const selectedGoal = goals.find((goal) => goal.id === goalId);
  const status: { tone: ChipTone; label: string } = !existing?.active
    ? { tone: 'plain', label: 'Archived' }
    : !open ? { tone: 'done', label: 'Completed' }
    : quota ? quotaChip(quota)
    : wasUndated ? { tone: 'neutral', label: open.scheduledFor > today ? `Available from ${dayLabel(open.scheduledFor)}` : 'Available · No due date' }
    : open.scheduledFor < today ? { tone: 'overdue', label: 'Overdue' }
    : { tone: 'neutral', label: `Due · ${dayLabel(open.scheduledFor)}` };
  const next = open && quota && open.scheduledFor > today
    ? `${existing?.window ? 'Starts' : 'Next'} · ${dayLabel(open.scheduledFor)}`
    : undefined;
  const activityExpanded = activityOpen ?? (existing?.active === false || !!quota?.missed);
  const questTypeLabel = isSide ? 'side quest' : 'quest';

  return (
    <Screen
      edges={['bottom']}
      footer={(
        <FormFooter>
          <Button title={saving ? 'Saving…' : existing ? 'Save changes' : `Add ${questTypeLabel}`} icon={existing ? 'checkmark' : 'add'} onPress={save} disabled={saving} />
        </FormFooter>
      )}>
      <Stack.Screen options={{ title: `${existing ? 'Edit' : 'New'} ${questTypeLabel}` }} />
      {!existing && (
        <Segmented
          value={taskType}
          onChange={setTaskType}
          options={[{ value: 'main', label: 'Quest' }, { value: 'side', label: 'Side quest' }]}
        />
      )}

      <Card style={styles.section}>
        <EditHeading title="Quest details" icon="reader" tone="lavender" />
        {titleField}
        {descriptionField}
        {!isSide && (
          <GoalSelect
            goals={goals}
            value={goalId}
            onChange={setGoalId}
            leading={selectedGoal ? <QuestMark task={{ taskType, goalId: selectedGoal.id }} size={36} /> : <EditIcon icon="flag" tone="mint" />}
          />
        )}
        <QuestAppearancePicker
          task={appearance}
          onChange={(next) => {
            setIcon(next.icon);
            setColor(next.color);
          }}
        />
      </Card>

      <Card style={styles.section}>
        <EditHeading title="Schedule" icon="calendar-number" tone="sky" />
        <RepeatPicker value={repeat} onChange={setRepeat} allowDateRange />
        {daily ? (
          <NoDueDateField label="Due date" note="Available every day. A missed day never becomes overdue." />
        ) : !hasWindow ? (
          <CalendarDateField
            label={repeat.mode === 'once' ? 'Due date' : dateLabel}
            value={noDate ? '' : dueAt}
            onChange={(day) => {
              setDueAt(day);
              setNoDate(false);
            }}
            onClear={() => setNoDate(true)}
            today={today}
          />
        ) : (
          <CalendarDateField label={dateLabel} value={dueAt} onChange={setDueAt} today={today} />
        )}
        {hasWindow && (
          <CalendarDateField
            label="End date"
            value={repeat.end ?? ''}
            minDate={isLocalDate(dueAt) ? dueAt : undefined}
            onChange={(day) => setRepeat((draft) => ({ ...draft, end: day }))}
            today={today}
          />
        )}
        {/* Shown when there's a deadline to count back from: a due date, or the end of each period for a repeating quest. */}
        {warns && (
          <DisclosureCard
            title="Deadline warning"
            summary={reminder !== undefined && Number.isNaN(reminder) ? 'Not set yet' : warningLabel(reminder)}
            leading={<EditIcon icon="warning-outline" tone="sky" />}
            expanded={reminderOpen}
            onPress={() => setReminderOpen((value) => !value)}>
            <WarningPicker
              value={reminder}
              onChange={setReminder}
              deadline={noDueDate ? `the end of ${periodPhrase(repeat.every, repeat.unit).replace(/^each|^in each/, 'each')}` : 'the deadline'}
            />
          </DisclosureCard>
        )}
      </Card>

      <Card>
        <DisclosureRow title="Reward" summary={coinWord} leading={<EditIcon icon="wallet" tone="mint" />} expanded={more} onPress={() => setMore((value) => !value)} />
        {more && rewardFields}
      </Card>

      {existing && <Card>
        <DisclosureRow
          title="Quest activity"
          summary={next ? `${status.label} · ${next}` : status.label}
          summaryColor={status.tone === 'overdue' ? p.roseInk : status.tone === 'done' ? p.forest : undefined}
          leading={<EditIcon icon="pulse" tone="mint" />}
          expanded={activityExpanded}
          onPress={() => setActivityOpen(!activityExpanded)}
        />
        {activityExpanded && (
          <View style={[styles.activity, { borderColor: p.border }]}>
            {!existing.active ? (
              <>
                <T kind="small">Restoring adds it back to your quests. Due {dayLabel(existing.dueAt > today ? existing.dueAt : today)}.</T>
                <Button title="Restore quest" icon="refresh" kind="secondary" compact disabled={saving} onPress={() => act((st, c) => restoreTask(st, c, existing.id), 'Quest restored', true)} />
              </>
            ) : open ? (
              <>
                {quota?.missed ? (
                  <Button title="Give it more time or delete" icon="calendar-outline" kind="secondary" compact onPress={() => setNotDone(true)} />
                ) : !(existing.window && open.scheduledFor > today) && (
                  <Button
                    title="Mark done"
                    icon="checkmark"
                    kind="secondary"
                    compact
                    disabled={saving}
                    onPress={() => void markDone(open.id)}
                  />
                )}
                {!existing.window && (
                  <>
                    {!wasUndated && <Button title="Move this occurrence" icon="calendar-outline" kind="tertiary" compact disabled={saving} onPress={() => setSnoozeOpen(true)} />}
                    {existing.recurrence && (
                      <Button
                        title={quota ? `Skip rest of ${quota.periodLabel}` : 'Skip this time'}
                        icon="play-skip-forward-outline"
                        kind="tertiary"
                        compact
                        disabled={saving}
                        onPress={() => act((st, c) => skipOccurrence(st, c, open.id), quota ? 'Skipped until the next period' : 'Skipped · no coins', true)}
                      />
                    )}
                  </>
                )}
              </>
            ) : null}
            {existing.active && <Button title="Archive quest" icon="archive-outline" kind="tertiary" compact disabled={saving} onPress={() => setConfirmArchive(true)} />}
          </View>
        )}
      </Card>}

      <ConfirmDialog
        visible={confirmArchive}
        title="Archive this quest?"
        body="Open occurrences are removed. Completed history and earned coins stay."
        confirmLabel="Archive"
        kind="danger"
        busy={saving}
        onConfirm={archive}
        onCancel={() => setConfirmArchive(false)}
      />
      {snoozeOpen && open && (
        <DatePickerDialog
          title="Move this occurrence"
          today={today}
          selected={open.scheduledFor}
          minDate={addPeriod(today, 'day', 1)}
          maxDate={addPeriod(today, 'day', MAX_SNOOZE_DAYS)}
          onClose={() => setSnoozeOpen(false)}
          onSelect={(day) => {
            setSnoozeOpen(false);
            void act((st, c) => snoozeOccurrence(st, c, open.id, daysBetween(c.today(), day)), `Moved to ${dayLabel(day)}`, true);
          }}
        />
      )}
      {notDone && existing && <NotDoneSheet task={existing} onClose={() => setNotDone(false)} />}
    </Screen>
  );
}

/** "each week", "in each 2-week period". */
function periodPhrase(every: string, unit: string): string {
  return every === '1' || every === '' ? `each ${unit}` : `in each ${every}-${unit} period`;
}

type EditIconTone = 'lavender' | 'sky' | 'mint';

function EditIcon({ icon, tone }: { icon: IconName; tone: EditIconTone }) {
  const p = usePalette();
  const { ink, fill } = {
    lavender: { ink: p.questColors.purple, fill: p.lavender },
    sky: { ink: p.questColors.blue, fill: p.sky },
    mint: { ink: p.forest, fill: p.mint },
  }[tone];
  return (
    <View aria-hidden style={[styles.iconTile, { backgroundColor: `${ink}35` }]}>
      <View style={[styles.iconFace, { backgroundColor: fill, borderColor: `${ink}28` }]}>
        <View style={[styles.iconHighlight, { backgroundColor: p.surface }]} />
        <Ionicons name={icon} size={20} color={ink} />
      </View>
    </View>
  );
}

function EditHeading({ title, icon, tone }: { title: string; icon: IconName; tone: EditIconTone }) {
  return (
    <Row gap={space.md}>
      <EditIcon icon={icon} tone={tone} />
      <T kind="h3" accessibilityRole="header" style={styles.grow}>{title}</T>
    </Row>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.md },
  iconTile: { width: 36, height: 36, borderRadius: radius.sm },
  iconFace: {
    position: 'absolute', top: 0, bottom: 2, left: 0, right: 0, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: radius.sm,
  },
  iconHighlight: { position: 'absolute', width: 43, height: 18, top: -8, left: -4, borderRadius: radius.pill, transform: [{ rotate: '-20deg' }], opacity: 0.3 },
  grow: { flex: 1 },
  rewardRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.sm },
  activity: { borderTopWidth: 1, paddingTop: space.md, gap: space.sm },
});
