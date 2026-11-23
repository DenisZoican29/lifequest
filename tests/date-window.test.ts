import { describe, expect, it } from 'vitest';

import { completeOccurrence, createGoal, createTask, deleteTask, rescheduleWindow, shiftDays, updateTask, type TaskInput } from '../src/domain/commands';
import { coinBalance } from '../src/domain/economy';
import { goalInsights } from '../src/domain/goal-insights';
import { repeatFromRule, repeatSummary, ruleFromRepeat, windowFromRepeat } from '../src/domain/repeat';
import { questsCompleted, questsDueToday, questsUpcoming, quotaProgress } from '../src/domain/selectors';
import { world } from './helpers';

// The test clock starts on Monday 16 Nov 2026.
type W = ReturnType<typeof world>;

const input = (patch: Partial<TaskInput> = {}): TaskInput => ({
  title: 'Cook a new recipe',
  description: '',
  taskType: 'main',
  rewardCoins: 10,
  dueAt: '2026-11-16',
  window: { start: '2026-11-20', end: '2026-12-01', times: 4 },
  ...patch,
});

function add(w: W, patch: Partial<TaskInput> = {}) {
  w.run((s, c) => createTask(s, c, input(patch)));
  return w.s.tasks.at(-1)!;
}
const open = (w: W, id: string) => w.s.occurrences.find((o) => o.taskDefinitionId === id && o.status === 'open');
const log = (w: W, id: string) => w.run((s, c) => completeOccurrence(s, c, open(w, id)!.id));
const progress = (w: W, id: string) => quotaProgress(w.s, w.s.tasks.find((t) => t.id === id)!, w.clock.today())!;

