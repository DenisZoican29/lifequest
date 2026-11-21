import { expect, it } from 'vitest';

import type { Repository } from '../src/data/repository';
import { completeOccurrence, completeOnboarding, createTask, logMockUsage, purchaseTime, setTheme } from '../src/domain/commands';
import { coinBalance } from '../src/domain/economy';
import { clockAt } from './helpers';

/**
 * Behaviour every storage adapter must share (IndexedDB in the browser, SQLite on phones).
 * `persistent()` returns a factory whose repositories all read and write the same underlying store,
 * so a second instance simulates closing and reopening the app.
 */
export function repositoryContract(fresh: () => Repository, persistent: () => () => Repository) {
  it('T-07: data survives reopening the app', async () => {
    const open = persistent();
    const repo = open();
    let s = await repo.load();
    await repo.commit(completeOnboarding(s, clockAt(s), [{ appRef: 'mock:x', label: 'X' }], 20));
    s = await repo.load();
    await repo.commit(setTheme(s, clockAt(s), 'light'));
    s = await repo.load();
    await repo.commit(createTask(s, clockAt(s), { title: 'T', description: '', taskType: 'main', rewardCoins: 40, dueAt: '2026-11-16' }));
    s = await repo.load();
    await repo.commit(completeOccurrence(s, clockAt(s), s.occurrences[0].id));
    s = await repo.load();
    await repo.commit(purchaseTime(s, clockAt(s), 'pack-15', 'i1'));
    s = await repo.load();
    await repo.commit(logMockUsage(s, clockAt(s), 'mock:x', 5).changes);

    const reopened = await open().load();
    expect(reopened.settings).toMatchObject({ onboarded: true, baseDailyMinutes: 20, theme: 'light' });
    expect(reopened.tasks).toHaveLength(1);
    expect(reopened.occurrences.filter((o) => o.status === 'completed')).toHaveLength(1);
    expect(coinBalance(reopened.wallet)).toBe(15);
    expect(reopened.purchases).toHaveLength(1);
    expect(reopened.usage).toHaveLength(1);
    expect(reopened.apps).toHaveLength(1);
  });

  it('guards run inside the transaction: concurrent double-complete credits once', async () => {
    const repo = fresh();
    let s = await repo.load();
    await repo.commit(createTask(s, clockAt(s), { title: 'T', description: '', taskType: 'main', rewardCoins: 10, dueAt: '2026-11-16' }));
    s = await repo.load();
    const cs = completeOccurrence(s, clockAt(s), s.occurrences[0].id);
    const results = await Promise.allSettled([repo.commit(cs), repo.commit(cs)]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(coinBalance((await repo.load()).wallet)).toBe(10);
  });

  it('a failed guard leaves the store unchanged', async () => {
    const repo = fresh();
    let s = await repo.load();
    await repo.commit(createTask(s, clockAt(s), { title: 'T', description: '', taskType: 'main', rewardCoins: 30, dueAt: '2026-11-16' }));
    s = await repo.load();
    await repo.commit(completeOccurrence(s, clockAt(s), s.occurrences[0].id));
    s = await repo.load();
    const a = purchaseTime(s, clockAt(s), 'pack-15', 'a');
    const b = purchaseTime(s, clockAt(s), 'pack-15', 'b');
    await repo.commit(a);
    await expect(repo.commit(b)).rejects.toThrow(/need 25 coins/);
    const after = await repo.load();
    expect(after.purchases).toHaveLength(1);
    expect(coinBalance(after.wallet)).toBe(5);
  });

  it('a reused idempotency key is rejected even without a guard', async () => {
    const repo = fresh();
    let s = await repo.load();
    await repo.commit(createTask(s, clockAt(s), { title: 'T', description: '', taskType: 'main', rewardCoins: 10, dueAt: '2026-11-16' }));
    s = await repo.load();
    const cs = completeOccurrence(s, clockAt(s), s.occurrences[0].id);
    await repo.commit(cs);
    // Same reward row under a new id: only the UNIQUE key can stop it.
    const replay = { ...cs, guards: [], put: { wallet: cs.put.wallet!.map((t) => ({ ...t, id: 'other-id' })) } };
    await expect(repo.commit(replay)).rejects.toThrow(/already applied/);
    expect(coinBalance((await repo.load()).wallet)).toBe(10);
  });

  it('clear() erases everything', async () => {
    const repo = fresh();
    let s = await repo.load();
    await repo.commit(createTask(s, clockAt(s), { title: 'T', description: '', taskType: 'main', rewardCoins: 10, dueAt: '2026-11-16' }));
    await repo.clear();
    s = await repo.load();
    expect(s.tasks).toHaveLength(0);
    expect(s.settings.onboarded).toBe(false);
  });
}
