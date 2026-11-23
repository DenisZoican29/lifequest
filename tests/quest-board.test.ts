import { describe, expect, it } from 'vitest';

import { completeOccurrence, createTask, shiftDays } from '../src/domain/commands';
import { addPeriod } from '../src/domain/dates';
import { questBoard, weekBounds } from '../src/domain/selectors';
import type { RecurrenceRule } from '../src/domain/types';
import { world } from './helpers';

// The test clock starts on Monday 16 Nov 2026.
type W = ReturnType<typeof world>;
const daily: RecurrenceRule = { frequency: 'day', interval: 1, anchorPolicy: 'calendar' };
const weekly3: RecurrenceRule = { frequency: 'week', interval: 1, anchorPolicy: 'calendar', timesPerPeriod: 3 };

function quest(w: W, title: string, dueIn = 0, recurrence?: RecurrenceRule) {
  w.run((s, c) => createTask(s, c, { title, description: '', taskType: 'main', rewardCoins: 10, dueAt: addPeriod(c.today(), 'day', dueIn), recurrence }));
  return w.s.tasks.find((t) => t.title === title)!.id;
}
const log = (w: W, id: string) =>
  w.run((s, c) => completeOccurrence(s, c, s.occurrences.find((o) => o.taskDefinitionId === id && o.status === 'open')!.id));
const next = (w: W, days = 1) => w.run((s, c) => shiftDays(s, c, days));
const titles = (xs: { task: { title: string } }[]) => xs.map((x) => x.task.title);

describe('quest board', () => {
  it('weeks run Monday to Sunday', () => {
    expect(weekBounds('2026-11-16')).toEqual({ start: '2026-11-16', end: '2026-11-22' }); // Monday
    expect(weekBounds('2026-11-22')).toEqual({ start: '2026-11-16', end: '2026-11-22' }); // Sunday
    expect(weekBounds('2026-11-23')).toEqual({ start: '2026-11-23', end: '2026-11-29' }); // next Monday
  });

  it('a quest due today is in both Today and This week, and completing it updates both', () => {
    const w = world();
    const id = quest(w, 'Walk', 0, daily);
    const today = w.clock.today();
    expect(titles(questBoard(w.s, today, 'today').todo)).toEqual(['Walk']);
    expect(titles(questBoard(w.s, today, 'week').todo)).toEqual(['Walk']);
    log(w, id);
    const d = questBoard(w.s, today, 'today');
    const wk = questBoard(w.s, today, 'week');
    expect([d.doneCount, wk.doneCount]).toEqual([1, 1]);
    expect(titles(d.completed)).toEqual(['Walk']);
    expect(titles(wk.completed)).toEqual(['Walk']);
    // Tomorrow's walk: not in Today, still to do this week.
    expect(d.todo).toHaveLength(0);
    expect(titles(wk.todo)).toEqual(['Walk']);
  });

  it('on Sunday the week still holds Monday’s completion; on Monday a new week starts', () => {
    const w = world();
    const id = quest(w, 'Walk', 0, daily);
    log(w, id); // Monday 16 Nov
    next(w, 6); // Sunday 22 Nov
    const sunday = questBoard(w.s, w.clock.today(), 'week');
    expect(sunday.start).toBe('2026-11-16');
    expect(sunday.doneCount).toBe(1);
    expect(sunday.overdue).toHaveLength(0);
    next(w, 1); // Monday 23 Nov
    const monday = questBoard(w.s, w.clock.today(), 'week');
    expect(monday.start).toBe('2026-11-23');
    expect(monday.doneCount).toBe(0);
  });

  it('keeps older overdue one-offs under Overdue and later items under Upcoming', () => {
    const w = world();
    next(w, -7); // a week earlier, so "Old task" can be created on its due date
    quest(w, 'Old task', 0);
    next(w, 7); // back to Monday 16 Nov
    quest(w, 'Tuesday task', 1);
    quest(w, 'Next month', 30);
    next(w, 3); // Thursday 19 Nov
    const wk = questBoard(w.s, w.clock.today(), 'week');
    expect(titles(wk.overdue)).toEqual(['Old task']);
    expect(titles(wk.todo)).toEqual(['Tuesday task']); // earlier this week: still in the week, its row says overdue
    expect(wk.todo[0].overdue).toBe(true);
    expect(titles(wk.upcoming)).toEqual(['Next month']);
    const d = questBoard(w.s, w.clock.today(), 'today');
    expect(titles(d.overdue)).toEqual(['Old task', 'Tuesday task']);
  });

  it('quota quests stay one to-do row with their own progress; every log counts as done', () => {
    const w = world();
    const id = quest(w, 'Gym', 0, weekly3);
    log(w, id);
    next(w, 2);
    log(w, id);
    const wk = questBoard(w.s, w.clock.today(), 'week');
    expect(wk.todo.map((i) => [i.task.title, i.quota?.done, i.quota?.times])).toEqual([['Gym', 2, 3]]);
    expect(wk.doneCount).toBe(2);
    expect(wk.completed).toHaveLength(1);
    expect(wk.overdue).toHaveLength(0);
    // Hitting the target leaves nothing to do this week.
    log(w, id);
    const met = questBoard(w.s, w.clock.today(), 'week');
    expect(met.todo).toHaveLength(0);
    expect(met.doneCount).toBe(3);
    expect(met.openCount).toBe(0);
  });
});
