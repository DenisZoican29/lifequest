import { create } from 'zustand';

import { createRepository } from '@/data/create-repository';
import type { Repository } from '@/data/repository';
import { DomainError } from '@/domain/commands';
import { createClock, type Clock } from '@/domain/dates';
import { allowanceFor, enabledApps } from '@/domain/economy';
import { emptySnapshot, type ChangeSet, type Snapshot } from '@/domain/types';
import { WebMockAppBlocker, type AppBlocker } from '@/platform/app-blocker';

export type Result<T = void> = { ok: true; value: T } | { ok: false; message: string };

interface AppState {
  ready: boolean;
  loadError?: string;
  snapshot: Snapshot;
  /** Bumped periodically so "today" re-evaluates when midnight passes. */
  tick: number;
  init(): Promise<void>;
  /** Runs a pure command against the latest snapshot and commits it atomically. */
  run<T = void>(command: (s: Snapshot, clock: Clock) => ChangeSet | { changes: ChangeSet; value: T }): Promise<Result<T>>;
  eraseAll(): Promise<void>;
  bumpTick(): void;
}

const repo: Repository = createRepository();
export const appBlocker: AppBlocker = new WebMockAppBlocker();
export const storageIsDurable = repo.durable;

/** Mutations are serialized so each command sees the result of the previous one. */
let queue: Promise<unknown> = Promise.resolve();

export function clockFor(s: Snapshot): Clock {
  return createClock(s.settings.dayOffset);
}

async function syncBlocker(s: Snapshot) {
  const day = allowanceFor(s, clockFor(s).today());
  await appBlocker.refreshRestrictions({
    blocked: day.blocked,
    remainingMinutes: day.remainingMinutes,
    appRefs: enabledApps(s.apps).map((a) => a.appRef),
  });
}

export const useStore = create<AppState>((set, get) => ({
  ready: false,
  snapshot: emptySnapshot(),
  tick: 0,

  async init() {
    try {
      const snapshot = await repo.load();
      await syncBlocker(snapshot);
      set({ snapshot, ready: true, loadError: undefined });
    } catch (e) {
      set({ ready: true, loadError: (e as Error).message ?? 'Could not open local storage.' });
    }
  },

  run(command) {
    const job = queue.then(async () => {
      try {
        const current = get().snapshot;
        const out = command(current, clockFor(current));
        const cs = 'changes' in out ? out.changes : out;
        const value = ('changes' in out ? out.value : undefined) as never;
        await repo.commit(cs);
        const snapshot = await repo.load();
        set({ snapshot });
        await syncBlocker(snapshot);
        return { ok: true as const, value };
      } catch (e) {
        if (e instanceof DomainError) return { ok: false as const, message: e.message };
        console.error('[LifeQuest] command failed', e);
        return { ok: false as const, message: 'Something went wrong while saving. Please try again.' };
      }
    });
    queue = job;
    return job;
  },

  async eraseAll() {
    await (queue = queue.then(async () => {
      await repo.clear();
      const snapshot = await repo.load();
      set({ snapshot });
      await syncBlocker(snapshot);
    }));
  },

  bumpTick() {
    set((s) => ({ tick: s.tick + 1 }));
  },
}));

/** Current simulated local date; re-renders when the date or offset changes. */
export function useToday(): string {
  const offset = useStore((s) => s.snapshot.settings.dayOffset);
  useStore((s) => s.tick);
  return createClock(offset).today();
}
