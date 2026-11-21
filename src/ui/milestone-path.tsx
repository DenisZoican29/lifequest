import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { addMilestone, deleteMilestone, toggleMilestone } from '@/domain/commands';
import { formatFriendly, isLocalDate } from '@/domain/dates';
import type { Milestone } from '@/domain/types';
import { useStore, useToday } from '@/state/store';

import { Mascot } from './art';
import { Button, Field, Ionicons, Row, StatusChip, T } from './components';
import { DateField } from './date-field';
import { font, radius, softShadow, space, usePalette } from './theme';
import { toast } from './toast';

type Stage = 'done' | 'current' | 'next' | 'later';
const STAGE_LABEL: Record<Stage, string> = { done: 'Done', current: 'In progress', next: 'Next', later: 'Later' };

function stages(milestones: Milestone[]): Stage[] {
  let open = 0;
  return milestones.map((m) => {
    if (m.completedAt) return 'done';
    open += 1;
    return open === 1 ? 'current' : open === 2 ? 'next' : 'later';
  });
}

/** "A path, not a calendar": numbered checkpoints on a simple trail (spec §06). Tap a checkpoint for details. */
export function MilestonePath({ goalId, milestones }: { goalId: string; milestones: Milestone[] }) {
  const p = usePalette();
  const today = useToday();
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const st = stages(milestones);
  const selected = milestones.find((m) => m.id === openId);

  return (
    <View style={{ gap: space.md }}>
      {milestones.length === 0 ? (
        <T kind="muted">No checkpoints yet. Break the goal into a few achievable steps.</T>
      ) : (
        <View>
          <View style={[styles.rail, { backgroundColor: p.mint }]} />
          {milestones.map((m, i) => {
            const stage = st[i];
            return (
              <Pressable
                key={m.id}
                onPress={() => setOpenId(m.id)}
                accessibilityRole="button"
                accessibilityLabel={`Checkpoint ${i + 1}: ${m.title}, ${STAGE_LABEL[stage]}`}
                style={styles.step}>
                <Node stage={stage} n={i + 1} />
                <View style={[styles.stepCard, { backgroundColor: p.surface, borderColor: p.border }]}>
                  <T kind="bodyStrong" color={stage === 'done' ? p.muted : p.ink}>
                    {m.title}
                  </T>
                  <T kind="meta">
                    {STAGE_LABEL[stage]}
                    {m.dueAt && stage !== 'done' ? ` · ${formatFriendly(m.dueAt, today)}` : ''}
                  </T>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
      <Button kind="secondary" title="Add a milestone" onPress={() => setAdding(true)} />

      {selected && <CheckpointSheet milestone={selected} stage={st[milestones.indexOf(selected)]} onClose={() => setOpenId(null)} />}
      {adding && <AddMilestoneSheet goalId={goalId} onClose={() => setAdding(false)} />}
    </View>
  );
}

function Node({ stage, n }: { stage: Stage; n: number }) {
  const p = usePalette();
  if (stage === 'done') {
    return (
      <View style={[styles.node, { backgroundColor: p.forestBright, borderColor: p.forestBright }]}>
        <Ionicons name="checkmark" size={20} color="#fff" />
      </View>
    );
  }
  const current = stage === 'current';
  return (
    <View style={[styles.node, { backgroundColor: current ? p.gold : p.surface, borderColor: current ? '#D9A03C' : p.border }]}>
      <T kind="bodyStrong" color={current ? '#273D35' : p.muted} style={{ fontFamily: font.bold }}>
        {n}
      </T>
    </View>
  );
}

function Sheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  const p = usePalette();
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close">
        <Pressable style={[styles.sheet, { backgroundColor: p.surface }, softShadow(p)]} onPress={() => undefined}>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function CheckpointSheet({ milestone, stage, onClose }: { milestone: Milestone; stage: Stage; onClose: () => void }) {
  const run = useStore((s) => s.run);
  const today = useToday();
  const done = !!milestone.completedAt;
  const toggle = async () => {
    const res = await run((s, c) => toggleMilestone(s, c, milestone.id));
    if (!res.ok) return toast(res.message, 'error');
    toast(done ? 'Checkpoint reopened' : 'Checkpoint reached! Nice work.');
    onClose();
  };
  const remove = async () => {
    const res = await run((s, c) => deleteMilestone(s, c, milestone.id));
    if (!res.ok) return toast(res.message, 'error');
    onClose();
  };
  return (
    <Sheet onClose={onClose}>
      {!done && stage === 'current' && (
        <View style={{ alignItems: 'center' }}>
          <Mascot mood="happy" size={72} />
        </View>
      )}
      <StatusChip tone={done ? 'done' : stage === 'current' ? 'due' : 'weekly'} label={STAGE_LABEL[stage]} />
      <T kind="h2">{milestone.title}</T>
      <T kind="muted">{milestone.dueAt ? `Target date: ${formatFriendly(milestone.dueAt, today)} (${milestone.dueAt})` : 'No target date'}</T>
      {done && milestone.completedAt && <T kind="small">Reached on {milestone.completedAt.slice(0, 10)}</T>}
      <Button title={done ? 'Mark as not done' : 'Mark checkpoint done'} kind={done ? 'tertiary' : 'primary'} onPress={toggle} />
      <Row>
        <Button title="Delete" kind="danger" compact onPress={remove} style={{ flex: 1 }} />
        <Button title="Close" kind="tertiary" compact onPress={onClose} style={{ flex: 1 }} />
      </Row>
    </Sheet>
  );
}

function AddMilestoneSheet({ goalId, onClose }: { goalId: string; onClose: () => void }) {
  const run = useStore((s) => s.run);
  const today = useToday();
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  const save = async () => {
    if (due && !isLocalDate(due)) return toast('Use the format 2026-12-31 for the date', 'error');
    const res = await run((s, c) => addMilestone(s, c, goalId, title, due || undefined));
    if (!res.ok) return toast(res.message, 'error');
    onClose();
  };
  return (
    <Sheet onClose={onClose}>
      <T kind="h2">Add a milestone</T>
      <Field label="Checkpoint" value={title} onChangeText={setTitle} placeholder="e.g. Build an API" />
      <DateField label="Target date (optional)" value={due} onChange={setDue} today={today} optional />
      <Button title="Add milestone" onPress={save} disabled={!title.trim()} />
      <Button title="Not now" kind="tertiary" onPress={onClose} />
    </Sheet>
  );
}

const NODE = 40;
const styles = StyleSheet.create({
  rail: { position: 'absolute', left: NODE / 2 - 4, top: NODE / 2, bottom: NODE / 2, width: 8, borderRadius: 4 },
  step: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.sm },
  node: { width: NODE, height: NODE, borderRadius: NODE / 2, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  stepCard: { flex: 1, borderWidth: 1, borderRadius: radius.md, paddingVertical: space.md, paddingHorizontal: space.lg, gap: 2, minHeight: 60, justifyContent: 'center' },
  backdrop: { flex: 1, backgroundColor: 'rgba(39,61,53,0.45)', justifyContent: 'flex-end', alignItems: 'center' },
  sheet: { width: '100%', maxWidth: 430, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: space.xl, gap: space.md },
});
