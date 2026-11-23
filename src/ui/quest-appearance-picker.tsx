import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { QUEST_ICONS, questIconPreset } from '@/domain/quest-mark';
import type { TaskDefinition } from '@/domain/types';

import { Button, IconButton, Ionicons, Row, Segmented, T } from './components';
import { QuestMark } from './goal-mark';
import { QuestColorOptions, questColorName } from './quest-color-picker';
import { radius, softShadow, space, TOUCH, usePalette } from './theme';

type Appearance = Pick<TaskDefinition, 'icon' | 'color'>;
type QuestPreview = Appearance & Pick<TaskDefinition, 'title' | 'goalId' | 'taskType'>;

function appearanceLabel(task: QuestPreview) {
  const icon = questIconPreset(task.icon)?.label ?? (task.goalId ? 'Goal icon' : 'Default icon');
  const color = task.color ? questColorName(task.color) : task.goalId ? 'Goal color' : 'Default color';
  return `${icon} · ${color}`;
}

export function QuestAppearancePicker({ task, onChange }: { task: QuestPreview; onChange: (appearance: Appearance) => void }) {
  const p = usePalette();
  const [open, setOpen] = useState(false);
  const summary = appearanceLabel(task);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Icon and color. ${summary}`}
        aria-expanded={open}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.trigger, { borderColor: p.border, backgroundColor: p.surface }, pressed && styles.pressed]}>
        <QuestMark task={task} size={36} />
        <View style={styles.copy}>
          <T kind="bodyStrong">Icon &amp; color</T>
          <T kind="meta">{summary}</T>
        </View>
        <Ionicons name="chevron-forward" size={17} color={p.muted} aria-hidden />
      </Pressable>
      {open && (
        <AppearanceDialog
          task={task}
          onClose={() => setOpen(false)}
          onApply={(next) => {
            onChange(next);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

function AppearanceDialog({ task, onClose, onApply }: {
  task: QuestPreview;
  onClose: () => void;
  onApply: (appearance: Appearance) => void;
}) {
  const p = usePalette();
  const [draft, setDraft] = useState<Appearance>(() => ({ icon: task.icon, color: task.color }));
  const [panel, setPanel] = useState<'icon' | 'color'>('icon');
  const preview = { ...task, ...draft };
  const fallback = { ...preview, icon: undefined };
  const tint = draft.color ? p.questColors[draft.color] : p.forest;
  const defaultIcon = task.goalId ? 'Use goal icon' : 'Use default icon';

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <SafeAreaView style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} accessible={false} tabIndex={-1} onPress={onClose} />
        <View role="dialog" aria-label="Quest appearance" aria-modal accessibilityViewIsModal style={[styles.dialog, { backgroundColor: p.surface }, softShadow(p)]}>
          <Row style={{ justifyContent: 'space-between' }}>
            <T kind="h2" accessibilityRole="header" style={styles.copy}>Quest appearance</T>
            <IconButton icon="close" label="Cancel appearance changes" onPress={onClose} />
          </Row>

          <Row gap={space.md} style={[styles.preview, { backgroundColor: `${tint}16`, borderColor: `${tint}35` }]}>
            <QuestMark task={preview} size={48} />
            <View style={styles.copy} accessibilityLiveRegion="polite" aria-live="polite">
              <T kind="bodyStrong" numberOfLines={2}>{task.title.trim() || 'Quest preview'}</T>
              <T kind="small">{appearanceLabel(preview)}</T>
            </View>
          </Row>

          <Segmented value={panel} onChange={setPanel} options={[{ value: 'icon', label: 'Icon' }, { value: 'color', label: 'Color' }]} />

          <ScrollView key={panel} style={styles.scroll} contentContainerStyle={styles.options} keyboardShouldPersistTaps="handled">
            {panel === 'icon' ? (
              <View style={{ gap: space.sm }} accessibilityRole="radiogroup" accessibilityLabel="Quest icons">
                <Pressable
                  accessibilityRole="radio"
                  aria-checked={!draft.icon}
                  accessibilityLabel={defaultIcon}
                  onPress={() => setDraft((current) => ({ ...current, icon: undefined }))}
                  style={({ pressed }) => [styles.trigger, {
                    borderColor: draft.icon ? p.border : p.forest,
                    backgroundColor: draft.icon ? p.surface : p.mint,
                  }, pressed && styles.pressed]}>
                  <QuestMark task={fallback} size={30} />
                  <T kind="bodyStrong" style={styles.copy}>{defaultIcon}</T>
                  {!draft.icon && <Ionicons name="checkmark" size={17} color={p.forest} aria-hidden />}
                </Pressable>
                <View style={styles.grid}>
                  {QUEST_ICONS.map(({ key, label, glyph }) => {
                    const selected = draft.icon === key;
                    return (
                      <Pressable
                        key={key}
                        accessibilityRole="radio"
                        accessibilityLabel={label}
                        aria-checked={selected}
                        onPress={() => setDraft((current) => ({ ...current, icon: key }))}
                        style={({ pressed }) => [styles.tile, {
                          borderColor: selected ? tint : p.border,
                          backgroundColor: selected ? `${tint}16` : p.surface,
                        }, pressed && styles.pressed]}>
                        {selected && <Ionicons name="checkmark" size={14} color={tint} style={styles.check} aria-hidden />}
                        <Ionicons name={glyph} size={23} color={draft.color ? tint : selected ? tint : p.ink} aria-hidden />
                        <T kind="meta" color={p.ink} style={styles.tileLabel}>{label}</T>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : (
              <QuestColorOptions
                value={draft.color}
                defaultLabel={task.goalId ? 'Goal color' : 'Default color'}
                onChange={(color) => setDraft((current) => ({ ...current, color }))}
              />
            )}
          </ScrollView>

          <Button title="Done" icon="checkmark" onPress={() => onApply(draft)} />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    minHeight: TOUCH, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.sm,
  },
  copy: { flex: 1, gap: 2 },
  pressed: { opacity: 0.7 },
  backdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: space.sm, backgroundColor: 'rgba(27,43,38,0.52)' },
  dialog: { width: '100%', maxWidth: 400, maxHeight: '100%', borderRadius: radius.lg, padding: space.md, gap: space.md },
  preview: { padding: space.md, borderRadius: radius.md, borderWidth: 1 },
  scroll: { flexGrow: 0, flexShrink: 1 },
  options: { paddingBottom: space.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: space.sm },
  tile: {
    width: '32%', minHeight: 59, justifyContent: 'center', alignItems: 'center', gap: 3,
    borderWidth: 1, borderRadius: radius.sm, paddingVertical: space.sm, paddingHorizontal: space.xs,
  },
  tileLabel: { textAlign: 'center' },
  check: { position: 'absolute', top: 4, right: 5 },
});
