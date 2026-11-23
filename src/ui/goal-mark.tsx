import { View } from 'react-native';

import { goalInitials } from '@/domain/goal-mark';
import { goalSlots } from '@/domain/goal-share';
import { questIconPreset } from '@/domain/quest-mark';
import { isQuestColor, type Goal, type TaskDefinition } from '@/domain/types';
import { useStore } from '@/state/store';

import { Ionicons, T, type IconName } from './components';
import { font, usePalette } from './theme';

/** Labelled presets for the goal icon picker (addendum A3 §6). The key is what's stored on the goal. */
export const GOAL_ICONS: { key: string; label: string; icon: IconName }[] = [
  { key: 'strength', label: 'Strength', icon: 'barbell-outline' },
  { key: 'running', label: 'Running', icon: 'footsteps-outline' },
  { key: 'health', label: 'Health', icon: 'heart-outline' },
  { key: 'reading', label: 'Reading', icon: 'book-outline' },
  { key: 'language', label: 'Language', icon: 'chatbubbles-outline' },
  { key: 'learning', label: 'Learning', icon: 'school-outline' },
  { key: 'career', label: 'Career', icon: 'briefcase-outline' },
  { key: 'money', label: 'Money', icon: 'wallet-outline' },
  { key: 'cooking', label: 'Cooking', icon: 'restaurant-outline' },
  { key: 'music', label: 'Music', icon: 'musical-notes-outline' },
  { key: 'creative', label: 'Creative', icon: 'color-palette-outline' },
  { key: 'coding', label: 'Coding', icon: 'code-slash-outline' },
  { key: 'travel', label: 'Travel', icon: 'airplane-outline' },
  { key: 'home', label: 'Home', icon: 'home-outline' },
  { key: 'family', label: 'Family', icon: 'people-outline' },
  { key: 'sleep', label: 'Sleep', icon: 'moon-outline' },
];

/** Preset for a stored key; undefined for no or unknown icons (→ initials). */
export const goalIconPreset = (key: string | undefined) => GOAL_ICONS.find((x) => x.key === key);

/**
 * The goal's mark: its icon, else its initials, else a generic flag. A circle on the surface
 * colour; `ring` draws it in the goal's colour (when the goal is on the map), `selected` adds an
 * ink outline so selection never depends on colour alone. Decorative: callers label the goal.
 */
export function GoalMark({
  goal,
  size = 32,
  ring,
  color,
  selected,
  bare = false,
  glyph,
}: {
  goal: Pick<Goal, 'title' | 'icon'>;
  size?: number;
  ring?: string;
  color?: string;
  selected?: boolean;
  bare?: boolean;
  glyph?: IconName;
}) {
  const p = usePalette();
  const icon = glyph ?? goalIconPreset(goal.icon)?.icon;
  const initials = icon ? '' : goalInitials(goal.title);
  const ringWidth = Math.max(2, Math.round(size / 12));
  const iconSize = Math.round(size * (bare ? 0.84 : 0.5));
  return (
    <View
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bare ? 'transparent' : p.surface,
        borderWidth: bare ? 0 : ringWidth,
        borderColor: ring ?? p.border,
        alignItems: 'center',
        justifyContent: 'center',
        // Selected: an ink outline outside the colour ring.
        ...(selected ? { outlineColor: p.ink, outlineWidth: 2.5, outlineStyle: 'solid', outlineOffset: 1.5 } : {}),
      }}>
      {icon ? (
        <Ionicons name={icon} size={iconSize} color={color ?? p.ink} />
      ) : initials ? (
        <T kind="meta" color={color ?? p.ink} style={{ fontFamily: font.black, fontSize: Math.round(size * (bare ? 0.64 : 0.36)), lineHeight: Math.round(size * (bare ? 0.82 : 0.44)) }}>
          {initials}
        </T>
      ) : (
        <Ionicons name="flag-outline" size={iconSize} color={color ?? p.ink} />
      )}
    </View>
  );
}

/**
 * A quest can override its icon. Otherwise it shows its goal's mark, a sparkle, or a house.
 * A chosen quest color tints both the mark and the ring.
 */
export function QuestMark({ task, size = 34 }: { task: Pick<TaskDefinition, 'goalId' | 'icon' | 'color' | 'taskType'>; size?: number }) {
  const p = usePalette();
  const s = useStore((st) => st.snapshot);
  const goal = task.goalId ? s.goals.find((g) => g.id === task.goalId) : undefined;
  const color = isQuestColor(task.color) ? p.questColors[task.color] : undefined;
  const glyph = questIconPreset(task.icon)?.glyph;
  const side = task.taskType === 'side';
  if (goal) {
    const slot = goalSlots(s).get(goal.id);
    const goalRing = slot === undefined ? undefined : (p.series[slot] ?? p.faint);
    return <GoalMark goal={goal} size={size} ring={color ?? goalRing} color={color} glyph={glyph} />;
  }
  return (
    <View
      aria-hidden
      style={{
        width: size, height: size, borderRadius: side ? size * 0.28 : size / 2,
        backgroundColor: color ? p.surface : side ? p.peach : p.mint, borderColor: color, borderWidth: color ? 2 : 0,
        alignItems: 'center', justifyContent: 'center',
      }}>
      <Ionicons name={glyph ?? (side ? 'home-outline' : 'sparkles-outline')} size={Math.round(size * 0.5)} color={color ?? (side ? p.ink : p.forest)} />
    </View>
  );
}
