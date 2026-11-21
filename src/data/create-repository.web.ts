import { DexieRepository } from './dexie-repository';
import type { Repository } from './repository';

export function createRepository(): Repository {
  // Ask the browser not to evict our data under storage pressure (best effort).
  void globalThis.navigator?.storage?.persist?.().catch(() => undefined);
  return new DexieRepository();
}
