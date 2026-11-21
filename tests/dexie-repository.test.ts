import 'fake-indexeddb/auto';

import { describe } from 'vitest';

import { DexieRepository } from '../src/data/dexie-repository';
import { repositoryContract } from './repository-contract';

let n = 0;

describe('DexieRepository (browser / IndexedDB)', () => {
  repositoryContract(
    () => new DexieRepository(`test-${n++}`),
    () => {
      const name = `persist-${n++}`;
      return () => new DexieRepository(name);
    },
  );
});
