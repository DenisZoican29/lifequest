import { describe, expect, it } from 'vitest';

import { completeOccurrence, createGoal, createTask, setGoalStatus, shiftDays } from '../src/domain/commands';
import { goalShares } from '../src/domain/goal-share';
import type { RecurrenceRule } from '../src/domain/types';
import { world } from './helpers';

type W = ReturnType<typeof world>;
const daily: RecurrenceRule = { frequency: 'day', interval: 1, anchorPolicy: 'calendar' };

function goal(w: W, title: string) {
  w.run((s, c) => createGoal(s, c, { title, description: '', deadline: '2027-06-30' }));
  return w.s.goals.find((g) => g.title === title)!.id;
}

function quest(w: W, title: string, goalId?: string, taskType: 'main' | 'side' = 'main') {
  w.run((s, c) => createTask(s, c, { title, description: '', taskType, goalId, rewardCoins: 10, dueAt: c.today(), recurrence: daily }));
  return w.s.tasks.find((t) => t.title === title)!.id;
}

function log(w: W, taskId: string) {
  w.run((s, c) => completeOccurrence(s, c, s.occurrences.find((o) => o.taskDefinitionId === taskId && o.status === 'open')!.id));
}

const next = (w: W, days = 1) => w.run((s, c) => shiftDays(s, c, days));
const shares = (w: W, range: '4w' | 'all' = '4w') => goalShares(w.s, w.clock.today(), range);

describe('goals overview', () => {
  it('splits quests done between goals, largest first, percentages adding up to 100', () => {
    const w = world();
    const job = goal(w, 'Get a new job');
    const fit = goal(w, 'Get in better shape');
    const cook = goal(w, 'Cook better');
    const a = quest(w, 'Apply', job);
    const b = quest(w, 'Run', fit);
    const c = quest(w, 'Cook', cook);
    for (let i = 0; i < 3; i++) {
      log(w, b);
      if (i < 2) log(w, a);
      if (i < 1) log(w, c);
      next(w);
    }
    const o = shares(w);
    expect(o.total).toBe(6);
    expect(o.parts.map((x) => [x.goal.title, x.done, x.percent])).toEqual([
      ['Get in better shape', 3, 50],
      ['Get a new job', 2, 33],
      ['Cook better', 1, 17],
    ]);
    expect(o.parts.reduce((s, x) => s + x.percent, 0)).toBe(100);
    expect(o.coins).toBe(60);
  });

  it('keeps each goal on its creation-order colour slot whatever the ranking', () => {
    const w = world();
    const first = goal(w, 'First');
    next(w);
    const second = goal(w, 'Second');
    log(w, quest(w, 'Q2', second));
    const o = shares(w);
    expect(o.parts.map((x) => [x.goal.id, x.slot])).toEqual([
      [second, 1],
      [first, 0],
    ]);
  });

  it('shows goals with nothing done at 0%, and nothing at all as 0 total', () => {
    const w = world();
    goal(w, 'Idle');
    const o = shares(w);
    expect(o.total).toBe(0);
    expect(o.parts[0]).toMatchObject({ done: 0, share: 0, percent: 0 });
  });

  it('counts unlinked main quests separately, ignores side quests and archived goals', () => {
    const w = world();
    const g = goal(w, 'Live');
    const old = goal(w, 'Old');
    log(w, quest(w, 'Linked', g));
    log(w, quest(w, 'Archived goal quest', old));
    log(w, quest(w, 'Loose'));
    log(w, quest(w, 'Side', undefined, 'side'));
    w.run((s, c) => setGoalStatus(s, c, old, 'archived'));
    const o = shares(w);
    expect(o.parts.map((x) => x.goal.title)).toEqual(['Live']);
    expect(o.total).toBe(1);
    expect(o.unlinkedDone).toBe(1);
  });

  it('the 4-week range drops older completions; all time keeps them', () => {
    const w = world();
    const g = goal(w, 'Long haul');
    const q = quest(w, 'Daily', g);
    log(w, q);
    next(w, 30);
    log(w, q);
    expect(shares(w, '4w').total).toBe(1);
    expect(shares(w, 'all').total).toBe(2);
  });

  it('the Active view splits only active goals and keeps their colour slots', () => {
    const w = world();
    const done = goal(w, 'Run a 10k');
    next(w); // created a day apart, so creation order is certain
    const job = goal(w, 'Get a new job');
    log(w, quest(w, 'Run', done));
    log(w, quest(w, 'Apply', job));
    w.run((s, c) => setGoalStatus(s, c, done, 'completed'));
    const o = goalShares(w.s, w.clock.today(), '4w', 'active');
    expect(o.parts.map((x) => [x.goal.title, x.slot, x.percent])).toEqual([['Get a new job', 1, 100]]);
    expect(o.total).toBe(1);
    expect(o.unlinkedDone).toBe(0);
  });

  it('counts last 7 days, custom dates (both ends, across a month) and empty periods', () => {
    const w = world(); // Monday 16 Nov 2026
    const g = goal(w, 'Read more');
    const q = quest(w, 'Read', g);
    for (let i = 0; i < 10; i++) {
      log(w, q); // 16..25 Nov
      next(w);
    }
    const today = w.clock.today(); // 26 Nov
    expect(goalShares(w.s, today, '7d').total).toBe(6); // 20..25
    expect(goalShares(w.s, today, { from: '2026-11-18', to: '2026-11-20' }).total).toBe(3);
    expect(goalShares(w.s, today, { from: '2026-11-20', to: '2026-11-18' }).total).toBe(3); // reversed
    expect(goalShares(w.s, today, { from: '2026-11-19', to: '2026-11-19' }).total).toBe(1);
    expect(goalShares(w.s, today, { from: '2026-10-25', to: '2026-11-16' }).total).toBe(1);
    const empty = goalShares(w.s, today, { from: '2026-10-01', to: '2026-10-31' });
    expect([empty.total, empty.from, empty.to]).toEqual([0, '2026-10-01', '2026-10-31']);
  });
});
