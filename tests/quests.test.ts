import { describe, expect, it } from 'vitest';

import {
  addMilestone,
  archiveTask,
  completeOccurrence,
  createGoal,
  createTask,
  restoreTask,
  shiftDays,
  skipOccurrence,
  snoozeOccurrence,
  toggleMilestone,
} from '../src/domain/commands';
import { coinBalance } from '../src/domain/economy';
import { nextDueDate, periodContaining } from '../src/domain/recurrence';
import { collapseQuota, goalProgress, questsCompleted, questsDueToday, questsUpcoming, sideQuests } from '../src/domain/selectors';
import { world } from './helpers';

describe('recurrence', () => {
  const monthly = { frequency: 'month' as const, interval: 2, anchorPolicy: 'completion' as const };
  it('after-completion counts from the completion day', () => {
    expect(nextDueDate(monthly, '2026-01-10', '2026-01-10', '2026-01-20')).toBe('2026-03-20');
  });
  it('calendar keeps the grid and skips missed slots', () => {
    const weekly = { frequency: 'week' as const, interval: 1, anchorPolicy: 'calendar' as const };
    expect(nextDueDate(weekly, '2026-11-02', '2026-11-02', '2026-11-03')).toBe('2026-11-09');
    expect(nextDueDate(weekly, '2026-11-02', '2026-11-02', '2026-11-20')).toBe('2026-11-23');
    // Completed early: still the next slot after the scheduled one.
    expect(nextDueDate(weekly, '2026-11-02', '2026-11-09', '2026-11-05')).toBe('2026-11-16');
  });
  it('calendar monthly does not drift at month end', () => {
    const m = { frequency: 'month' as const, interval: 1, anchorPolicy: 'calendar' as const };
    expect(nextDueDate(m, '2026-01-31', '2026-02-28', '2026-02-28')).toBe('2026-03-31');
  });
});

