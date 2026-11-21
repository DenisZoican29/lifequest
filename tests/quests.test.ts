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
import { nextDueDate } from '../src/domain/recurrence';
import { goalProgress, questsCompleted, questsDueToday, sideQuests } from '../src/domain/selectors';
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
