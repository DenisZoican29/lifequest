/// <reference types="node" />
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { afterAll, describe } from 'vitest';

import { SqliteRepository, type SqlDatabase, type SqlRunner, type SqlValue } from '../src/data/sqlite-repository';
import { repositoryContract } from './repository-contract';

const opened: DatabaseSync[] = [];

/**
 * Node's built-in SQLite behind the same async interface expo-sqlite exposes.
 * Exclusive transactions are queued, like expo-sqlite's exclusive lock.
 */
function nodeSqlite(path: string): SqlDatabase {
  const db = new DatabaseSync(path);
  opened.push(db);
  const runner: SqlRunner = {
    async execAsync(sql) {
      db.exec(sql);
    },
    async runAsync(sql, params: SqlValue[]) {
      return db.prepare(sql).run(...params);
    },
    async getAllAsync<T>(sql: string, params: SqlValue[]) {
      return db.prepare(sql).all(...params) as T[];
    },
  };
  let queue: Promise<unknown> = Promise.resolve();
  return {
    ...runner,
    withExclusiveTransactionAsync(task) {
      const run = queue.then(async () => {
        db.exec('BEGIN EXCLUSIVE');
        try {
          await task(runner);
          db.exec('COMMIT');
        } catch (e) {
          db.exec('ROLLBACK');
          throw e;
        }
      });
      queue = run.catch(() => undefined);
      return run;
    },
  };
}

const dir = mkdtempSync(join(tmpdir(), 'lifequest-sqlite-'));
let n = 0;
afterAll(() => {
  // Windows keeps the files locked until every handle is closed.
  for (const db of opened) if (db.isOpen) db.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('SqliteRepository (iPhone / Android)', () => {
  repositoryContract(
    () => new SqliteRepository(async () => nodeSqlite(':memory:')),
    () => {
      const file = join(dir, `persist-${n++}.db`);
      return () => new SqliteRepository(async () => nodeSqlite(file));
    },
  );
});