describe('quests', () => {
  it('T-03: a recurring side quest keeps history and schedules the next occurrence', () => {
    const w = world();
    w.run((s, c) =>
      createTask(s, c, {
        title: 'Clean oven',
        description: '',
        taskType: 'side',
        rewardCoins: 20,
        dueAt: '2026-11-14',
        recurrence: { frequency: 'month', interval: 2, anchorPolicy: 'completion' },
        reminderDaysBefore: 3,
      }),
    );
    const [overdue] = sideQuests(w.s, w.clock.today());
    expect(overdue.overdue).toBe(true);
    w.run((s, c) => completeOccurrence(s, c, overdue.occurrence.id));

    const [next] = sideQuests(w.s, w.clock.today());
    expect(next.occurrence.scheduledFor).toBe('2027-01-16');
    expect(next.overdue).toBe(false);
    expect(questsCompleted(w.s, w.clock.today(), 'side')).toHaveLength(1);
    expect(coinBalance(w.s.wallet)).toBe(20);
    // Side quests never show up in main-quest lists.
    expect(questsDueToday(w.s, w.clock.today())).toHaveLength(0);
  });

  it('a daily quest is due again tomorrow, and skipping pays nothing', () => {
    const w = world();
    w.run((s, c) =>
      createTask(s, c, {
        title: 'Read 20 pages',
        description: '',
        taskType: 'main',
        rewardCoins: 5,
        dueAt: c.today(),
        recurrence: { frequency: 'day', interval: 1, anchorPolicy: 'completion' },
      }),
    );
    w.run((s, c) => completeOccurrence(s, c, questsDueToday(s, c.today())[0].occurrence.id));
    expect(questsDueToday(w.s, w.clock.today())).toHaveLength(0);
    w.run((s, c) => shiftDays(s, c, 1));
    const [due] = questsDueToday(w.s, w.clock.today());
    expect(due.occurrence.scheduledFor).toBe('2026-11-17');
    w.run((s, c) => skipOccurrence(s, c, due.occurrence.id));
    expect(coinBalance(w.s.wallet)).toBe(5);
    expect(w.s.occurrences.filter((o) => o.status === 'open')).toHaveLength(1);
  });

  it('archiving a task keeps completed history and ledger', () => {
    const w = world();
    w.run((s, c) =>
      createTask(s, c, {
        title: 'Stretch',
        description: '',
        taskType: 'main',
        rewardCoins: 3,
        dueAt: c.today(),
        recurrence: { frequency: 'day', interval: 1, anchorPolicy: 'completion' },
      }),
    );
    w.run((s, c) => completeOccurrence(s, c, s.occurrences[0].id));
    w.run((s, c) => archiveTask(s, c, s.tasks[0].id));
    expect(w.s.occurrences.filter((o) => o.status === 'open')).toHaveLength(0);
    expect(questsCompleted(w.s, w.clock.today())).toHaveLength(1);
    expect(coinBalance(w.s.wallet)).toBe(3);
  });

  it('restoring an archived task reopens it today without touching history', () => {
    const w = world();
    w.run((s, c) => createTask(s, c, { title: 'Water plants', description: '', taskType: 'side', rewardCoins: 2, dueAt: '2026-11-10' }));
    w.run((s, c) => archiveTask(s, c, s.tasks[0].id));
    expect(sideQuests(w.s, w.clock.today())).toHaveLength(0);
    w.run((s, c) => restoreTask(s, c, s.tasks[0].id));
    const open = w.s.occurrences.filter((o) => o.status === 'open');
    expect(open).toHaveLength(1);
    expect(open[0].scheduledFor).toBe('2026-11-16');
    expect(w.s.occurrences.filter((o) => o.status === 'skipped')).toHaveLength(1);
    expect(sideQuests(w.s, w.clock.today())).toHaveLength(1);
    expect(() => restoreTask(w.s, w.clock, w.s.tasks[0].id)).toThrow(/already active/);
  });

  it('snoozing an overdue side quest moves it forward without paying coins', () => {
    const w = world();
    w.run((s, c) => createTask(s, c, { title: 'Change car oil', description: '', taskType: 'side', rewardCoins: 30, dueAt: '2026-11-10' }));
    const occ = w.s.occurrences[0];
    w.run((s, c) => snoozeOccurrence(s, c, occ.id, 3));
    expect(w.s.occurrences[0]).toMatchObject({ status: 'open', scheduledFor: '2026-11-19' });
    expect(w.s.wallet).toHaveLength(0);
    expect(() => snoozeOccurrence(w.s, w.clock, occ.id, 0)).toThrow(/1–365/);
  });

  it('rejects invalid input', () => {
    const w = world();
    expect(() => createTask(w.s, w.clock, { title: ' ', description: '', taskType: 'main', rewardCoins: 1, dueAt: '2026-11-16' })).toThrow(/Title/);
    expect(() => createTask(w.s, w.clock, { title: 'x', description: '', taskType: 'main', rewardCoins: -1, dueAt: '2026-11-16' })).toThrow(/Coin reward/);
    expect(() => createTask(w.s, w.clock, { title: 'x', description: '', taskType: 'main', rewardCoins: 1, dueAt: '2026-02-30' })).toThrow(/Due date/);
  });
});

