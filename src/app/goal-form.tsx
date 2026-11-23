import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { createGoal, updateGoal, type GoalInput } from '@/domain/commands';
import { useStore, useToday } from '@/state/store';
import { goalInitials } from '@/domain/goal-mark';
import { GOAL_COLOR_COUNT, goalSlots } from '@/domain/goal-share';
import type { Goal } from '@/domain/types';
import { Button, Card, Chip, Field, FormFooter, Ionicons, Row, Screen, T } from '@/ui/components';
import { goalColor } from '@/ui/goal-charts';
import { CalendarDateField } from '@/ui/date-field';
import { GOAL_ICONS, goalIconPreset, GoalMark } from '@/ui/goal-mark';
import { font, radius, space, usePalette } from '@/ui/theme';
import { celebrate, toast } from '@/ui/toast';

/** An end goal: what you want to reach, why, and by when. Quests linked to it drive its status. */
export default function GoalForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const s = useStore((st) => st.snapshot);
  const run = useStore((st) => st.run);
  const today = useToday();
  const existing = id ? s.goals.find((g) => g.id === id) : undefined;

  const [title, setTitle] = useState(existing?.title ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [deadline, setDeadline] = useState(existing?.deadline ?? '');
  // Unknown stored values show as initials and are cleared on save unless a preset is picked.
  const [icon, setIcon] = useState<string | undefined>(goalIconPreset(existing?.icon) ? existing?.icon : undefined);
  const [color, setColor] = useState<number | undefined>(existing?.color);
  const [saving, setSaving] = useState(false);
  const p = usePalette();
  // The colour "Automatic" would give: the goal's slot with no colour chosen.
  const draft: Goal = existing
    ? { ...existing, color: undefined }
    : { id: '~new', title, description, status: 'active', createdAt: '9999', updatedAt: '9999' };
  const autoSlot = goalSlots({ ...s, goals: [...s.goals.filter((g) => g.id !== draft.id), draft] }).get(draft.id) ?? 0;
  const ring = goalColor(p, color ?? autoSlot);

  const save = async () => {
    if (saving) return;
    const input: GoalInput = { title, description, deadline, icon, color };
    setSaving(true);
    const res = await run((st, c) => {
      const changes = existing ? updateGoal(st, c, existing.id, input) : createGoal(st, c, input);
      return { changes, value: changes.put.goals?.[0]?.id };
    });
    setSaving(false);
    if (!res.ok) return toast(res.message, 'error');
    if (existing) {
      toast('Goal updated');
      return router.back();
    }
    celebrate({ kind: 'goal', title: 'Goal created', detail: 'Now link a quest to it.' });
    if (res.value) router.replace({ pathname: '/goal/[id]', params: { id: res.value } });
    else router.back();
  };

  return (
    <Screen
      edges={['bottom']}
      footer={(
        <FormFooter>
          <Button title={saving ? 'Saving…' : existing ? 'Save changes' : 'Create goal'} icon={existing ? 'checkmark' : 'add'} onPress={save} disabled={saving || !title.trim()} />
        </FormFooter>
      )}>
      <Stack.Screen options={{ title: existing ? 'Edit goal' : 'New goal' }} />
      <Card style={{ gap: space.md }}>
        <T kind="h3" accessibilityRole="header">Goal details</T>
        <Field label="Goal" value={title} onChangeText={setTitle} placeholder="e.g. Get a new job" />
        <Field label="Why it matters (optional)" value={description} onChangeText={setDescription} placeholder="What does done look like?" multiline />
        <IconPicker title={title} value={icon} onChange={setIcon} ring={ring} />
        <ColorPicker value={color} autoColor={goalColor(p, autoSlot)} onChange={setColor} />
        <CalendarDateField
          label="Deadline (optional)"
          value={deadline}
          onChange={setDeadline}
          onClear={() => setDeadline('')}
          emptyLabel="No deadline"
          today={today}
        />
      </Card>
    </Screen>
  );
}