describe('N times between two dates', () => {
  it('waits for its start date, then can be logged several times a day until the target', () => {
    const w = world();
    const t = add(w);
    expect(t).toMatchObject({ dueAt: '2026-11-20', recurrence: undefined });
    expect(questsUpcoming(w.s, w.clock.today())[0].occurrence.scheduledFor).toBe('2026-11-20');
    expect(() => log(w, t.id)).toThrow(/not started/);

    w.run((s, c) => shiftDays(s, c, 4)); // Fri 20 Nov
    log(w, t.id);
    log(w, t.id);
    expect(progress(w, t.id)).toMatchObject({ done: 2, times: 4, periodLabel: 'by 1 Dec', missed: false, daysLeft: 12 });
    expect(questsDueToday(w.s, w.clock.today())).toHaveLength(1);

    log(w, t.id);
    log(w, t.id);
    expect(open(w, t.id)).toBeUndefined(); // finished
    expect(coinBalance(w.s.wallet)).toBe(40);
    expect(questsCompleted(w.s, w.clock.today())).toHaveLength(4);
  });

  it('shows as not done once the end date passes, and refuses more logs', () => {
    const w = world();
    const t = add(w);
    w.run((s, c) => shiftDays(s, c, 4));
    log(w, t.id);
    w.run((s, c) => shiftDays(s, c, 12)); // Wed 2 Dec
    expect(progress(w, t.id)).toMatchObject({ done: 1, missed: true, daysLeft: 0 });
    const [due] = questsDueToday(w.s, w.clock.today());
    expect(due).toMatchObject({ overdue: false, quota: { missed: true } });
    expect(() => log(w, t.id)).toThrow(/ended/);
  });

  it('rescheduling moves the end date and keeps what was done', () => {
    const w = world();
    const t = add(w);
    w.run((s, c) => shiftDays(s, c, 4));
    log(w, t.id);
    log(w, t.id);
    w.run((s, c) => shiftDays(s, c, 12)); // Wed 2 Dec, not done
    expect(() => w.run((s, c) => rescheduleWindow(s, c, t.id, '2026-12-01'))).toThrow(/today or a later/);
    w.run((s, c) => rescheduleWindow(s, c, t.id, '2026-12-08'));
    expect(progress(w, t.id)).toMatchObject({ done: 2, times: 4, missed: false, daysLeft: 7, periodLabel: 'by 8 Dec' });
    expect(open(w, t.id)?.scheduledFor).toBe('2026-12-02');
    log(w, t.id);
    expect(progress(w, t.id).done).toBe(3);
  });

  it('rescheduling after the end date leaves exactly one open occurrence', () => {
    const w = world();
    const t = add(w, { window: { start: '2026-11-16', end: '2026-11-18', times: 2 } });
    log(w, t.id);
    w.run((s, c) => shiftDays(s, c, 3));
    w.run((s, c) => rescheduleWindow(s, c, t.id, '2026-11-25'));
    expect(w.s.occurrences.filter((o) => o.taskDefinitionId === t.id && o.status === 'open')).toHaveLength(1);
  });

  it('delete removes the quest and its open occurrence but keeps earned coins and history', () => {
    const w = world();
    const t = add(w, { window: { start: '2026-11-16', end: '2026-11-18', times: 3 } });
    log(w, t.id);
    w.run((s, c) => deleteTask(s, c, t.id));
    expect(w.s.tasks.find((x) => x.id === t.id)).toBeUndefined();
    expect(open(w, t.id)).toBeUndefined();
    expect(coinBalance(w.s.wallet)).toBe(10);
    expect(w.s.occurrences.filter((o) => o.taskDefinitionId === t.id && o.status === 'completed')).toHaveLength(1);
    expect(questsDueToday(w.s, w.clock.today())).toHaveLength(0);
  });

  it('editing the window keeps progress inside it', () => {
    const w = world();
    const t = add(w, { window: { start: '2026-11-16', end: '2026-11-20', times: 2 } });
    log(w, t.id);
    log(w, t.id); // target met, finished
    expect(open(w, t.id)).toBeUndefined();
    w.run((s, c) => updateTask(s, c, t.id, input({ window: { start: '2026-11-16', end: '2026-11-20', times: 3 } })));
    expect(open(w, t.id)?.scheduledFor).toBe('2026-11-16');
    expect(progress(w, t.id)).toMatchObject({ done: 2, times: 3 });
  });

  it('changes or clears a quest color without rescheduling its date range', () => {
    const w = world();
    const task = add(w, { color: 'blue' });
    expect(task.color).toBe('blue');
    const originalOccurrence = open(w, task.id);
    w.run((s, c) => shiftDays(s, c, 5));
    w.run((s, c) => updateTask(s, c, task.id, input({ title: 'Try a new recipe' })));
    expect(w.s.tasks[0].color).toBe('blue');
    w.run((s, c) => updateTask(s, c, task.id, input({ color: 'purple' })));
    expect(w.s.tasks[0].color).toBe('purple');
    w.run((s, c) => updateTask(s, c, task.id, input({ color: null })));
    expect(w.s.tasks[0].color).toBeUndefined();
    expect(open(w, task.id)).toEqual(originalOccurrence);
  });

  it('validates the window', () => {
    const w = world();
    expect(() => add(w, { window: { start: '2026-11-20', end: '2026-11-19', times: 2 } })).toThrow(/on or after/);
    expect(() => add(w, { window: { start: '2026-11-01', end: '2026-11-10', times: 2 } })).toThrow(/today or later/);
    expect(() => add(w, { window: { start: '2026-11-20', end: '2026-11-25', times: 0 } })).toThrow(/between 1 and 100/);
  });

  it('counts toward a linked goal as one plan', () => {
    const w = world();
    w.run((s, c) => createGoal(s, c, { title: 'Be better at cooking', description: '', deadline: '2027-06-30' }));
    const goal = w.s.goals[0];
    const t = add(w, { goalId: goal.id, window: { start: '2026-11-16', end: '2026-11-22', times: 4 } });
    log(w, t.id);
    expect(goalInsights(w.s, goal, w.clock.today()).consistency).toBeNull(); // still possible
    w.run((s, c) => shiftDays(s, c, 7)); // window over: 1 of 4
    expect(goalInsights(w.s, w.s.goals[0], w.clock.today()).consistency).toBeCloseTo(0.25);
  });
});

describe('repeat picker: between dates', () => {
  const v = { mode: 'repeating' as const, times: '4', every: '1', unit: 'week' as const, anchor: 'completion' as const, span: 'dates' as const, end: '2026-12-01' };
  it('maps to a window instead of a rule', () => {
    expect(ruleFromRepeat(v)).toBeUndefined();
    expect(windowFromRepeat(v, '2026-11-20')).toEqual({ start: '2026-11-20', end: '2026-12-01', times: 4 });
    expect(windowFromRepeat({ ...v, span: 'repeat' }, '2026-11-20')).toBeUndefined();
    expect(repeatSummary(v, '2026-11-20')).toBe('4 times between 20 Nov and 1 Dec');
  });
  it('round-trips an existing window', () => {
    expect(repeatFromRule(undefined, { start: '2026-11-20', end: '2026-12-01', times: 4 })).toMatchObject({ mode: 'repeating', span: 'dates', times: '4', end: '2026-12-01' });
  });
});
