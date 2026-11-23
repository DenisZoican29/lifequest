/** Preset keys are stored on individual quests. */
export const QUEST_ICONS = [
  { key: 'checklist', label: 'Checklist', glyph: 'list-outline' },
  { key: 'reading', label: 'Reading', glyph: 'book-outline' },
  { key: 'writing', label: 'Writing', glyph: 'pencil-outline' },
  { key: 'study', label: 'Study', glyph: 'school-outline' },
  { key: 'email', label: 'Email', glyph: 'mail-outline' },
  { key: 'phone', label: 'Phone', glyph: 'call-outline' },
  { key: 'meal', label: 'Meal', glyph: 'restaurant-outline' },
  { key: 'water', label: 'Water', glyph: 'water-outline' },
  { key: 'walk', label: 'Walk', glyph: 'footsteps-outline' },
  { key: 'workout', label: 'Workout', glyph: 'barbell-outline' },
  { key: 'health', label: 'Health', glyph: 'heart-outline' },
  { key: 'chores', label: 'Chores', glyph: 'construct-outline' },
  { key: 'shopping', label: 'Shopping', glyph: 'cart-outline' },
  { key: 'music', label: 'Music', glyph: 'musical-notes-outline' },
  { key: 'sleep', label: 'Sleep', glyph: 'moon-outline' },
] as const;

export type QuestIcon = (typeof QUEST_ICONS)[number]['key'];

export function questIconPreset(key: unknown) {
  return QUEST_ICONS.find((preset) => preset.key === key);
}
