import { describe, expect, it } from 'vitest';

import { completeOccurrence, createTask, shiftDays, updateTask, type TaskInput } from '../src/domain/commands';
import { questPeriods } from '../src/domain/goal-insights';
import { questBoard, questsDueToday, questsUpcoming, sideQuestWarning } from '../src/domain/selectors';
import type { RecurrenceRule, TaskType } from '../src/domain/types';
import { world } from './helpers';

// Addendum A4 §4: Daily quests and undated one-offs have no due date.
// The test clock starts on Monday 16 Nov 2026.
type W = ReturnType<typeof world>;

const DAILY: RecurrenceRule = { frequency: 'day', interval: 1, anchorPolicy: 'completion' };

function quest(w: W, title: string, taskType: TaskType, extra: Partial<TaskInput> = {}) {
  w.run((s, c) => createTask(s, c, { title, description: '', taskType, rewardCoins: 5, dueAt: c.today(), ...extra }));
  return w.s.tasks.find((t) => t.title === title)!.id;
}
const openOf = (w: W, id: string) => w.s.occurrences.find((o) => o.taskDefinitionId === id && o.status === 'open');
const log = (w: W, id: string) => w.run((s, c) => completeOccurrence(s, c, openOf(w, id)!.id));
const next = (w: W, days = 1) => w.run((s, c) => shiftDays(s, c, days));
const board = (w: W, type: TaskType = 'main', range: 'today' | 'week' = 'today') => questBoard(w.s, w.clock.today(), range, type);
const titles = (items: { task: { title: string } }[]) => items.map((i) => i.task.title);

