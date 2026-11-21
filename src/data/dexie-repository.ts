import { Dexie, type Table } from 'dexie';

import type {
  AppSelection,
  ChangeSet,
  Goal,
  Milestone,
  Settings,
  Snapshot,
  TaskDefinition,
  TaskOccurrence,
  TimePurchase,
  UsageEvent,
  WalletTransaction,
} from '../domain/types';
import { emptySnapshot } from '../domain/types';
import { DomainError } from '../domain/commands';
import { guardError, TABLES, type Repository } from './repository';

class LifeQuestDB extends Dexie {
  settings!: Table<Settings, string>;
  goals!: Table<Goal, string>;
  milestones!: Table<Milestone, string>;
  tasks!: Table<TaskDefinition, string>;
  occurrences!: Table<TaskOccurrence, string>;
  wallet!: Table<WalletTransaction, string>;
  purchases!: Table<TimePurchase, string>;
  apps!: Table<AppSelection, string>;
  usage!: Table<UsageEvent, string>;

  constructor(name: string) {
    super(name);
    // Schema v1. Add new versions (with upgrade functions) instead of editing this one.
    this.version(1).stores({
      settings: 'id',
      goals: 'id, status',
      milestones: 'id, goalId',
      tasks: 'id, taskType',
      occurrences: 'id, taskDefinitionId, status',
      wallet: 'id, &idempotencyKey',
      purchases: 'id, effectiveLocalDate',
      apps: 'id, &appRef',
      usage: 'id, localDate',
    });
  }
}

/** IndexedDB persistence for the browser POC. */
export class DexieRepository implements Repository {
  readonly durable = true;
  private db: LifeQuestDB;

  constructor(name = 'lifequest') {
    this.db = new LifeQuestDB(name);
  }

  async load(): Promise<Snapshot> {
    const db = this.db;
    return db.transaction('r', TABLES.map((t) => db.table(t)), async () => {
      const base = emptySnapshot();
      const settings = await db.settings.get('main');
      return {
        settings: settings ? { ...base.settings, ...settings } : base.settings,
        goals: await db.goals.toArray(),
        milestones: await db.milestones.toArray(),
        tasks: await db.tasks.toArray(),
        occurrences: await db.occurrences.toArray(),
        wallet: await db.wallet.toArray(),
        purchases: await db.purchases.toArray(),
        apps: await db.apps.toArray(),
        usage: await db.usage.toArray(),
      };
    });
  }

  async commit(cs: ChangeSet): Promise<void> {
    const db = this.db;
    try {
      await db.transaction('rw', TABLES.map((t) => db.table(t)), async () => {
        for (const g of cs.guards) {
          let ok = true;
          if (g.kind === 'minBalance') {
            let balance = 0;
            await db.wallet.each((t) => {
              balance += t.coinDelta;
            });
            ok = balance >= g.coins;
          } else if (g.kind === 'occurrenceOpen') {
            ok = (await db.occurrences.get(g.occurrenceId))?.status === 'open';
          } else {
            ok = (await db.wallet.where('idempotencyKey').equals(g.key).count()) === 0;
          }
          if (!ok) throw guardError(g);
        }
        for (const table of TABLES) {
          const dels = cs.delete[table];
          if (dels?.length) await db.table(table).bulkDelete(dels);
          const puts = cs.put[table];
          if (puts?.length) await db.table(table).bulkPut(puts);
        }
      });
    } catch (e) {
      if (e instanceof DomainError) throw e;
      // The unique index on idempotencyKey is the last line of defence against duplicates.
      // bulkPut wraps the index violation in a BulkError, so check its inner failures too.
      const failures = (e as { failures?: unknown[] })?.failures ?? [];
      const isConstraint = (x: unknown) => x instanceof Dexie.ConstraintError || (x as Error)?.name === 'ConstraintError';
      if (isConstraint(e) || failures.some(isConstraint)) {
        throw new DomainError('duplicate', 'This was already applied.');
      }
      throw e;
    }
  }

  async clear(): Promise<void> {
    const db = this.db;
    await db.transaction('rw', TABLES.map((t) => db.table(t)), async () => {
      for (const t of TABLES) await db.table(t).clear();
    });
  }
}
