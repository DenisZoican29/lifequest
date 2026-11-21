import { applyChangeSet } from '../src/data/repository';
import { createClock, type Clock } from '../src/domain/dates';
import type { ChangeSet, Snapshot } from '../src/domain/types';
import { emptySnapshot } from '../src/domain/types';

/** Fixed "real" time: 16 Nov 2026, 10:00 local. */
export const BASE = () => new Date(2026, 10, 16, 10, 0, 0);

export function clockAt(s: Snapshot): Clock {
  return createClock(s.settings.dayOffset, BASE);
}

/** Tiny harness: run commands against an in-memory snapshot with a fixed clock. */
export function world() {
  let s: Snapshot = emptySnapshot();
  return {
    get s() {
      return s;
    },
    get clock() {
      return clockAt(s);
    },
    run(cmd: (s: Snapshot, c: Clock) => ChangeSet) {
      s = applyChangeSet(s, cmd(s, clockAt(s)));
      return s;
    },
  };
}