describe('times per period', () => {
  // BASE is Monday 16 Nov 2026.
  const gym = { frequency: 'week' as const, interval: 1, anchorPolicy: 'calendar' as const, timesPerPeriod: 3 };
  const addGym = (w: ReturnType<typeof world>) =>
    w.run((s, c) => createTask(s, c, { title: 'Gym', description: '', taskType: 'main', rewardCoins: 10, dueAt: c.today(), recurrence: gym }));
  const tickToday = (w: ReturnType<typeof world>) =>
    w.run((s, c) => completeOccurrence(s, c, questsDueToday(s, c.today())[0].occurrence.id));

  it('periods are calendar aligned', () => {
    expect(periodContaining(gym, '2026-11-18', '2026-11-22')).toEqual({ start: '2026-11-16', end: '2026-11-22' });
    expect(periodContaining(gym, '2026-11-18', '2026-11-23')).toEqual({ start: '2026-11-23', end: '2026-11-29' });
    const monthly = { ...gym, frequency: 'month' as const };
    expect(periodContaining(monthly, '2026-11-18', '2027-02-14')).toEqual({ start: '2027-02-01', end: '2027-02-28' });
    const fortnight = { ...gym, interval: 2 };
    expect(periodContaining(fortnight, '2026-11-18', '2026-12-03')).toEqual({ start: '2026-11-30', end: '2026-12-13' });
  });

  it('3 times per week: comes back tomorrow until done, then next Monday, paying each time', () => {
    const w = world();
    addGym(w);
    expect(questsDueToday(w.s, w.clock.today())[0].quota).toMatchObject({ done: 0, times: 3, daysLeft: 7, periodLabel: 'this week' });
    tickToday(w);
    expect(questsDueToday(w.s, w.clock.today())).toHaveLength(0);
    expect(questsUpcoming(w.s, w.clock.today())[0].occurrence.scheduledFor).toBe('2026-11-17');
    w.run((s, c) => shiftDays(s, c, 2)); // Wednesday: skipped Tuesday, still due
    expect(questsDueToday(w.s, w.clock.today())[0]).toMatchObject({ overdue: false, quota: { done: 1, daysLeft: 5 } });
    tickToday(w);
    w.run((s, c) => shiftDays(s, c, 1));
    tickToday(w);
    expect(coinBalance(w.s.wallet)).toBe(30);
    const next = w.s.occurrences.find((o) => o.status === 'open')!;
    expect(next.scheduledFor).toBe('2026-11-23');
    expect(questsUpcoming(w.s, w.clock.today())[0].quota).toMatchObject({ done: 3, times: 3 });
  });

  it('an unfinished week rolls into the next one without stacking or going overdue', () => {
    const w = world();
    addGym(w);
    tickToday(w);
    w.run((s, c) => shiftDays(s, c, 8)); // next Tuesday
    const due = questsDueToday(w.s, w.clock.today());
    expect(due).toHaveLength(1);
    expect(due[0]).toMatchObject({ overdue: false, quota: { done: 0, daysLeft: 6, behind: false } });
    w.run((s, c) => shiftDays(s, c, 4)); // Saturday, 0 of 3 with 2 days left
    expect(questsDueToday(w.s, w.clock.today())[0].quota).toMatchObject({ behind: true });
  });

  it('skipping jumps to the next period', () => {
    const w = world();
    addGym(w);
    w.run((s, c) => skipOccurrence(s, c, s.occurrences[0].id));
    expect(w.s.occurrences.find((o) => o.status === 'open')!.scheduledFor).toBe('2026-11-23');
  });

  it('several times per day stays on the same day until done', () => {
    const w = world();
    w.run((s, c) =>
      createTask(s, c, {
        title: 'Glass of water',
        description: '',
        taskType: 'main',
        rewardCoins: 1,
        dueAt: c.today(),
        recurrence: { frequency: 'day', interval: 1, anchorPolicy: 'calendar', timesPerPeriod: 2 },
      }),
    );
    tickToday(w);
    expect(questsDueToday(w.s, w.clock.today())[0].quota).toMatchObject({ done: 1, times: 2, periodLabel: 'today' });
    tickToday(w);
    expect(questsDueToday(w.s, w.clock.today())).toHaveLength(0);
    expect(w.s.occurrences.find((o) => o.status === 'open')!.scheduledFor).toBe('2026-11-17');
  });

  it('a quest started late in the week is not flagged as behind', () => {
    const w = world();
    w.run((s, c) => shiftDays(s, c, 5)); // Saturday
    addGym(w);
    expect(questsDueToday(w.s, w.clock.today())[0].quota).toMatchObject({ done: 0, daysLeft: 2, behind: false });
  });

  it('rejects a bad target', () => {
    const w = world();
    expect(() =>
      createTask(w.s, w.clock, { title: 'x', description: '', taskType: 'main', rewardCoins: 1, dueAt: '2026-11-16', recurrence: { ...gym, timesPerPeriod: 0 } }),
    ).toThrow(/Times per period/);
  });
});

