import { coinBalance } from '../domain/economy';
import { DomainError } from '../domain/commands';
import type { ChangeSet, Guard, Snapshot, TableName } from '../domain/types';
import { emptySnapshot } from '../domain/types';

/**
 * Storage boundary (spec §6). The browser POC uses IndexedDB; native builds will plug in SQLite.
 * `commit` must apply every write in a ChangeSet atomically and re-check its guards
 * inside the same transaction, so stale UI state can never double-credit or overspend.
 */
export interface Repository {
  load(): Promise<Snapshot>;
  commit(changes: ChangeSet): Promise<void>;
  /** Erases everything (test/reset control). */
  clear(): Promise<void>;
  /** Whether data survives reloads (false for the in-memory fallback). */
  readonly durable: boolean;
}

export const TABLES: TableName[] = [
  'settings',
  'goals',
  'milestones',
  'tasks',
  'occurrences',
  'wallet',
  'purchases',
  'apps',
  'usage',
];

export function guardError(guard: Guard): DomainError {
  switch (guard.kind) {
    case 'minBalance':
      return new DomainError('insufficient-funds', `You need ${guard.coins} coins for this.`);
    case 'occurrenceOpen':
      return new DomainError('already-completed', 'This quest was already completed.');
    case 'uniqueIdempotencyKey':
      return new DomainError('duplicate', 'This was already applied.');
  }
}

export function checkGuard(s: Snapshot, guard: Guard): boolean {
  switch (guard.kind) {
    case 'minBalance':
      return coinBalance(s.wallet) >= guard.coins;
    case 'occurrenceOpen':
      return s.occurrences.find((o) => o.id === guard.occurrenceId)?.status === 'open';
    case 'uniqueIdempotencyKey':
      return !s.wallet.some((t) => t.idempotencyKey === guard.key);
  }
}

/** Pure application of a ChangeSet; throws a DomainError if a guard fails. */
export function applyChangeSet(s: Snapshot, cs: ChangeSet): Snapshot {
  for (const g of cs.guards) if (!checkGuard(s, g)) throw guardError(g);
  const next: Snapshot = { ...s };
  for (const table of TABLES) {
    const puts = cs.put[table] as { id: string }[] | undefined;
    const dels = cs.delete[table];
    if (!puts?.length && !dels?.length) continue;
    if (table === 'settings') {
      if (puts?.length) next.settings = puts[puts.length - 1] as Snapshot['settings'];
      continue;
    }
    const rows = new Map((s[table] as { id: string }[]).map((r) => [r.id, r]));
    for (const id of dels ?? []) rows.delete(id);
    for (const row of puts ?? []) rows.set(row.id, row);
    (next as unknown as Record<string, unknown>)[table] = [...rows.values()];
  }
  return next;
}

export class MemoryRepository implements Repository {
  readonly durable = false;
  private state: Snapshot = emptySnapshot();
  private queue: Promise<unknown> = Promise.resolve();

  async load() {
    return this.state;
  }

  commit(cs: ChangeSet): Promise<void> {
    const run = this.queue.then(() => {
      this.state = applyChangeSet(this.state, cs);
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  async clear() {
    this.state = emptySnapshot();
  }
}
