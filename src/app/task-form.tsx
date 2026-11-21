import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import {
  archiveTask,
  completeOccurrence,
  createTask,
  nextDueOf,
  restoreTask,
  skipOccurrence,
  snoozeOccurrence,
  updateTask,
  type TaskInput,
} from '@/domain/commands';
import { formatFriendly } from '@/domain/dates';
import type { AnchorPolicy, ChangeSet, RecurrenceFrequency, Snapshot, TaskType } from '@/domain/types';
import type { Clock } from '@/domain/dates';
import { useStore, useToday } from '@/state/store';
import { Button, Card, Chip, ConfirmDialog, Field, Row, Screen, Segmented, StatusChip, T } from '@/ui/components';
import { DateField } from '@/ui/date-field';
import { font, space, usePalette } from '@/ui/theme';
import { toast } from '@/ui/toast';

type Repeat = 'none' | RecurrenceFrequency;
const REPEATS: { value: Repeat; label: string }[] = [
  { value: 'none', label: 'Once' },
  { value: 'day', label: 'Daily' },
  { value: 'week', label: 'Weekly' },
  { value: 'month', label: 'Monthly' },
  { value: 'year', label: 'Yearly' },
];

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
  const [dueAt, setDueAt] = useState(existing ? nextDueOf(s, existing) : today);
  const [repeat, setRepeat] = useState<Repeat>(existing?.recurrence?.frequency ?? 'none');
  const [interval, setInterval_] = useState(String(existing?.recurrence?.interval ?? 1));
  const [anchor, setAnchor] = useState<AnchorPolicy>(existing?.recurrence?.anchorPolicy ?? 'completion');
  const [coins, setCoins] = useState(String(existing?.rewardCoins ?? 10));
  const [goalId, setGoalId] = useState<string | undefined>(existing?.goalId ?? params.goalId);
  const [reminder, setReminder] = useState<number | undefined>(existing?.reminderDaysBefore);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [saving, setSaving] = useState(false);

  if (params.id && !existing) {
    return (
      <Screen edges={[]}>
        <T kind="muted">This quest no longer exists.</T>
      </Screen>
    );
  }

  const goals = s.goals.filter((g) => g.status === 'active' || g.id === goalId);
  const isSide = taskType === 'side';
  const unit = repeat === 'none' ? '' : repeat;

  const save = async () => {
    if (saving) return;
    const input: TaskInput = {
      title,
      description,
      taskType,
      goalId: isSide ? undefined : goalId,
      rewardCoins: coins.trim() === '' ? 0 : Number(coins),
      dueAt,
      recurrence: repeat === 'none' ? undefined : { frequency: repeat, interval: Number(interval), anchorPolicy: anchor },
      reminderDaysBefore: isSide ? reminder : undefined,
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
    toast(message, message.includes('coins') ? 'coin' : 'success');
    if (close) router.back();
  };

  const archive = async () => {
    if (!existing) return;
    const res = await run((st, c) => archiveTask(st, c, existing.id));
    setConfirmArchive(false);
    if (!res.ok) return toast(res.message, 'error');
    toast('Quest archived — history kept');
    router.back();
  };

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: existing ? 'Edit quest' : isSide ? 'New side quest' : 'New quest' }} />

      {existing && (
        <Card>
          <T kind="small" color={p.ink} style={{ fontFamily: font.bold }}>Status</T>
          {!existing.active ? (
            <>
              <Row style={{ flexWrap: 'wrap' }}>
                <StatusChip tone="plain" label="Archived" />
              </Row>
              <T kind="small">Restoring adds it back to your quests, due {formatFriendly(existing.dueAt > today ? existing.dueAt : today, today)}.</T>
              <Button title="Restore quest" icon="refresh" disabled={saving} onPress={() => act((st, c) => restoreTask(st, c, existing.id), 'Quest restored', true)} />
            </>
          ) : open ? (
            <>
              <Row style={{ flexWrap: 'wrap' }}>
                <StatusChip
                  tone={open.scheduledFor < today ? 'overdue' : open.scheduledFor === today ? 'due' : 'neutral'}
                  label={open.scheduledFor < today ? 'Overdue' : `Open · ${formatFriendly(open.scheduledFor, today)}`}
                />
              </Row>
              <Button
                title="Mark done"
                icon="checkmark"
                kind="secondary"
                disabled={saving}
                onPress={() =>
                  act(
                    (st, c) => completeOccurrence(st, c, open.id),
                    existing.rewardCoins > 0 ? `Nice work! +${existing.rewardCoins} coins` : 'Nice work!',
                    true,
                  )
                }
              />
              <Row style={{ flexWrap: 'wrap' }}>
                {[1, 3, 7].map((d) => (
                  <Chip
                    key={d}
                    icon="time-outline"
                    label={d === 1 ? 'Tomorrow' : `In ${d} days`}
                    onPress={() => act((st, c) => snoozeOccurrence(st, c, open.id, d), d === 1 ? 'Moved to tomorrow' : `Moved ${d} days ahead`, true)}
                  />
                ))}
                {existing.recurrence && (
                  <Chip icon="play-skip-forward-outline" label="Skip this time" onPress={() => act((st, c) => skipOccurrence(st, c, open.id), 'Skipped · no coins', true)} />
                )}
              </Row>
            </>
          ) : (
            <>
              <Row style={{ flexWrap: 'wrap' }}>
                <StatusChip tone="done" label="Completed" />
              </Row>
              <T kind="small">Completions are final, so coins are only ever paid once.</T>
            </>
          )}
        </Card>
      )}
      {!existing && (
        <Segmented
          value={taskType}
          onChange={setTaskType}
          options={[
            { value: 'main', label: 'Quest' },
            { value: 'side', label: 'Side quest' },
          ]}
        />
      )}
      <T kind="small">
        {isSide
          ? 'Side quests are chores and maintenance with deadlines. They stay separate from your roadmap.'
          : 'Quests are tasks you complete to earn coins. Link one to a goal to move its progress.'}
      </T>

      <Field label="Title" value={title} onChangeText={setTitle} placeholder={isSide ? 'e.g. Clean the oven' : 'e.g. Study 30 minutes'} />
      <Field label="Description" value={description} onChangeText={setDescription} placeholder="Optional details" multiline />

      <DateField label={existing ? 'Next due date' : 'Due date'} value={dueAt} onChange={setDueAt} today={today} />

      <T kind="small" color={p.ink} style={{ fontFamily: font.bold }}>Repeat</T>
      <Row style={{ flexWrap: 'wrap' }}>
        {REPEATS.map((r) => (
          <Chip key={r.value} label={r.label} selected={repeat === r.value} onPress={() => setRepeat(r.value)} />
        ))}
      </Row>
      {repeat !== 'none' && (
        <Card>
          <Row style={{ alignItems: 'flex-start' }}>
            <View style={{ width: 110 }}>
              <Field label="Every" value={interval} onChangeText={setInterval_} numeric />
            </View>
            <T kind="body" style={{ marginTop: 34 }}>
              {unit}
              {interval === '1' ? '' : 's'}
            </T>
          </Row>
          <T kind="small" color={p.ink} style={{ fontFamily: font.bold }}>Next one is scheduled</T>
          <Row style={{ flexWrap: 'wrap' }}>
            <Chip label="After I complete it" selected={anchor === 'completion'} onPress={() => setAnchor('completion')} />
            <Chip label="On a fixed schedule" selected={anchor === 'calendar'} onPress={() => setAnchor('calendar')} />
          </Row>
          <T kind="small">
            {anchor === 'completion'
              ? `E.g. done late? The next one is due ${interval || 'N'} ${unit}(s) after you finish.`
              : 'Stays on the original dates; missed slots are skipped, not stacked.'}
          </T>
        </Card>
      )}

      <View style={{ marginTop: space.md }}>
        <Field label="Coin reward" value={coins} onChangeText={setCoins} numeric hint={isSide ? 'Optional for side quests — 0 is fine.' : 'Paid once per completed occurrence.'} />
        <Row style={{ flexWrap: 'wrap', marginTop: -space.xs }}>
          {[0, 5, 10, 20, 50].map((n) => (
            <Chip key={n} label={`${n}`} selected={coins === String(n)} onPress={() => setCoins(String(n))} />
          ))}
        </Row>
      </View>

      {isSide ? (
        <View style={{ gap: space.sm, marginTop: space.md }}>
          <T kind="small" color={p.ink} style={{ fontFamily: font.bold }}>In-app reminder</T>
          <Row style={{ flexWrap: 'wrap' }}>
            {[undefined, 1, 3, 7, 14].map((d) => (
              <Chip key={String(d)} label={d === undefined ? 'Off' : `${d} day${d > 1 ? 's' : ''} before`} selected={reminder === d} onPress={() => setReminder(d)} />
            ))}
          </Row>
        </View>
      ) : (
        <View style={{ gap: space.sm, marginTop: space.md }}>
          <T kind="small" color={p.ink} style={{ fontFamily: font.bold }}>Goal</T>
          {goals.length === 0 ? (
            <T kind="small">No goals yet — create one on the Roadmap to link quests to it.</T>
          ) : (
            <Row style={{ flexWrap: 'wrap' }}>
              <Chip label="None" selected={!goalId} onPress={() => setGoalId(undefined)} />
              {goals.map((g) => (
                <Chip key={g.id} label={g.title} selected={goalId === g.id} onPress={() => setGoalId(g.id)} />
              ))}
            </Row>
          )}
        </View>
      )}

      <Button title={saving ? 'Saving…' : existing ? 'Save changes' : isSide ? 'Add side quest' : 'Add quest'} onPress={save} disabled={saving} style={{ marginTop: space.lg }} />
      {existing && existing.active && (
        <Button title="Archive quest" kind="tertiary" onPress={() => setConfirmArchive(true)} />
      )}

      <ConfirmDialog
        visible={confirmArchive}
        title="Archive this quest?"
        body="Open occurrences are removed. Completed history and earned coins stay."
        confirmLabel="Archive"
        kind="danger"
        onConfirm={archive}
        onCancel={() => setConfirmArchive(false)}
      />
    </Screen>
  );
}
