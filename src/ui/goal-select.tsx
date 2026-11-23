import { format } from 'date-fns';
import { useState, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { fromLocalDate } from '@/domain/dates';
import { goalSlots } from '@/domain/goal-share';
import { searchGoals } from '@/domain/goal-search';
import type { Goal } from '@/domain/types';
import { useStore } from '@/state/store';

import { DisclosureCard, Ionicons, SearchField, T } from './components';
import { GoalMark } from './goal-mark';
import { radius, space, TOUCH, usePalette } from './theme';

/**
 * Goal picker for quests: a "Goal" row that opens a dropdown with a search box and the
 * matching goals. Enter picks the first match; Escape closes.
 */
export function GoalSelect({ goals, value, onChange, leading }: {
  goals: Goal[];
  value?: string;
  onChange: (goalId?: string) => void;
  leading?: ReactNode;
}) {
  const p = usePalette();
  const slots = goalSlots(useStore((st) => st.snapshot));
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = goals.find((g) => g.id === value);
  const matches = searchGoals(goals, query);
  const searching = query.trim() !== '';

  const close = () => {
    setOpen(false);
    setQuery('');
  };
  const pick = (id?: string) => {
    onChange(id);
    close();
  };

  return (
    <DisclosureCard
      title="Goal"
      summary={selected?.title ?? 'No linked goal'}
      leading={leading}
      expanded={open}
      onPress={() => (open ? close() : setOpen(true))}>
          {goals.length === 0 ? (
            <T kind="small" style={styles.empty}>No goals yet. Create one on the Roadmap to link quests to it.</T>
          ) : (
            <>
              <SearchField
                label="Search goals"
                value={query}
                onChangeText={setQuery}
                autoFocus={Platform.OS === 'web'}
                returnKeyType="done"
                onSubmit={() => matches[0] && pick(matches[0].id)}
                onEscape={close}
              />
              <ScrollView style={styles.list} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                <View role="radiogroup" aria-label="Goals">
                  {!searching && (
                    <Option selected={!value} onPress={() => pick()} label="No linked goal">
                      <View style={[styles.noneMark, { borderColor: p.border }]}>
                        <Ionicons name="remove" size={16} color={p.muted} aria-hidden />
                      </View>
                    </Option>
                  )}
                  {matches.map((g) => {
                    const slot = slots.get(g.id);
                    return (
                      <Option
                        key={g.id}
                        selected={g.id === value}
                        onPress={() => pick(g.id)}
                        label={g.title}
                        meta={g.deadline ? `By ${format(fromLocalDate(g.deadline), 'd MMM yyyy')}` : undefined}>
                        <GoalMark goal={g} size={30} ring={slot === undefined ? undefined : p.series[slot]} />
                      </Option>
                    );
                  })}
                  {searching && matches.length === 0 && (
                    <T kind="small" style={styles.empty}>No goals match “{query.trim()}”.</T>
                  )}
                </View>
              </ScrollView>
            </>
          )}
    </DisclosureCard>
  );
}

function Option({ label, meta, selected, onPress, children }: {
  label: string;
  meta?: string;
  selected: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  const p = usePalette();
  return (
    <Pressable
      role="radio"
      aria-checked={selected}
      accessibilityLabel={meta ? `${label}, ${meta}` : label}
      onPress={onPress}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        styles.option,
        { backgroundColor: selected ? p.mint : hovered ? p.track : 'transparent' },
        pressed && { opacity: 0.7 },
      ]}>
      <View aria-hidden>{children}</View>
      <View style={styles.optionText}>
        <T kind="bodyStrong" color={selected ? p.forest : p.ink} numberOfLines={2}>{label}</T>
        {!!meta && <T kind="meta">{meta}</T>}
      </View>
      {selected && <Ionicons name="checkmark" size={18} color={p.forest} aria-hidden />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { maxHeight: 264 },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: TOUCH + 8,
    paddingHorizontal: space.sm, paddingVertical: space.xs + 2, borderRadius: radius.sm,
  },
  optionText: { flex: 1, gap: 1 },
  noneMark: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  empty: { padding: space.sm },
});
