import { format } from 'date-fns';
import { router } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { deleteTask, doneInWindow, rescheduleWindow } from '@/domain/commands';
import { fromLocalDate, isLocalDate } from '@/domain/dates';
import type { TaskDefinition } from '@/domain/types';
import { useStore, useToday } from '@/state/store';

import { Button, Row, StatusChip, T } from './components';
import { DateField } from './date-field';
import { radius, softShadow, space, usePalette } from './theme';
import { toast } from './toast';

const day = (d: string) => format(fromLocalDate(d), 'd MMM');

/**
 * A date-range quest whose end date passed before the target was met: give it more time
 * (progress so far still counts) or delete it.
 */
export function NotDoneSheet({ task, onClose }: { task: TaskDefinition; onClose: () => void }) {
  const p = usePalette();
  const s = useStore((st) => st.snapshot);
  const run = useStore((st) => st.run);
  const today = useToday();
  const [end, setEnd] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const w = task.window;
  if (!w) return null;
  const done = doneInWindow(s, task.id, w);
  const validEnd = isLocalDate(end) && end >= today;

  const reschedule = async () => {
    setBusy(true);
    const res = await run((st, c) => rescheduleWindow(st, c, task.id, end));
    setBusy(false);
    if (!res.ok) return toast(res.message, 'error');
    toast(`More time until ${day(end)}. ${w.times - done} to go.`);
    onClose();
  };
  const remove = async () => {
    setBusy(true);
    const res = await run((st, c) => deleteTask(st, c, task.id));
    setBusy(false);
    if (!res.ok) return toast(res.message, 'error');
    toast('Quest deleted');
    onClose();
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close">
        <Pressable style={[styles.sheet, { backgroundColor: p.surface }, softShadow(p)]} onPress={() => undefined}>
          {confirmDelete ? (
            <>
              <T kind="h2">Delete “{task.title}”?</T>
              <T kind="muted">It disappears from your quests and goals. Coins it already earned stay in your bank. This can’t be undone.</T>
              <Button title={busy ? 'Deleting…' : 'Delete for good'} kind="danger" onPress={remove} disabled={busy} />
              <Button title="Keep it" kind="tertiary" onPress={() => setConfirmDelete(false)} />
            </>
          ) : (
            <>
              <StatusChip tone="overdue" icon="alert-circle-outline" label="Not done" />
              <T kind="h2">{task.title}</T>
              <T kind="muted">
                You did {done} of {w.times} between {day(w.start)} and {day(w.end)}.
              </T>

              <T kind="bodyStrong" style={{ marginTop: space.sm }}>
                Give it more time
              </T>
              <DateField label="New end date" value={end} onChange={setEnd} today={today} />
              <Button
                title={validEnd ? `Reschedule until ${day(end)}` : 'Reschedule'}
                icon="calendar-outline"
                onPress={reschedule}
                disabled={!validEnd || busy}
              />
              <T kind="meta">The {done} already done still count. You’ll need {w.times - done} more.</T>

              <Row style={{ marginTop: space.sm }}>
                <Button title="Delete quest" kind="danger" compact onPress={() => setConfirmDelete(true)} style={{ flex: 1 }} />
                <Button
                  title="Edit details"
                  kind="tertiary"
                  compact
                  onPress={() => {
                    onClose();
                    router.push({ pathname: '/task-form', params: { id: task.id } });
                  }}
                  style={{ flex: 1 }}
                />
              </Row>
              <View>
                <Button title="Close" kind="ghost" compact onPress={onClose} />
              </View>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(39,61,53,0.45)', justifyContent: 'flex-end', alignItems: 'center' },
  sheet: { width: '100%', maxWidth: 430, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: space.xl, gap: space.md },
});
