import { describe, expect, it } from 'vitest';

import {
  completeOccurrence,
  completeOnboarding,
  createTask,
  forceExhaust,
  logMockUsage,
  purchaseTime,
  setSelectedApps,
  shiftDays,
} from '../src/domain/commands';
import { allowanceFor, coinBalance, computeDayAllowance } from '../src/domain/economy';
import { applyChangeSet } from '../src/data/repository';
import { world } from './helpers';

const APPS = [
  { appRef: 'mock:instagram', label: 'Instagram' },
  { appRef: 'mock:youtube', label: 'YouTube' },
  { appRef: 'mock:tiktok', label: 'TikTok' },
];

function setup(coinsReward = 50) {
  const w = world();
  w.run((s, c) => completeOnboarding(s, c, APPS, 30));
  w.run((s, c) =>
    createTask(s, c, { title: 'Study', description: '', taskType: 'main', rewardCoins: coinsReward, dueAt: c.today() }),
  );
  return w;
}

const openOcc = (w: ReturnType<typeof world>) => w.s.occurrences.find((o) => o.status === 'open')!;

describe('allowance calculation', () => {
  it('matches the spec example: 30 base + 15 bought, 30 used', () => {
    const day = computeDayAllowance(
      30,
      [{ id: 'p', offerId: 'x', coinsSpent: 25, minutesGranted: 15, effectiveLocalDate: '2026-11-16', walletTransactionId: 't', createdAt: '' }],
      [{ id: 'u', platform: 'web-mock', appRef: 'a', localDate: '2026-11-16', durationMinutes: 30, simulationFlag: true, createdAt: '' }],
      '2026-11-16',
    );
    expect(day).toMatchObject({ totalMinutes: 45, usedMinutes: 30, remainingMinutes: 15, blocked: false });
  });

  it('never goes below zero and ignores other days', () => {
    const day = computeDayAllowance(
      10,
      [],
      [
        { id: 'u1', platform: 'web-mock', appRef: 'a', localDate: '2026-11-16', durationMinutes: 25, simulationFlag: true, createdAt: '' },
        { id: 'u2', platform: 'web-mock', appRef: 'a', localDate: '2026-11-15', durationMinutes: 99, simulationFlag: true, createdAt: '' },
      ],
      '2026-11-16',
    );
    expect(day.remainingMinutes).toBe(0);
    expect(day.blocked).toBe(true);
    expect(day.usedMinutes).toBe(25);
  });
});

describe('coins', () => {
  it('T-01: completing the same occurrence twice grants coins once', () => {
    const w = setup();
    const occ = openOcc(w);
    const cs = completeOccurrence(w.s, w.clock, occ.id);
    w.run(() => cs);
    expect(coinBalance(w.s.wallet)).toBe(50);
    // A stale second click replays the same change set: guards reject it.
    expect(() => applyChangeSet(w.s, cs)).toThrow(/already/);
    // A fresh attempt is rejected by the command itself.
    expect(() => completeOccurrence(w.s, w.clock, occ.id)).toThrow(/already done/);
    expect(coinBalance(w.s.wallet)).toBe(50);
  });

  it('task completion never adds minutes automatically', () => {
    const w = setup();
    w.run((s, c) => completeOccurrence(s, c, openOcc(w).id));
    expect(allowanceFor(w.s, w.clock.today()).totalMinutes).toBe(30);
    expect(w.s.purchases).toHaveLength(0);
  });

  it('T-04: insufficient funds fails and changes nothing', () => {
    const w = setup(10);
    w.run((s, c) => completeOccurrence(s, c, openOcc(w).id));
    const before = w.s;
    expect(() => purchaseTime(w.s, w.clock, 'pack-15', 'intent-1')).toThrow(/need 25 coins/);
    expect(w.s).toBe(before);
    expect(coinBalance(w.s.wallet)).toBe(10);
  });

  it('minBalance guard rejects two purchases planned against the same stale balance', () => {
    const w = setup(30);
    w.run((s, c) => completeOccurrence(s, c, openOcc(w).id));
    const a = purchaseTime(w.s, w.clock, 'pack-15', 'intent-a');
    const b = purchaseTime(w.s, w.clock, 'pack-15', 'intent-b');
    w.run(() => a);
    expect(() => applyChangeSet(w.s, b)).toThrow(/need 25 coins/);
    expect(coinBalance(w.s.wallet)).toBe(5);
  });
});

