import { DomainError } from '../domain/commands';
import type { ChangeSet, Snapshot, TableName } from '../domain/types';
import { emptySnapshot } from '../domain/types';
import { guardError, TABLES, type Repository } from './repository';

export type SqlValue = string | number | null;

/** The slice of expo-sqlite's SQLiteDatabase we use, so the adapter can be tested with any SQLite driver. */
export interface SqlRunner {
  execAsync(source: string): Promise<void>;
  runAsync(source: string, params: SqlValue[]): Promise<unknown>;
  getAllAsync<T>(source: string, params: SqlValue[]): Promise<T[]>;
}

export interface SqlDatabase extends SqlRunner {
  /** All queries inside `task` must go through `txn`; a throw rolls everything back. */
  withExclusiveTransactionAsync(task: (txn: SqlRunner) => Promise<void>): Promise<void>;
}

/**
 * Each record is stored as JSON in `data`, plus a few real columns the guards need:
 * occurrence status, wallet coin delta and a UNIQUE idempotency key.
 * Bump SCHEMA_VERSION and add a step in `migrate` for any future change.
 */
const SCHEMA_VERSION = 1;

const EXTRA_COLUMNS: Partial<Record<TableName, { name: string; ddl: string; value: (row: Record<string, unknown>) => SqlValue }[]>> = {
  occurrences: [{ name: 'status', ddl: 'status TEXT NOT NULL', value: (r) => String(r.status) }],
  wallet: [
    { name: 'coin_delta', ddl: 'coin_delta INTEGER NOT NULL', value: (r) => Number(r.coinDelta) },
    { name: 'idempotency_key', ddl: 'idempotency_key TEXT NOT NULL UNIQUE', value: (r) => String(r.idempotencyKey) },
  ],
};

async function migrate(db: SqlDatabase) {
  const [{ user_version: version }] = await db.getAllAsync<{ user_version: number }>('PRAGMA user_version', []);
  if (version >= SCHEMA_VERSION) return;
  const ddl = TABLES.map((t) => {
    const extra = (EXTRA_COLUMNS[t] ?? []).map((c) => `, ${c.ddl}`).join('');
    return `CREATE TABLE IF NOT EXISTS ${t} (id TEXT PRIMARY KEY NOT NULL, data TEXT NOT NULL${extra});`;
  }).join('\n');
  await db.execAsync(`${ddl}\nPRAGMA user_version = ${SCHEMA_VERSION};`);
}

/** On-device persistence for iPhone / Android (spec §5: SQLite behind the same repository interface). */
export class SqliteRepository implements Repository {
  readonly durable = true;
  private db?: Promise<SqlDatabase>;

  constructor(private readonly open: () => Promise<SqlDatabase>) {}

  private ready(): Promise<SqlDatabase> {
    this.db ??= (async () => {
      const db = await this.open();
      await db.execAsync('PRAGMA journal_mode = WAL;').catch(() => undefined);
      await migrate(db);
      return db;
    })();
    // Let a failed open be retried (e.g. the "Try again" button after a storage error).
    this.db.catch(() => (this.db = undefined));
    return this.db;
  }

  async load(): Promise<Snapshot> {
    const db = await this.ready();
    const base = emptySnapshot();
    const out = { ...base } as Record<string, unknown>;
    for (const t of TABLES) {
      const rows = await db.getAllAsync<{ data: string }>(`SELECT data FROM ${t}`, []);
      const parsed = rows.map((r) => JSON.parse(r.data) as Record<string, unknown>);
      if (t === 'settings') {
        const stored = parsed.find((r) => r.id === 'main');
        out.settings = stored ? { ...base.settings, ...stored } : base.settings;
      } else {
        out[t] = parsed;
      }
    }
    return out as unknown as Snapshot;
  }

  async commit(cs: ChangeSet): Promise<void> {
    const db = await this.ready();
    try {
      await db.withExclusiveTransactionAsync(async (txn) => {
        for (const g of cs.guards) {
          let ok: boolean;
          if (g.kind === 'minBalance') {
            const [r] = await txn.getAllAsync<{ b: number }>('SELECT COALESCE(SUM(coin_delta), 0) AS b FROM wallet', []);
            ok = r.b >= g.coins;
          } else if (g.kind === 'occurrenceOpen') {
            const [r] = await txn.getAllAsync<{ status: string }>('SELECT status FROM occurrences WHERE id = ?', [g.occurrenceId]);
            ok = r?.status === 'open';
          } else {
            const [r] = await txn.getAllAsync<{ n: number }>('SELECT COUNT(*) AS n FROM wallet WHERE idempotency_key = ?', [g.key]);
            ok = r.n === 0;
          }
          if (!ok) throw guardError(g);
        }
        for (const t of TABLES) {
          for (const id of cs.delete[t] ?? []) await txn.runAsync(`DELETE FROM ${t} WHERE id = ?`, [id]);
          const extra = EXTRA_COLUMNS[t] ?? [];
          const cols = ['id', 'data', ...extra.map((c) => c.name)];
          // Upsert on id only: a clash on the UNIQUE idempotency key must fail, never overwrite.
          const sql = `INSERT INTO ${t} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})
            ON CONFLICT(id) DO UPDATE SET ${cols.slice(1).map((c) => `${c} = excluded.${c}`).join(', ')}`;
          for (const row of (cs.put[t] ?? []) as unknown as Record<string, unknown>[]) {
            await txn.runAsync(sql, [String(row.id), JSON.stringify(row), ...extra.map((c) => c.value(row))]);
          }
        }
      });
    } catch (e) {
      if (e instanceof DomainError) throw e;
      if (/UNIQUE constraint failed/i.test(String((e as Error)?.message ?? e))) {
        throw new DomainError('duplicate', 'This was already applied.');
      }
      throw e;
    }
  }

  async clear(): Promise<void> {
    const db = await this.ready();
    await db.withExclusiveTransactionAsync(async (txn) => {
      for (const t of TABLES) await txn.runAsync(`DELETE FROM ${t}`, []);
    });
  }
}
