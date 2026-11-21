import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { daysBetween } from '@/domain/dates';
import { questsCompleted, questsDueToday, questsUpcoming, sideQuests, type QuestItem } from '@/domain/selectors';
import { useStore, useToday } from '@/state/store';
import { Button, Card, EmptyState, Ionicons, ProgressBar, Screen, ScreenHeader, SectionLabel, Segmented, T } from '@/ui/components';
import { QuestRow, SideQuestCard } from '@/ui/quest-row';
import { radius, space, usePalette } from '@/ui/theme';
import type { TaskType } from '@/domain/types';

type Tab = 'daily' | 'weekly' | 'side';

export default function Quests() {
  const p = usePalette();
  const params = useLocalSearchParams<{ view?: Tab }>();
  const [tab, setTab] = useState<Tab>(params.view ?? 'daily');
  const [lastParam, setLastParam] = useState(params.view);
  if (params.view !== lastParam) {
    // Follow deep links like /quests?view=side.
    setLastParam(params.view);
    if (params.view) setTab(params.view);
  }
  const [showHistory, setShowHistory] = useState(false);

  const s = useStore((st) => st.snapshot);
  const today = useToday();
  const ago = (i: QuestItem) => daysBetween(i.occurrence.completedOn ?? today, today);

  const completedMain = questsCompleted(s, today, 'main');
  const daily = [...questsDueToday(s, today), ...completedMain.filter((i) => i.occurrence.completedOn === today)];
  const upcoming = questsUpcoming(s, today);
  const weekly = [...upcoming.filter((i) => i.dueInDays <= 7), ...completedMain.filter((i) => ago(i) > 0 && ago(i) < 7)];
  const later = upcoming.filter((i) => i.dueInDays > 7);
  const sideOpen = sideQuests(s, today);
  const sideDone = questsCompleted(s, today, 'side').filter((i) => ago(i) <= 30);
  const dueSoon = sideOpen.filter((i) => i.overdue || i.dueInDays <= 7 || i.reminderActive).length;

  const isSide = tab === 'side';
  const list = tab === 'daily' ? daily : weekly;
  const doneCount = list.filter((i) => i.occurrence.status === 'completed').length;

  return (
    <Screen tabs>
      <ScreenHeader
        eyebrow={isSide ? 'Housekeeping hero' : 'Keep going'}
        title={isSide ? 'Side quests' : 'Your quests'}
        subtitle={isSide ? 'Small responsibilities, handled.' : 'Choose what to do next.'}
      />
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'daily', label: 'Daily' },
          { value: 'weekly', label: 'Weekly' },
          { value: 'side', label: 'Side quests', count: sideOpen.filter((i) => i.overdue).length },
        ]}
      />

      {isSide ? (
        <>
          <Card hero tone="peach">
            <T kind="eyebrow" color={p.ink}>
              Up next
            </T>
            <T kind="title">{dueSoon === 0 ? 'Nothing due soon' : `${dueSoon} task${dueSoon > 1 ? 's' : ''} due soon`}</T>
            <T kind="small" color={p.ink}>
              We will keep track of the rest.
            </T>
          </Card>
          {sideOpen.length === 0 && sideDone.length === 0 ? (
            <EmptyState mood="happy" title="No side quests yet" body="Add chores and upkeep, like cleaning the oven or changing the car oil. They never count toward your roadmap." />
          ) : (
            <View style={{ gap: space.md }}>
              {sideOpen.map((item) => (
                <SideQuestCard key={item.occurrence.id} item={item} today={today} />
              ))}
              {sideDone.slice(0, 5).map((item) => (
                <SideQuestCard key={item.occurrence.id} item={item} today={today} />
              ))}
            </View>
          )}
          <Button title="+ Add side quest" onPress={() => router.push({ pathname: '/task-form', params: { type: 'side' } })} />
          <ArchivedQuests type="side" />
        </>
      ) : (
        <>
          <Card hero tone="mint">
            <T kind="eyebrow" color={p.ink}>
              {tab === 'daily' ? 'Today' : 'This week'}
            </T>
            <T kind="title">{list.length === 0 ? 'Nothing scheduled' : `${doneCount} of ${list.length} completed`}</T>
            <ProgressBar ratio={list.length ? doneCount / list.length : 0} color={p.forest} track={p.surface} />
          </Card>
          {list.length === 0 ? (
            <EmptyState
              mood="cheer"
              title="Your quest board is clear."
              body={tab === 'daily' ? 'Nothing due today. Add one or plan ahead.' : 'Nothing due in the next 7 days.'}
            />
          ) : (
            <View style={{ gap: space.sm }}>
              {list.map((item) => (
                <QuestRow key={item.occurrence.id} item={item} today={today} showDue={tab === 'weekly'} />
              ))}
            </View>
          )}
          {tab === 'weekly' && later.length > 0 && (
            <>
              <SectionLabel>Later</SectionLabel>
              <View style={{ gap: space.sm }}>
                {later.map((item) => (
                  <QuestRow key={item.occurrence.id} item={item} today={today} />
                ))}
              </View>
            </>
          )}
          <Button title="+ Add quest" onPress={() => router.push('/task-form')} />

          {completedMain.length > 0 && (
            <Button kind="ghost" title={showHistory ? 'Hide history' : 'Show completed history'} onPress={() => setShowHistory((v) => !v)} />
          )}
          {showHistory && (
            <View style={{ gap: space.sm }}>
              {completedMain.slice(0, 50).map((item) => (
                <QuestRow key={item.occurrence.id} item={item} today={today} />
              ))}
            </View>
          )}
          <ArchivedQuests type="main" />
        </>
      )}
    </Screen>
  );
}

/** Archived quests stay out of the lists but can be opened and restored from here. */
function ArchivedQuests({ type }: { type: TaskType }) {
  const p = usePalette();
  const [open, setOpen] = useState(false);
  const archived = useStore((st) => st.snapshot.tasks).filter((t) => !t.active && t.taskType === type);
  if (archived.length === 0) return null;
  return (
    <>
      <Button kind="ghost" title={open ? 'Hide archived' : `Archived (${archived.length})`} onPress={() => setOpen((v) => !v)} />
      {open &&
        archived.map((t) => (
          <Pressable
            key={t.id}
            accessibilityRole="button"
            accessibilityLabel={`Open archived quest ${t.title}`}
            onPress={() => router.push({ pathname: '/task-form', params: { id: t.id } })}
            style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: p.border, backgroundColor: p.surface }}>
            <Ionicons name="archive-outline" size={18} color={p.muted} />
            <T kind="body" color={p.muted} style={{ flex: 1 }} numberOfLines={1}>
              {t.title}
            </T>
            <T kind="small" color={p.forest}>Restore</T>
          </Pressable>
        ))}
    </>
  );
}
