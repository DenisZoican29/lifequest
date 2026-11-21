import { format } from 'date-fns';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { formatFriendly, fromLocalDate } from '@/domain/dates';
import { allowanceFor, coinBalance } from '@/domain/economy';
import { nextMilestone, questsDueToday, sideQuests } from '@/domain/selectors';
import { useStore, useToday } from '@/state/store';
import { Coin } from '@/ui/art';
import {
  Button,
  Card,
  EmptyState,
  IconButton,
  IconTile,
  Ionicons,
  ProgressBar,
  Row,
  Screen,
  ScreenHeader,
  SectionLabel,
  StatusChip,
  T,
} from '@/ui/components';
import { QuestRow } from '@/ui/quest-row';
import { space, usePalette } from '@/ui/theme';

/** Today: remaining shared time is the hero metric; the bank and next quests follow (spec §05). */
export default function Today() {
  const p = usePalette();
  const s = useStore((st) => st.snapshot);
  const today = useToday();
  const day = allowanceFor(s, today);
  const balance = coinBalance(s.wallet);
  const due = questsDueToday(s, today);
  const next = nextMilestone(s);
  const side = sideQuests(s, today)[0];

  return (
    <Screen tabs>
      <ScreenHeader
        eyebrow={`${format(fromLocalDate(today), 'EEEE, MMM d')}${s.settings.dayOffset ? ' · simulated' : ''}`}
        title="Hey, explorer!"
        subtitle="A little progress goes a long way."
        right={<IconButton icon="settings-outline" label="Settings" onPress={() => router.push('/settings')} />}
      />

      <Pressable onPress={() => router.push('/bank')} accessibilityRole="button" accessibilityLabel={`${day.remainingMinutes} minutes of screen time left today`}>
        <Card hero tone={day.blocked ? 'peach' : 'sky'}>
          <Row style={{ justifyContent: 'space-between' }}>
            <T kind="eyebrow" color={p.ink}>
              Screen time left
            </T>
            <StatusChip tone="plain" label="Demo mode" icon="flask-outline" />
          </Row>
          {day.blocked ? (
            <>
              <T kind="big">0 min</T>
              <T kind="small" color={p.ink}>
                Free time used up for today.
              </T>
            </>
          ) : (
            <>
              <T kind="big">{day.remainingMinutes} min</T>
              <T kind="small" color={p.ink}>
                {day.usedMinutes} of {day.totalMinutes} minutes used
                {day.purchasedMinutes ? ` · ${day.baseMinutes} free + ${day.purchasedMinutes} bought` : ''}
              </T>
            </>
          )}
          <View style={{ marginTop: space.sm }}>
            <ProgressBar ratio={day.totalMinutes ? day.usedMinutes / day.totalMinutes : 1} color={p.forest} track={p.surface} />
          </View>
          {!day.blocked && day.remainingMinutes <= 10 && (
            <T kind="small" color={p.ink} style={{ marginTop: 4 }}>
              You have {day.remainingMinutes} minutes left today. Want to earn a little more?
            </T>
          )}
        </Card>
      </Pressable>
      {/* Kept outside the tappable card so buttons are never nested (invalid on web). */}
      {day.blocked && <Button title="Go to the bank" onPress={() => router.push('/bank')} />}

      <Pressable onPress={() => router.push('/bank')} accessibilityRole="button" accessibilityLabel={`Reward bank: ${balance} coins`}>
        <Card>
          <Row gap={space.md}>
            <Coin size={46} />
            <View style={{ flex: 1 }}>
              <T kind="bodyStrong">Reward bank</T>
              <T kind="small">{balance} coins ready to spend</T>
            </View>
            <Ionicons name="chevron-forward" size={18} color={p.faint} />
          </Row>
        </Card>
      </Pressable>

      <SectionLabel>Your next quest</SectionLabel>
      {due.length === 0 ? (
        <EmptyState
          mood="cheer"
          title="Your quest board is clear."
          body="Add one, or see what is next on your roadmap."
          action={
            <Row>
              <Button compact title="Add a quest" onPress={() => router.push('/task-form')} />
              <Button compact kind="secondary" title="View roadmap" onPress={() => router.push('/roadmap')} />
            </Row>
          }
        />
      ) : (
        <View style={{ gap: space.sm }}>
          {due.slice(0, 3).map((item) => (
            <QuestRow key={item.occurrence.id} item={item} today={today} />
          ))}
        </View>
      )}
      {due.length > 0 && <Button kind="secondary" title={due.length > 3 ? `See all quests (${due.length})` : 'See all quests'} onPress={() => router.push('/quests')} />}

      {(next || side) && <SectionLabel>Coming up</SectionLabel>}
      {next && (
        <Pressable onPress={() => router.push({ pathname: '/goal/[id]', params: { id: next.goal.id } })} accessibilityRole="button">
          <Card tone="lavender">
            <Row gap={space.md}>
              <IconTile icon="flag-outline" bg={p.surface} color={p.forest} size={40} />
              <View style={{ flex: 1 }}>
                <T kind="meta" color={p.ink}>
                  Next milestone · {next.goal.title}
                </T>
                <T kind="bodyStrong">{next.milestone.title}</T>
              </View>
              {next.milestone.dueAt && <T kind="meta">{formatFriendly(next.milestone.dueAt, today)}</T>}
            </Row>
          </Card>
        </Pressable>
      )}
      {side && (
        <Pressable onPress={() => router.push({ pathname: '/quests', params: { view: 'side' } })} accessibilityRole="button">
          <Card tone={side.overdue ? 'rose' : 'peach'}>
            <Row gap={space.md}>
              <IconTile icon="home-outline" bg={p.surface} color={p.forest} size={40} />
              <View style={{ flex: 1 }}>
                <T kind="meta" color={side.overdue ? p.roseInk : p.ink}>
                  {side.overdue ? 'Side quest · a little behind schedule' : 'Side quest'}
                </T>
                <T kind="bodyStrong">{side.task.title}</T>
              </View>
              <T kind="meta">{formatFriendly(side.occurrence.scheduledFor, today)}</T>
            </Row>
          </Card>
        </Pressable>
      )}
    </Screen>
  );
}
