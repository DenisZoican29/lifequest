import type { AppSelection, LocalDate, Snapshot, TimePurchase, UsageEvent, WalletTransaction } from './types';

/** Coins: balance = earned + adjustments - spent (spec §3.2). Spends are stored as negative deltas. */
export function coinBalance(wallet: readonly WalletTransaction[]): number {
  return wallet.reduce((sum, t) => sum + t.coinDelta, 0);
}

export function totalEarned(wallet: readonly WalletTransaction[]): number {
  return wallet.filter((t) => t.kind === 'earn').reduce((s, t) => s + t.coinDelta, 0);
}

export function totalSpent(wallet: readonly WalletTransaction[]): number {
  return -wallet.filter((t) => t.kind === 'spend').reduce((s, t) => s + t.coinDelta, 0);
}

export interface DayAllowance {
  date: LocalDate;
  baseMinutes: number;
  purchasedMinutes: number;
  totalMinutes: number;
  usedMinutes: number;
  remainingMinutes: number;
  blocked: boolean;
  /** Minutes used today keyed by appRef. */
  perApp: Record<string, number>;
}

/**
 * One shared budget for every selected app (FR-19).
 * total = base + purchased for that day; remaining = max(0, total - used); blocked when remaining = 0.
 *
 * Selection rule (T-09): usage counts against the day it was recorded, even if the app is
 * later deselected. Deselecting an app stops future usage from being tracked; it never refunds time.
 */
export function computeDayAllowance(
  baseDailyMinutes: number,
  purchases: readonly TimePurchase[],
  usage: readonly UsageEvent[],
  date: LocalDate,
): DayAllowance {
  const purchasedMinutes = purchases
    .filter((p) => p.effectiveLocalDate === date)
    .reduce((s, p) => s + p.minutesGranted, 0);
  const perApp: Record<string, number> = {};
  let usedMinutes = 0;
  for (const u of usage) {
    if (u.localDate !== date) continue;
    usedMinutes += u.durationMinutes;
    perApp[u.appRef] = (perApp[u.appRef] ?? 0) + u.durationMinutes;
  }
  const totalMinutes = baseDailyMinutes + purchasedMinutes;
  const remainingMinutes = Math.max(0, totalMinutes - usedMinutes);
  return {
    date,
    baseMinutes: baseDailyMinutes,
    purchasedMinutes,
    totalMinutes,
    usedMinutes,
    remainingMinutes,
    blocked: remainingMinutes === 0,
    perApp,
  };
}

export function allowanceFor(snapshot: Snapshot, date: LocalDate): DayAllowance {
  return computeDayAllowance(snapshot.settings.baseDailyMinutes, snapshot.purchases, snapshot.usage, date);
}

export function enabledApps(apps: readonly AppSelection[]): AppSelection[] {
  return apps.filter((a) => a.enabled);
}