describe('roadmap', () => {
  it('T-02: progress counts milestones and linked one-off tasks', () => {
    const w = world();
    w.run((s, c) => createGoal(s, c, { title: 'Run a half marathon', description: '', cadence: 'yearly' }));
    const goalId = w.s.goals[0].id;
    w.run((s, c) => addMilestone(s, c, goalId, 'Run 5k'));
    w.run((s, c) => addMilestone(s, c, goalId, 'Run 10k'));
    w.run((s, c) => createTask(s, c, { title: 'Buy shoes', description: '', taskType: 'main', goalId, rewardCoins: 5, dueAt: c.today() }));
    w.run((s, c) =>
      createTask(s, c, {
        title: 'Jog',
        description: '',
        taskType: 'main',
        goalId,
        rewardCoins: 5,
        dueAt: c.today(),
        recurrence: { frequency: 'day', interval: 1, anchorPolicy: 'completion' },
      }),
    );
    expect(goalProgress(w.s, goalId)).toMatchObject({ done: 0, total: 3 });

    w.run((s, c) => toggleMilestone(s, c, s.milestones[0].id));
    const shoes = w.s.tasks.find((t) => t.title === 'Buy shoes')!;
    w.run((s, c) => completeOccurrence(s, c, s.occurrences.find((o) => o.taskDefinitionId === shoes.id)!.id));
    expect(goalProgress(w.s, goalId)).toMatchObject({ done: 2, total: 3 });
  });

  it('side quests cannot be linked to goals', () => {
    const w = world();
    w.run((s, c) => createGoal(s, c, { title: 'G', description: '', cadence: 'weekly' }));
    expect(() =>
      createTask(w.s, w.clock, { title: 'Oil', description: '', taskType: 'side', goalId: w.s.goals[0].id, rewardCoins: 0, dueAt: '2026-12-01' }),
    ).toThrow(/Side quests/);
  });
});

describe('collapsing times-per-period rows', () => {
  it('shows one row per quota quest, preferring the open one', () => {
    const w = world();
    w.run((s, c) =>
      createTask(s, c, {
        title: 'Glass of water',
        description: '',
        taskType: 'main',
        rewardCoins: 1,
        dueAt: c.today(),
        recurrence: { frequency: 'day', interval: 1, anchorPolicy: 'calendar', timesPerPeriod: 3 },
      }),
    );
    w.run((s, c) => createTask(s, c, { title: 'Call mum', description: '', taskType: 'main', rewardCoins: 5, dueAt: c.today() }));
    const tick = () => w.run((s, c) => completeOccurrence(s, c, questsDueToday(s, c.today()).find((i) => i.quota)!.occurrence.id));
    tick();
    tick();
    const today = w.clock.today();
    const list = collapseQuota([...questsDueToday(w.s, today), ...questsCompleted(w.s, today)]);
    expect(list.map((i) => [i.task.title, i.occurrence.status])).toEqual([
      ['Call mum', 'open'],
      ['Glass of water', 'open'],
    ]);
    tick();
    const after = collapseQuota([...questsDueToday(w.s, today), ...questsCompleted(w.s, today)]);
    expect(after.filter((i) => i.task.title === 'Glass of water')).toHaveLength(1);
    expect(after.find((i) => i.task.title === 'Glass of water')!.occurrence.status).toBe('completed');
  });
});
