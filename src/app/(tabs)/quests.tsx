import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { questLibrary, sideQuestWarning, type LibraryFilter, type QuestItem } from '@/domain/selectors';
import { useStore, useToday } from '@/state/store';
import { Button, EmptyState, Ionicons, Screen, ScreenHeader, SearchField, SectionLabel, T, UnderlineTabs } from '@/ui/components';
import { QuestListCard, QuestRows } from '@/ui/quest-row';
import { space, usePalette } from '@/ui/theme';

/** Deep links: ?view=side opens Side quests; anything else (old today/week/daily/weekly links too) opens All. */
const toFilter = (v?: string): LibraryFilter | undefined => (v === 'side' || v === 'main' ? v : v ? 'all' : undefined);

/**
 * Quests library (addendum A4 §2): every quest, one row each, opening on **All**. **Main quests**
 * and **Side quests** filter by type, and **Find a quest** searches titles and linked goals.
 * Active quests come first; finished one-time quests and archived ones sit in collapsed sections.
 * Today holds the daily list and that day's activity.
 */
export default function Quests() {
  const p = usePalette();
  const params = useLocalSearchParams<{ view?: string }>();
  const [filter, setFilter] = useState<LibraryFilter>(toFilter(params.view) ?? 'all');
  const [lastParam, setLastParam] = useState(params.view);
  if (params.view !== lastParam) {
    // Follow deep links like /quests?view=side.
    setLastParam(params.view);
    const v = toFilter(params.view);
    if (v) setFilter(v);
  }
  const [query, setQuery] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const s = useStore((st) => st.snapshot);
  const today = useToday();
  const library = questLibrary(s, today, filter, query);
  const total = library.active.length + library.completed.length + library.archived.length;
  const searching = query.trim() !== '';
  const hasAny = s.tasks.some((t) => filter === 'all' || t.taskType === filter);
  const warning = sideQuestWarning(s, today);
  const warningLabel = warning.level === 'overdue'
    ? `${warning.overdue} overdue`
    : warning.level === 'soon' ? `${warning.soon} due soon` : undefined;
  const isSide = filter === 'side';
  const addQuest = () => router.push(isSide ? { pathname: '/task-form', params: { type: 'side' } } : '/task-form');
  const kind = filter === 'side' ? 'side quests' : filter === 'main' ? 'main quests' : 'quests';

  return (
    <Screen tabs>
      <ScreenHeader
        title="Quests"
        right={<Button compact icon="add" title={isSide ? 'Add side quest' : 'Add quest'} onPress={addQuest} />}
      />
      <UnderlineTabs
        label="Quest type"
        value={filter}
        onChange={setFilter}
        fit
        options={[
          { value: 'all', label: 'All' },
          { value: 'main', label: 'Main quests' },
          {
            value: 'side',
            label: 'Side quests',
            accessibilityLabel: warningLabel ? `Side quests, ${warningLabel}` : undefined,
            trailing: warning.level && <Ionicons name="warning" size={16} color={warning.level === 'overdue' ? p.roseInk : p.goldInk} aria-hidden />,
          },
        ]}
      />
      {hasAny && <SearchField label="Find a quest" value={query} onChangeText={setQuery} />}

      {!hasAny ? (
        <EmptyState
          mood="happy"
          title={isSide ? 'No side quests yet' : 'No quests yet'}
          body={isSide
            ? 'Add chores and upkeep, like cleaning the oven or changing the car oil. They never count toward your roadmap.'
            : 'Add something small you can do today, or a habit you want to keep.'}
          action={<Button title={isSide ? 'Add side quest' : 'Add a quest'} icon="add" onPress={addQuest} />}
        />
      ) : total === 0 ? (
        <T kind="small" style={styles.noMatch}>No {kind} match “{query.trim()}”.</T>
      ) : (
        <>
          <SectionLabel right={<T kind="meta">{library.active.length}</T>}>Active</SectionLabel>
          {library.active.length > 0 ? (
            <QuestListCard><QuestRows items={library.active} today={today} showType={filter === 'all'} /></QuestListCard>
          ) : (
            <T kind="small">{searching ? `No active ${kind} match.` : `No active ${kind}.`}</T>
          )}
          <Section
            title="Completed one-time quests"
            items={library.completed}
            open={showCompleted || (searching && library.active.length === 0)}
            onToggle={() => setShowCompleted((v) => !v)}
            today={today}
            showType={filter === 'all'}
          />
          <Section
            title="Archived"
            items={library.archived}
            open={showArchived || (searching && library.active.length === 0 && library.completed.length === 0)}
            onToggle={() => setShowArchived((v) => !v)}
            today={today}
            showType={filter === 'all'}
          />
        </>
      )}
    </Screen>
  );
}

/** A collapsed secondary list (finished one-time quests, archived quests) with its count. */
function Section({ title, items, open, onToggle, today, showType }: {
  title: string;
  items: QuestItem[];
  open: boolean;
  onToggle: () => void;
  today: string;
  showType: boolean;
}) {
  const p = usePalette();
  if (items.length === 0) return null;
  return (
    <QuestListCard>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title}, ${items.length}`}
        aria-expanded={open}
        onPress={onToggle}
        style={({ pressed }) => [styles.toggle, pressed && { opacity: 0.72 }]}>
        <T kind="bodyStrong" style={styles.grow}>{title}</T>
        <T kind="meta">{items.length}</T>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={p.muted} aria-hidden />
      </Pressable>
      {open && <QuestRows items={items} today={today} showType={showType} divideFirst />}
    </QuestListCard>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1 },
  toggle: { flexDirection: 'row', alignItems: 'center', minHeight: 44, paddingHorizontal: space.md, gap: space.sm },
  noMatch: { paddingVertical: space.md },
});
