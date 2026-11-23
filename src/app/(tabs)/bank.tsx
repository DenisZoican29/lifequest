import { format } from 'date-fns';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import {
  FORCE_EXHAUST_REF,
  forceExhaust,
  logMockUsage,
  purchaseTime,
  resetClock,
  resetTodayUsage,
  shiftDays,
} from '@/domain/commands';
import { allowanceFor, coinBalance, enabledApps, totalEarned, totalSpent } from '@/domain/economy';
import { newId } from '@/domain/ids';
import type { TimeOffer } from '@/domain/types';
import { useStore, useToday, type Result } from '@/state/store';
import { AppIcon } from '@/ui/app-icon';
import { Coin } from '@/ui/art';
import {
  Button,
  Card,
  ConfirmDialog,
  DemoBanner,
  Ionicons,
  ProgressBar,
  Row,
  Screen,
  ScreenHeader,
  SectionLabel,
  StatusChip,
  T,
} from '@/ui/components';
import { font, radius, space, usePalette } from '@/ui/theme';
import { toast } from '@/ui/toast';

function report(res: Result<unknown>, success?: string) {
  if (!res.ok) toast(res.message, 'error');
  else if (success) toast(success);
}

/**
 * Time Bank (addendum A4 §5): minutes left and coins together, then buying time. Simulator and
 * test-clock controls sit under Demo tools, collapsed. Coins never turn into minutes until you buy.
 */
