import { describe, expect, it } from 'vitest';

import { archiveTask, completeOccurrence, createGoal, createTask, setGoalStatus, shiftDays } from '../src/domain/commands';
import { goalInsights } from '../src/domain/goal-insights';
import type { RecurrenceRule } from '../src/domain/types';
import { world } from './helpers';

// The test clock starts on Monday 16 Nov 2026.
type W = ReturnType<typeof world>;

const weekly3: RecurrenceRule = { frequency: 'week', interval: 1, anchorPolicy: 'calendar', timesPerPeriod: 3 };
const daily: RecurrenceRule = { frequency: 'day', interval: 1, anchorPolicy: 'calendar' };

function setup(deadline = '2027-06-30') {
  const w = world();
  w.run((s, c) => createGoal(s, c, { title: 'Get in better shape', description: '', deadline }));
  return { w, goalId: w.s.goals[0].id };
}

function addQuest(w: W, goalId: string, title: string, recurrence?: RecurrenceRule, rewardCoins = 10) {
  w.run((s, c) => createTask(s, c, { title, description: '', taskType: 'main', goalId, rewardCoins, dueAt: c.today(), recurrence }));
  return w.s.tasks.find((t) => t.title === title)!.id;
}

/** Logs/ticks the open occurrence of a quest `times` times today. */
function log(w: W, taskId: string, times = 1) {
  for (let i = 0; i < times; i++) {
    w.run((s, c) => completeOccurrence(s, c, s.occurrences.find((o) => o.taskDefinitionId === taskId && o.status === 'open')!.id));
  }
}

const next = (w: W, days = 1) => w.run((s, c) => shiftDays(s, c, days));
const insights = (w: W, goalId: string) => goalInsights(w.s, w.s.goals.find((g) => g.id === goalId)!, w.clock.today());

