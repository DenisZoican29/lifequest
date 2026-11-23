import { describe, expect, it } from 'vitest';

import { completeOccurrence, createTask, shiftDays, type TaskInput } from '../src/domain/commands';
import { addPeriod } from '../src/domain/dates';
import { todayProgress } from '../src/domain/selectors';
import type { RecurrenceRule, TaskType } from '../src/domain/types';
import { world } from './helpers';

// Addendum A4 §2, Today progress ring. The test clock starts on Monday 16 Nov 2026.
type W = ReturnType<typeof world>;
const DAILY: RecurrenceRule = { frequency: 'day', interval: 1, anchorPolicy: 'completion' };

function quest(w: W, title: string, taskType: TaskType = 'main', extra: Partial<TaskInput> = {}) {
  w.run((s, c) => createTask(s, c, { title, description: '', taskType, rewardCoins: 5, dueAt: c.today(), ...extra }));
  return w.s.tasks.find((t) => t.title === title)!.id;
}
const log = (w: W, id: string) =>
  w.run((s, c) => completeOccurrence(s, c, s.occurrences.find((o) => o.taskDefinitionId === id && o.status === 'open')!.id));
const ring = (w: W, type: TaskType = 'main') => todayProgress(w.s, w.clock.today(), type);

describe('today progress ring', () => {
  it('counts distinct quests: zero, partial, full', () => {
    const w = world();
    const a = quest(w, 'Eat breakfast', 'main', { recurrence: DAILY });
    const b = quest(w, 'Study 30 minutes');
    quest(w, 'Walk 30 minutes', 'main', { recurrence: DAILY });
    expect(ring(w)).toEqual({ logged: 0, total: 3, left: 3 });
    log(w, a);
    expect(ring(w)).toEqual({ logged: 1, total: 3, left: 2 });
    log(w, b);
    expect(ring(w).logged).toBe(2);
  });

  it('the first log of a quota quest advances the ring once; more logs do not', () => {
    const w = world();
    const water = quest(w, 'Drink water', 'main', { recurrence: { frequency: 'day', interval: 1, anchorPolicy: 'calendar', timesPerPeriod: 3 } });
    quest(w, 'Read 20 minutes', 'main', { recurrence: DAILY });
    log(w, water);
    expect(ring(w)).toEqual({ logged: 1, total: 2, left: 1 });
    log(w, water);
    log(w, water); // target met: it leaves the list but stays counted
    expect(ring(w)).toEqual({ logged: 1, total: 2, left: 1 });
  });

  it('counts only the selected tab type, and ignores quests due later', () => {
    const w = world();
    quest(w, 'Study 30 minutes');
    const oven = quest(w, 'Clean the oven', 'side');
    quest(w, 'Renew passport', 'side', { dueAt: addPeriod(w.clock.today(), 'day', 10) });
    log(w, oven);
    expect(ring(w, 'main')).toEqual({ logged: 0, total: 1, left: 1 });
    expect(ring(w, 'side')).toEqual({ logged: 1, total: 1, left: 0 });
  });

  it('overdue quests count as available; a new day starts from zero', () => {
    const w = world();
    quest(w, 'Pay the bill', 'side');
    const daily = quest(w, 'Water plants', 'side', { recurrence: DAILY });
    log(w, daily);
    w.run((s, c) => shiftDays(s, c, 1));
    expect(ring(w, 'side')).toEqual({ logged: 0, total: 2, left: 2 });
  });

  it('a quest logged early today counts even though it was due later', () => {
    const w = world();
    const early = quest(w, 'Book a dentist', 'main', { dueAt: addPeriod(w.clock.today(), 'day', 5) });
    expect(ring(w).total).toBe(0);
    log(w, early);
    expect(ring(w)).toEqual({ logged: 1, total: 1, left: 0 });
  });
});