describe('quests without a due date', () => {
  it('main and side quests save as Daily with no date', () => {
    const w = world();
    const main = quest(w, 'Eat breakfast', 'main', { recurrence: DAILY });
    const side = quest(w, 'Water plants', 'side', { recurrence: DAILY, reminderDaysBefore: 1 });
    expect(titles(questsDueToday(w.s, w.clock.today(), 'main'))).toEqual(['Eat breakfast']);
    expect(titles(questsDueToday(w.s, w.clock.today(), 'side'))).toEqual(['Water plants']);
    expect(w.s.tasks.find((t) => t.id === side)!.reminderDaysBefore).toBeUndefined(); // no due-date reminder
    expect(questsDueToday(w.s, w.clock.today(), 'main')[0].undated).toBe(true);
    expect(main).toBeTruthy();
  });

  it('a completed daily quest moves to Completed today and comes back the next day', () => {
    const w = world();
    const id = quest(w, 'Eat breakfast', 'main', { recurrence: DAILY });
    log(w, id);
    expect(titles(board(w).completed)).toEqual(['Eat breakfast']);
    expect(board(w).todo).toEqual([]);
    expect(openOf(w, id)!.scheduledFor).toBe('2026-11-17');
    next(w); // across midnight
    expect(titles(board(w).todo)).toEqual(['Eat breakfast']);
    expect(board(w).overdue).toEqual([]);
  });

  it('a missed day never becomes overdue or builds a backlog', () => {
    const w = world();
    const id = quest(w, 'Eat breakfast', 'main', { recurrence: { ...DAILY, anchorPolicy: 'calendar' } });
    next(w, 3); // three missed days
    const today = board(w);
    expect(today.overdue).toEqual([]);
    expect(titles(today.todo)).toEqual(['Eat breakfast']);
    expect(today.todo[0].overdue).toBe(false);
    expect(w.s.occurrences.filter((o) => o.taskDefinitionId === id && o.status === 'open')).toHaveLength(1);
    expect(board(w, 'main', 'week').overdue).toEqual([]);
    log(w, id);
    expect(openOf(w, id)!.scheduledFor).toBe('2026-11-20'); // available again tomorrow, not a catch-up today
  });

  it('a custom daily target (3 times per day) works the same once the target is reached', () => {
    const w = world();
    const id = quest(w, 'Drink water', 'side', { recurrence: { frequency: 'day', interval: 1, anchorPolicy: 'calendar', timesPerPeriod: 3 } });
    expect(sideQuestWarning(w.s, w.clock.today()).level).toBeUndefined();
    log(w, id);
    log(w, id);
    log(w, id);
    expect(questsDueToday(w.s, w.clock.today(), 'side')).toEqual([]);
    expect(titles(questsUpcoming(w.s, w.clock.today(), 'side'))).toEqual(['Drink water']);
    next(w, 2); // a missed day in between
    expect(sideQuestWarning(w.s, w.clock.today()).level).toBeUndefined();
    expect(titles(questsDueToday(w.s, w.clock.today(), 'side'))).toEqual(['Drink water']);
  });

  it('an undated one-off stays available until completed, then leaves the open list', () => {
    const w = world();
    const id = quest(w, 'Send an email', 'side', { noDueDate: true });
    expect(w.s.tasks.find((t) => t.id === id)!.noDueDate).toBe(true);
    next(w, 10);
    const items = board(w, 'side');
    expect(items.overdue).toEqual([]);
    expect(titles(items.todo)).toEqual(['Send an email']);
    expect(sideQuestWarning(w.s, w.clock.today()).level).toBeUndefined();
    log(w, id);
    expect(openOf(w, id)).toBeUndefined();
    expect(board(w, 'side').todo).toEqual([]);
    expect(titles(board(w, 'side').completed)).toEqual(['Send an email']);
  });

  it('dated quests still go overdue', () => {
    const w = world();
    quest(w, 'Pay the bill', 'side');
    quest(w, 'Clean the oven', 'side', { recurrence: { frequency: 'week', interval: 1, anchorPolicy: 'completion' } });
    next(w, 8);
    expect(titles(board(w, 'side').overdue)).toEqual(['Clean the oven', 'Pay the bill']);
    expect(sideQuestWarning(w.s, w.clock.today()).level).toBe('overdue');
  });

  it('a repeating quest without a due date runs for life: once in each period, any day, never overdue', () => {
    const w = world();
    const id = quest(w, 'Call grandma', 'side', { recurrence: { frequency: 'week', interval: 1, anchorPolicy: 'completion' }, noDueDate: true, reminderDaysBefore: 3 });
    const task = w.s.tasks.find((t) => t.id === id)!;
    expect(task.noDueDate).toBe(true);
    expect(task.recurrence).toEqual({ frequency: 'week', interval: 1, anchorPolicy: 'calendar', timesPerPeriod: 1 });
    expect(task.reminderDaysBefore).toBe(3); // warns before each week ends
    next(w, 2); // Wednesday: 4 days left this week
    expect(titles(board(w, 'side').todo)).toEqual(['Call grandma']);
    expect(sideQuestWarning(w.s, w.clock.today()).level).toBeUndefined();
    next(w, 1); // Thursday: the week ends in 3 days
    expect(sideQuestWarning(w.s, w.clock.today()).level).toBe('soon');
    log(w, id); // done this week: back next Monday
    expect(openOf(w, id)!.scheduledFor).toBe('2026-11-23');
    expect(sideQuestWarning(w.s, w.clock.today()).level).toBeUndefined(); // done this week: quiet
    next(w, 4); // Monday
    expect(titles(board(w, 'side').todo)).toEqual(['Call grandma']);
    next(w, 7); // the next Monday, after a whole week missed: no backlog, nothing overdue
    expect(board(w, 'side').overdue).toEqual([]);
    expect(w.s.occurrences.filter((o) => o.taskDefinitionId === id && o.status === 'open')).toHaveLength(1);
    expect(sideQuestWarning(w.s, w.clock.today()).level).toBeUndefined();
  });

  it('giving an undated one-off a date makes it dated again', () => {
    const w = world();
    const id = quest(w, 'Send an email', 'main', { noDueDate: true });
    const t = w.s.tasks.find((x) => x.id === id)!;
    w.run((s, c) => updateTask(s, c, id, { ...t, dueAt: '2026-11-18', noDueDate: false }));
    expect(w.s.tasks.find((x) => x.id === id)!.noDueDate).toBeUndefined();
    next(w, 3);
    expect(titles(board(w).overdue)).toEqual(['Send an email']);
  });

  it('goal consistency never counts an undated one-off as missed', () => {
    const w = world();
    const id = quest(w, 'Send an email', 'main', { noDueDate: true });
    next(w, 5);
    const task = w.s.tasks.find((t) => t.id === id)!;
    expect(questPeriods(task, [], w.clock.today(), w.clock.today())).toEqual([]);
    expect(questPeriods({ ...task, noDueDate: undefined }, [], w.clock.today(), w.clock.today())).toHaveLength(1);
  });
});
