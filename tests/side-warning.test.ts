import { describe, expect, it } from 'vitest';

import { archiveTask, completeOccurrence, createTask, shiftDays, type TaskInput } from '../src/domain/commands';
import { addPeriod, daysBetween } from '../src/domain/dates';
import { sideQuestWarning, sideQuests } from '../src/domain/selectors';
import type { RecurrenceRule } from '../src/domain/types';
import { world } from './helpers';

// The test clock starts on Monday 16 Nov 2026.
type W = ReturnType<typeof world>;

function side(w: W, title: string, extra: Partial<TaskInput> & { dueIn?: number } = {}) {
  const { dueIn = 0, ...rest } = extra;
  w.run((s, c) =>
    createTask(s, c, { title, description: '', taskType: 'side', rewardCoins: 0, dueAt: addPeriod(c.today(), 'day', dueIn), ...rest }),
  );
  return w.s.tasks.find((t) => t.title === title)!.id;
}
const log = (w: W, id: string) =>
  w.run((s, c) => completeOccurrence(s, c, s.occurrences.find((o) => o.taskDefinitionId === id && o.status === 'open')!.id));
const next = (w: W, days = 1) => w.run((s, c) => shiftDays(s, c, days));
const level = (w: W) => sideQuestWarning(w.s, w.clock.today()).level;