describe('goal status', () => {
  it('a goal without quests asks for one', () => {
    const { w, goalId } = setup();
    expect(insights(w, goalId)).toMatchObject({ health: 'no-quests', consistency: null, daysLeft: 226 });
  });

  it('a new quest is "getting started" until something is due, with no penalty for the week in progress', () => {
    const { w, goalId } = setup();
    addQuest(w, goalId, 'Gym', weekly3);
    expect(insights(w, goalId)).toMatchObject({ health: 'getting-started', consistency: null });
    next(w, 3); // Thursday, nothing done yet, still possible
    expect(insights(w, goalId).health).toBe('getting-started');
  });

  it('keeping the week counts straight away and starts a streak', () => {
    const { w, goalId } = setup();
    const gym = addQuest(w, goalId, 'Gym', weekly3);
    log(w, gym, 3);
    const i = insights(w, goalId);
    expect(i).toMatchObject({ health: 'on-track', consistency: 1, streak: 1, totalDone: 3, activeDays: 1, coinsEarned: 30 });
    expect(i.weeks.at(-1)).toMatchObject({ ratio: 1, kept: 3, planned: 3, current: true });
    expect(i.weeks).toHaveLength(6); // a new goal still gets a readable chart
  });

  it('missed weeks pull the goal down and break the streak', () => {
    const { w, goalId } = setup();
    const gym = addQuest(w, goalId, 'Gym', weekly3);
    log(w, gym, 3);
    next(w, 7);
    log(w, gym, 1); // week 2: 1 of 3
    next(w, 7);
    next(w, 7); // week 3: 0 of 3; now in week 4
    const i = insights(w, goalId);
    expect(i.consistency).toBeCloseTo(4 / 9);
    expect(i).toMatchObject({ health: 'falling-behind', streak: 0, bestStreak: 1 });
  });

  it('a week that can no longer be kept counts as missed before it ends', () => {
    const { w, goalId } = setup();
    const gym = addQuest(w, goalId, 'Gym', weekly3);
    log(w, gym, 3);
    next(w, 13); // Sunday of week 2, 0 of 3 done, only 1 day left
    expect(insights(w, goalId).weeks.at(-1)).toMatchObject({ ratio: 0, planned: 3, current: true });
  });

  it('a quest started mid-week is not judged on that first partial week', () => {
    const { w, goalId } = setup();
    next(w, 5); // Saturday
    addQuest(w, goalId, 'Gym', weekly3);
    next(w, 2); // Monday
    expect(insights(w, goalId)).toMatchObject({ health: 'getting-started', consistency: null });
  });

  it('a daily quest kept 5 of 7 days needs a push; each quest weighs the same', () => {
    const { w, goalId } = setup();
    const walk = addQuest(w, goalId, 'Walk', daily);
    for (let d = 0; d < 14; d++) {
      if (d % 7 < 5) log(w, walk);
      next(w);
    }
    let i = insights(w, goalId);
    expect(i.consistency).toBeCloseTo(10 / 14);
    expect(i.health).toBe('needs-push');

    // Water 8× a day, always done: averaged per quest, not per glass.
    const water = addQuest(w, goalId, 'Water', { ...daily, timesPerPeriod: 8 });
    log(w, water, 8);
    i = insights(w, goalId);
    expect(i.quests.find((q) => q.task.id === water)?.ratio).toBe(1);
    expect(i.consistency).toBeCloseTo((10 / 14 + 1) / 2);
  });

  it('one-off quests count once due or done', () => {
    const { w, goalId } = setup();
    const cv = addQuest(w, goalId, 'Update CV');
    expect(insights(w, goalId).consistency).toBeNull();
    next(w, 1); // due yesterday, not done
    expect(insights(w, goalId).consistency).toBe(0);
    log(w, cv);
    expect(insights(w, goalId).consistency).toBe(1);
  });

  it('archiving a quest stops it counting against the goal', () => {
    const { w, goalId } = setup();
    const gym = addQuest(w, goalId, 'Gym', weekly3);
    const walk = addQuest(w, goalId, 'Walk', daily);
    next(w, 7);
    w.run((s, c) => archiveTask(s, c, gym));
    log(w, walk);
    next(w, 7);
    const i = insights(w, goalId);
    expect(i.quests.map((q) => q.task.title)).toEqual(['Gym', 'Walk']);
    // Gym: only its first (missed) week counts; nothing after it was archived.
    expect(i.quests[0]).toMatchObject({ kept: 0, planned: 3 });
  });

  it('a passed deadline says so; a reached goal is reached', () => {
    const { w, goalId } = setup('2026-11-20');
    next(w, 5);
    expect(insights(w, goalId)).toMatchObject({ health: 'past-deadline', daysLeft: -1, timeUsed: 1 });
    w.run((s, c) => setGoalStatus(s, c, goalId, 'completed'));
    expect(insights(w, goalId).health).toBe('completed');
  });

  it('time used runs from the start to the deadline', () => {
    const { w, goalId } = setup('2026-12-16'); // 30 days
    next(w, 15);
    expect(insights(w, goalId).timeUsed).toBeCloseTo(0.5);
  });

  it('the activity grid covers 12 Monday-aligned weeks and counts completions per day', () => {
    const { w, goalId } = setup();
    const gym = addQuest(w, goalId, 'Gym', weekly3);
    log(w, gym, 2);
    const { days } = insights(w, goalId);
    expect(days).toHaveLength(84);
    expect(days[0].date).toBe('2026-08-31');
    expect(days.find((d) => d.date === '2026-11-16')).toMatchObject({ count: 2, future: false, beforeStart: false });
    expect(days[0].beforeStart).toBe(true);
    expect(days.at(-1)).toMatchObject({ date: '2026-11-22', future: true });
  });
});

describe('goal validation', () => {
  it('requires a deadline that is not in the past', () => {
    const w = world();
    expect(() => w.run((s, c) => createGoal(s, c, { title: 'G', description: '', deadline: '' }))).toThrow(/deadline/i);
    expect(() => w.run((s, c) => createGoal(s, c, { title: 'G', description: '', deadline: '2026-11-15' }))).toThrow(/today or later/);
  });
});