/**
 * Optional goal icon (addendum A3 §6): shows the current mark, opens a compact grid of labelled
 * presets, and **Use initials** clears it. The mark is what the goal shows on the overview map.
 */
function IconPicker({ title, value, onChange, ring }: { title: string; value?: string; onChange: (v: string | undefined) => void; ring: string }) {
  const p = usePalette();
  const [open, setOpen] = useState(false);
  const preset = goalIconPreset(value);
  const initials = goalInitials(title);
  const current = preset ? preset.label : initials ? `Initials (${initials})` : 'Goal flag';
  return (
    <View style={{ gap: 6, marginBottom: space.md }}>
      <T kind="small" color={p.ink} style={{ fontFamily: font.bold }}>
        Goal icon (optional)
      </T>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`Goal icon: ${current}. ${open ? 'Close the icon list' : 'Change'}`}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.md,
          padding: space.md,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: p.border,
          backgroundColor: p.surface,
          opacity: pressed ? 0.8 : 1,
        })}>
        <GoalMark goal={{ title: title || '?', icon: value }} size={40} ring={ring} />
        <View style={{ flex: 1, gap: 2 }}>
          <T kind="bodyStrong">{current}</T>
          <T kind="meta">Shown for this goal on your goals map.</T>
        </View>
        <T kind="small" color={p.forest} style={{ fontFamily: font.bold }}>
          {open ? 'Done' : 'Change'}
        </T>
      </Pressable>
      {open && (
        <Row style={{ flexWrap: 'wrap' }}>
          <Chip
            label="Use initials"
            icon="text-outline"
            selected={!preset}
            onPress={() => {
              onChange(undefined);
              setOpen(false);
            }}
          />
          {GOAL_ICONS.map((x) => (
            <Chip
              key={x.key}
              label={x.label}
              icon={x.icon}
              selected={value === x.key}
              onPress={() => {
                onChange(x.key);
                setOpen(false);
              }}
            />
          ))}
        </Row>
      )}
    </View>
  );
}

/** Names for the goal palette (`series` in the theme), in slot order. */
const COLOR_NAMES = ['Blue', 'Orange', 'Teal', 'Amber', 'Pink', 'Green', 'Violet'];

/**
 * Optional goal colour: **Automatic** (the next colour no other goal chose) or one of the palette
 * colours. It's used on the goals map, Roadmap, goal page and linked quests.
 */
function ColorPicker({ value, autoColor, onChange }: { value?: number; autoColor: string; onChange: (v: number | undefined) => void }) {
  const p = usePalette();
  const name = value === undefined ? 'Automatic' : COLOR_NAMES[value];
  return (
    <View style={{ gap: 6, marginBottom: space.md }}>
      <T kind="small" color={p.ink} style={{ fontFamily: font.bold }}>
        Goal color (optional)
      </T>
      <View role="radiogroup" aria-label="Goal color" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
        <Swatch label="Automatic" selected={value === undefined} onPress={() => onChange(undefined)}>
          <View style={{ width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderStyle: 'dashed', borderColor: autoColor, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="sparkles" size={14} color={autoColor} aria-hidden />
          </View>
        </Swatch>
        {Array.from({ length: GOAL_COLOR_COUNT }, (_, i) => (
          <Swatch key={i} label={COLOR_NAMES[i]} selected={value === i} onPress={() => onChange(i)}>
            <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: goalColor(p, i), alignItems: 'center', justifyContent: 'center' }}>
              {value === i && <Ionicons name="checkmark" size={18} color="#FFFFFF" aria-hidden />}
            </View>
          </Swatch>
        ))}
      </View>
      <T kind="meta">{name} · shown on your goals map, Roadmap and linked quests.</T>
    </View>
  );
}

function Swatch({ label, selected, onPress, children }: { label: string; selected: boolean; onPress: () => void; children: ReactNode }) {
  const p = usePalette();
  return (
    <Pressable
      role="radio"
      aria-checked={selected}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: 22,
        borderWidth: 2,
        borderColor: selected ? p.ink : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.7 : 1,
      })}>
      {children}
    </Pressable>
  );
}