describe('side quest warning', () => {
  it('no side quests, or only later deadlines: no warning', () => {
    const w = world();
    expect(level(w)).toBeUndefined();
    side(w, 'Clean the oven', { dueIn: 5 });
    expect(level(w)).toBeUndefined();
  });

  it('due today or tomorrow shows amber', () => {
    const w = world();
    side(w, 'Renew passport', { dueIn: 1 });
    expect(level(w)).toBe('soon');
    const w2 = world();
    side(w2, 'Call the bank', { dueIn: 0 });
    expect(level(w2)).toBe('soon');
  });

  it('an overdue quest takes priority, and completing it falls back to amber, then clears', () => {
    const w = world();
    const late = side(w, 'Pay the bill', { dueIn: 0 });
    const close = side(w, 'Book a dentist', { dueIn: 2 });
    next(w, 1); // bill overdue, dentist tomorrow
    expect(sideQuestWarning(w.s, w.clock.today())).toEqual({ level: 'overdue', overdue: 1, soon: 1 });
    log(w, late);
    expect(level(w)).toBe('soon');
    log(w, close);
    expect(level(w)).toBeUndefined();
  });

  it('archived quests are ignored', () => {
    const w = world();
    const id = side(w, 'Old errand', { dueIn: 0 });
    next(w, 3);
    expect(level(w)).toBe('overdue');
    w.run((s, c) => archiveTask(s, c, id));
    expect(level(w)).toBeUndefined();
  });

  it('a date-range quest only warns when its end date is close', () => {
    const w = world();
    side(w, 'Fix the fence', { window: { start: '2026-11-16', end: '2026-11-20', times: 2 } });
    expect(level(w)).toBeUndefined(); // Mon, ends Fri
    next(w, 3); // Thu: ends tomorrow
    expect(level(w)).toBe('soon');
    next(w, 2); // Sat: ended unfinished
    expect(level(w)).toBe('overdue');
  });

  it('an unfinished quota warns near the end of its period; a met quota does not', () => {
    const weekly2: RecurrenceRule = { frequency: 'week', interval: 1, anchorPolicy: 'calendar', timesPerPeriod: 2 };
    const w = world();
    const id = side(w, 'Water plants', { recurrence: weekly2 });
    expect(level(w)).toBeUndefined(); // Mon, the week ends Sunday
    next(w, 5); // Sat
    expect(level(w)).toBe('soon');
    log(w, id);
    log(w, id); // target met: waits for next week
    expect(level(w)).toBeUndefined();
  });

  it('a warning period moves when amber appears: an oil change every 6 months warns 2 weeks before', () => {
    const w = world();
    const oil = side(w, 'Change the car oil', { dueIn: 20, recurrence: { frequency: 'month', interval: 6, anchorPolicy: 'completion' }, reminderDaysBefore: 14 });
    expect(level(w)).toBeUndefined(); // 20 days out
    next(w, 5);
    expect(level(w)).toBeUndefined(); // 15 days out
    next(w, 1);
    expect(sideQuestWarning(w.s, w.clock.today())).toEqual({ level: 'soon', overdue: 0, soon: 1 }); // 14 days out
    next(w, 15);
    expect(level(w)).toBe('overdue');
    log(w, oil); // next oil change in 6 months: quiet again
    expect(level(w)).toBeUndefined();
  });

  it('0 days warns only on the due day; the default warns from the day before', () => {
    const w = world();
    side(w, 'Bin day', { dueIn: 1, reminderDaysBefore: 0 });
    expect(level(w)).toBeUndefined();
    next(w, 1);
    expect(level(w)).toBe('soon');
    const w2 = world();
    side(w2, 'Call the bank', { dueIn: 2 });
    expect(level(w2)).toBeUndefined();
    next(w2, 1);
    expect(level(w2)).toBe('soon');
  });

  it('the warning period applies to a date range end and to quests without a due date never', () => {
    const w = world();
    side(w, 'Paint the fence', { window: { start: '2026-11-16', end: '2026-11-30', times: 2 }, reminderDaysBefore: 7 });
    side(w, 'Water plants', { recurrence: { frequency: 'day', interval: 1, anchorPolicy: 'completion' }, reminderDaysBefore: 30 });
    expect(level(w)).toBeUndefined(); // ends in 14 days
    next(w, 7);
    expect(sideQuestWarning(w.s, w.clock.today())).toEqual({ level: 'soon', overdue: 0, soon: 1 });
  });

  it('marks the quest itself, so its row can show amber', () => {
    const w = world();
    side(w, 'Renew passport', { dueIn: 10, reminderDaysBefore: 14 });
    side(w, 'Clean the oven', { dueIn: 10 });
    const items = sideQuests(w.s, w.clock.today());
    expect(items.map((i) => [i.task.title, i.warning])).toEqual([['Clean the oven', undefined], ['Renew passport', 'soon']]);
  });

  it('a repeating side quest without a due date warns before its period ends, never red', () => {
    const w = world();
    // Oil change every 6 months, no due date: periods run 1 Nov - 30 Apr, 1 May - 31 Oct.
    const oil = side(w, 'Change the car oil', { recurrence: { frequency: 'month', interval: 6, anchorPolicy: 'completion' }, noDueDate: true, reminderDaysBefore: 14 });
    expect(level(w)).toBeUndefined();
    w.run((s, c) => shiftDays(s, c, daysBetween(c.today(), '2027-04-15'))); // 15 days before 30 Apr
    expect(level(w)).toBeUndefined();
    next(w, 1); // 16 Apr: 14 days left
    expect(level(w)).toBe('soon');
    log(w, oil); // done: quiet until the next period
    expect(level(w)).toBeUndefined();
    w.run((s, c) => shiftDays(s, c, daysBetween(c.today(), '2027-10-17'))); // 14 days before 31 Oct
    expect(level(w)).toBe('soon');
    w.run((s, c) => shiftDays(s, c, daysBetween(c.today(), '2027-11-01'))); // the period ended unfinished: a new one starts, nothing overdue
    expect(level(w)).toBeUndefined();
  });

  it('undated one-offs and daily quests never warn', () => {
    const w = world();
    side(w, 'Send an email', { noDueDate: true, reminderDaysBefore: 30 });
    side(w, 'Water plants', { recurrence: { frequency: 'day', interval: 1, anchorPolicy: 'completion' }, reminderDaysBefore: 30 });
    expect(w.s.tasks.map((t) => t.reminderDaysBefore)).toEqual([undefined, undefined]);
    next(w, 40);
    expect(level(w)).toBeUndefined();
  });
});
