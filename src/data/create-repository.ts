import { openDatabaseAsync } from 'expo-sqlite';

import type { Repository } from './repository';
import { SqliteRepository, type SqlDatabase } from './sqlite-repository';

/**
 * iPhone / Android: SQLite file on the device, so data survives closing the app.
 * Metro picks `create-repository.web.ts` (IndexedDB) for the browser POC.
 */
export function createRepository(): Repository {
  return new SqliteRepository((): Promise<SqlDatabase> => openDatabaseAsync('lifequest.db'));
}