describe('shared allowance and mock blocking', () => {
  it('T-05: usage across apps shares one budget and blocks all apps at zero', () => {
    const w = setup();
    w.run((s, c) => logMockUsage(s, c, 'mock:instagram', 15).changes);
    w.run((s, c) => logMockUsage(s, c, 'mock:tiktok', 10).changes);
    const r = logMockUsage(w.s, w.clock, 'mock:youtube', 15);
    expect(r.recorded).toBe(5); // clamped to what is left
    w.run(() => r.changes);
    const day = allowanceFor(w.s, w.clock.today());
    expect(day).toMatchObject({ usedMinutes: 30, remainingMinutes: 0, blocked: true });
    expect(day.perApp).toEqual({ 'mock:instagram': 15, 'mock:tiktok': 10, 'mock:youtube': 5 });
    for (const app of APPS) expect(() => logMockUsage(w.s, w.clock, app.appRef, 1)).toThrow(/blocked/);
  });

  it('T-06: buying time after a block debits once and unblocks', () => {
    const w = setup();
    w.run((s, c) => completeOccurrence(s, c, openOcc(w).id));
    w.run((s, c) => forceExhaust(s, c));
    expect(allowanceFor(w.s, w.clock.today()).blocked).toBe(true);

    const cs = purchaseTime(w.s, w.clock, 'pack-15', 'intent-1');
    w.run(() => cs);
    expect(() => applyChangeSet(w.s, cs)).toThrow(/already applied/); // double submit
    expect(() => purchaseTime(w.s, w.clock, 'pack-15', 'intent-1')).toThrow(/already made/);

    expect(coinBalance(w.s.wallet)).toBe(25);
    expect(w.s.purchases).toHaveLength(1);
    const day = allowanceFor(w.s, w.clock.today());
    expect(day).toMatchObject({ totalMinutes: 45, remainingMinutes: 15, blocked: false });
  });

  it('T-08: next day refreshes the free allowance, keeps coins, and drops yesterday\'s purchase', () => {
    const w = setup();
    w.run((s, c) => completeOccurrence(s, c, openOcc(w).id));
    w.run((s, c) => purchaseTime(s, c, 'pack-15', 'i'));
    w.run((s, c) => forceExhaust(s, c));
    w.run((s, c) => shiftDays(s, c, 1));
    expect(w.clock.today()).toBe('2026-11-17');
    expect(allowanceFor(w.s, w.clock.today())).toMatchObject({ totalMinutes: 30, remainingMinutes: 30, blocked: false });
    expect(coinBalance(w.s.wallet)).toBe(25);
  });

  it('T-09: deselected apps keep today\'s usage counted and cannot log more', () => {
    const w = setup();
    w.run((s, c) => logMockUsage(s, c, 'mock:tiktok', 20).changes);
    w.run((s, c) => setSelectedApps(s, c, APPS.filter((a) => a.appRef !== 'mock:tiktok')));
    expect(allowanceFor(w.s, w.clock.today()).remainingMinutes).toBe(10);
    expect(() => logMockUsage(w.s, w.clock, 'mock:tiktok', 1)).toThrow(/not in your restricted list/);
    // Re-selecting re-enables the same record instead of duplicating it.
    w.run((s, c) => setSelectedApps(s, c, APPS));
    expect(w.s.apps.filter((a) => a.appRef === 'mock:tiktok')).toHaveLength(1);
    expect(w.s.apps.every((a) => a.enabled)).toBe(true);
  });
});