export default function Bank() {
  const p = usePalette();
  const s = useStore((st) => st.snapshot);
  const run = useStore((st) => st.run);
  const today = useToday();
  const day = allowanceFor(s, today);
  const balance = coinBalance(s.wallet);
  const apps = enabledApps(s.apps);

  const [pending, setPending] = useState<{ offer: TimeOffer; intentId: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [showLedger, setShowLedger] = useState(false);
  const [showDemo, setShowDemo] = useState(false);

  const use = async (appRef: string, label: string, minutes: number) => {
    const res = await run((st, c) => {
      const out = logMockUsage(st, c, appRef, minutes);
      return { changes: out.changes, value: out.recorded };
    });
    if (!res.ok) return toast(res.message, 'error');
    toast(res.value < minutes ? 'Free time used up for today.' : `${label}: +${res.value} min (simulated)`, res.value < minutes ? 'error' : 'success');
  };

  const confirmPurchase = async () => {
    if (!pending || busy) return;
    setBusy(true);
    const { offer, intentId } = pending;
    const res = await run((st, c) => purchaseTime(st, c, offer.id, intentId));
    setBusy(false);
    setPending(null);
    report(res, `${offer.minutes} extra minutes added to today.`);
  };

  const otherUsage = Object.entries(day.perApp).filter(([ref]) => !apps.some((a) => a.appRef === ref));
  const ledger = [...s.wallet].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const purchases = [...s.purchases].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <Screen tabs>
      <ScreenHeader title="Time Bank" />

      <Card hero>
        <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <T kind="eyebrow">Today</T>
          <StatusChip tone={day.blocked ? 'overdue' : 'demo'} icon={day.blocked ? 'lock-closed' : 'flask-outline'} label={day.blocked ? 'Apps paused (demo)' : 'Demo mode'} />
        </Row>
        <Row gap={space.xl} style={{ flexWrap: 'wrap', marginTop: space.xs }}>
          <View accessible accessibilityLabel={day.blocked ? 'Free time used up' : `${day.remainingMinutes} minutes of screen time left`}>
            <T kind="title">{day.blocked ? '0 min' : `${day.remainingMinutes} min`}</T>
            <T kind="small">screen time left</T>
          </View>
          <View accessible accessibilityLabel={`${balance} coins`} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <Coin size={34} />
            <View>
              <T kind="title" color={p.goldInk}>
                {balance}
              </T>
              <T kind="small">coins</T>
            </View>
          </View>
        </Row>
        <View style={{ marginTop: space.xs }}>
          <ProgressBar ratio={day.totalMinutes ? day.usedMinutes / day.totalMinutes : 1} color={p.forest} />
        </View>
        <T kind="meta">
          {day.usedMinutes} of {day.totalMinutes} min used ({day.baseMinutes} free{day.purchasedMinutes ? ` + ${day.purchasedMinutes} bought` : ''}) · resets at midnight
        </T>
        <T kind="meta">
          Coins earned {totalEarned(s.wallet)} · spent {totalSpent(s.wallet)}
        </T>
      </Card>

      {apps.length === 0 && (
        <Card tone="cream">
          <T kind="bodyStrong">Screen time isn’t set up yet</T>
          <T kind="small">Pick the apps that share your daily allowance. Until then, your coins wait here.</T>
          <Button compact title="Set up screen time" onPress={() => router.push('/settings')} />
        </Card>
      )}

      <SectionLabel>Buy extra time</SectionLabel>
      <T kind="small">Bought minutes are for today only and expire at midnight. You confirm every purchase.</T>
      <View style={{ gap: space.sm }}>
        {s.settings.offers.map((o) => {
          const short = o.coins - balance;
          return (
            <View key={o.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: p.surface, borderColor: p.border, borderWidth: 1, borderRadius: radius.md + 2, paddingVertical: space.md, paddingLeft: space.lg, paddingRight: space.md }}>
              <View style={{ flex: 1 }}>
                <T kind="h2">+{o.minutes} min</T>
                <T kind="meta">{short > 0 ? `${short} more coins needed` : 'Shared across selected apps'}</T>
              </View>
              <Button
                compact
                kind="secondary"
                title={`${o.coins} coins`}
                accessibilityLabel={`Buy ${o.minutes} minutes for ${o.coins} coins`}
                disabled={short > 0}
                onPress={() => setPending({ offer: o, intentId: newId() })}
                style={{ minWidth: 104 }}
              />
            </View>
          );
        })}
      </View>

      <Pressable
        onPress={() => router.push('/settings')}
        accessibilityRole="button"
        style={{ backgroundColor: p.surface, borderColor: p.border, borderWidth: 1, borderRadius: radius.md + 2, minHeight: 50, alignItems: 'center', justifyContent: 'center' }}>
        <T kind="small" color={p.ink}>
          {apps.length} app{apps.length === 1 ? '' : 's'} selected · <T kind="small" color={p.forest} style={{ fontFamily: font.bold }}>Manage</T>
        </T>
      </Pressable>

      <SectionLabel>Demo tools</SectionLabel>
      <DemoBanner />
      <Pressable
        onPress={() => setShowDemo((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: showDemo }}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm, opacity: pressed ? 0.7 : 1 })}>
        <Ionicons name={showDemo ? 'chevron-down' : 'chevron-forward'} size={18} color={p.forest} />
        <T kind="bodyStrong" color={p.forest}>
          {showDemo ? 'Hide demo tools' : 'Show demo tools'}
        </T>
        <T kind="meta">simulate app use, test clock</T>
      </Pressable>
      {showDemo && (
        <>
      <Card>
        {apps.length === 0 && <T kind="muted">No apps selected yet. Choose some under Manage.</T>}
        {apps.map((a, i) => (
          <View key={a.id} style={{ gap: space.sm, paddingVertical: space.sm, borderTopWidth: i ? 1 : 0, borderTopColor: p.border }}>
            <Row gap={space.md}>
              <AppIcon appRef={a.appRef} label={a.label} size={38} locked={day.blocked} />
              <View style={{ flex: 1 }}>
                <T kind="bodyStrong">{a.label}</T>
                <T kind="meta">{day.perApp[a.appRef] ?? 0} min used today</T>
              </View>
              <StatusChip tone={day.blocked ? 'overdue' : 'done'} label={day.blocked ? 'Paused' : 'Open'} />
            </Row>
            <Row gap={space.sm}>
              {[1, 5, 15].map((m) => (
                <Button
                  key={m}
                  compact
                  kind="tertiary"
                  title={`+${m} min`}
                  accessibilityLabel={`Simulate ${m} minutes in ${a.label}`}
                  disabled={day.blocked}
                  onPress={() => use(a.appRef, a.label, m)}
                  style={{ flex: 1 }}
                />
              ))}
            </Row>
          </View>
        ))}
        {otherUsage.map(([ref, minutes]) => (
          <T key={ref} kind="meta">
            {ref === FORCE_EXHAUST_REF ? 'Forced exhaust (test)' : `${s.apps.find((x) => x.appRef === ref)?.label ?? 'Removed app'} (no longer selected)`}: {minutes} min
          </T>
        ))}
      </Card>
      <Card tone="sky">
        <T kind="small" color={p.ink}>
          Test helpers. Your PC clock is not changed.
        </T>
        <Row gap={space.sm} style={{ flexWrap: 'wrap' }}>
          <Button compact kind="tertiary" icon="flash-outline" title="Use up today" disabled={day.blocked} onPress={async () => report(await run((st, c) => forceExhaust(st, c)), 'Free time used up for today.')} />
          <Button compact kind="tertiary" icon="refresh" title="Reset usage" onPress={async () => report(await run((st, c) => resetTodayUsage(st, c)), "Today's usage cleared")} />
          <Button compact kind="tertiary" icon="play-skip-forward-outline" title="Next day" onPress={async () => report(await run((st, c) => shiftDays(st, c, 1)), 'Moved to the next simulated day')} />
          <Button compact kind="tertiary" icon="play-skip-back-outline" title="Previous day" onPress={async () => report(await run((st, c) => shiftDays(st, c, -1)))} />
          {s.settings.dayOffset !== 0 && <Button compact kind="ghost" title="Back to real date" onPress={async () => report(await run((st, c) => resetClock(st, c)), 'Back to the real date')} />}
        </Row>
      </Card>
        </>
      )}

      <SectionLabel right={ledger.length > 0 ? <Button compact kind="ghost" title={showLedger ? 'Purchases only' : 'All coin activity'} onPress={() => setShowLedger((v) => !v)} /> : undefined}>
        {showLedger ? 'Coin activity' : 'Purchase history'}
      </SectionLabel>
      <Card>
        {(showLedger ? ledger.length : purchases.length) === 0 ? (
          <T kind="muted">{showLedger ? 'Complete a quest to earn your first coins.' : 'No time packs bought yet.'}</T>
        ) : showLedger ? (
          ledger.slice(0, 30).map((t) => (
            <Row key={t.id} gap={space.md} style={{ paddingVertical: 6 }}>
              <Ionicons name={t.coinDelta >= 0 ? 'arrow-down-circle-outline' : 'arrow-up-circle-outline'} size={22} color={t.coinDelta >= 0 ? p.forest : p.muted} />
              <View style={{ flex: 1 }}>
                <T kind="small" color={p.ink} numberOfLines={1}>
                  {t.reason}
                </T>
                <T kind="meta">{format(new Date(t.createdAt), 'd MMM, HH:mm')}</T>
              </View>
              <T kind="small" color={t.coinDelta >= 0 ? p.forest : p.muted} style={{ fontFamily: font.bold }}>
                {t.coinDelta >= 0 ? '+' : '−'}
                {Math.abs(t.coinDelta)}
              </T>
            </Row>
          ))
        ) : (
          purchases.slice(0, 30).map((pu) => (
            <Row key={pu.id} gap={space.md} style={{ paddingVertical: 6 }}>
              <Ionicons name="time-outline" size={22} color={p.forest} />
              <View style={{ flex: 1 }}>
                <T kind="small" color={p.ink}>
                  +{pu.minutesGranted} min for {pu.effectiveLocalDate === today ? 'today' : pu.effectiveLocalDate}
                </T>
                <T kind="meta">{format(new Date(pu.createdAt), 'd MMM, HH:mm')}</T>
              </View>
              <Row gap={4}>
                <Coin size={16} />
                <T kind="small" color={p.goldInk} style={{ fontFamily: font.bold }}>
                  −{pu.coinsSpent}
                </T>
              </Row>
            </Row>
          ))
        )}
      </Card>

      <ConfirmDialog
        visible={!!pending}
        title={pending ? `Spend ${pending.offer.coins} coins for ${pending.offer.minutes} extra minutes today?` : ''}
        body={pending ? `Balance: ${balance} → ${balance - pending.offer.coins} coins. The minutes are shared across your selected apps.` : undefined}
        confirmLabel="Confirm"
        busy={busy}
        onConfirm={confirmPurchase}
        onCancel={() => !busy && setPending(null)}
      />
    </Screen>
  );
}
