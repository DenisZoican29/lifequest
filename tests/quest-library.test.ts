import { describe, expect, it } from 'vitest';

import { archiveTask, completeOccurrence, createGoal, createTask, type TaskInput } from '../src/domain/commands';
import { addPeriod } from '../src/domain/dates';
import { questLibrary, type LibraryFilter } from '../src/domain/selectors';
import type { RecurrenceRule, TaskType } from '../src/domain/types';
import { world } from './helpers';

// Addendum A4 §2, Quests library. The test clock starts on Monday 16 Nov 2026.
type W = ReturnType<typeof world>;
const WEEKLY: RecurrenceRule = { frequency: 'week', interval: 1, anchorPolicy: 'completion' };

function quest(w: W, title: string, taskType: TaskType = 'main', extra: Partial<TaskInput> = {}) {
  w.run((s, c) => createTask(s, c, { title, description: '', taskType, rewardCoins: 5, dueAt: c.today(), ...extra }));
  return w.s.tasks.find((t) => t.title === title)!.id;
}
const log = (w: W, id: string) =>
  w.run((s, c) => completeOccurrence(s, c, s.occurrences.find((o) => o.taskDefinitionId === id && o.status === 'open')!.id));
const lib = (w: W, filter: LibraryFilter = 'all', query = '') => questLibrary(w.s, w.clock.today(), filter, query);
const titles = (items: { task: { title: string } }[]) => items.map((i) => i.task.title);

describe('quests library', () => {
  it('lists every active quest once, including ones scheduled for a future date', () => {
    const w = world();
    quest(w, 'Study 30 minutes');
    quest(w, 'Renew passport', 'side', { dueAt: addPeriod(w.clock.today(), 'day', 40) });
    expect(titles(lib(w).active)).toEqual(['Study 30 minutes', 'Renew passport']);
  });

  it('a recurring quest stays in the library after each log, as one row', () => {
    const w = world();
    const id = quest(w, 'Clean the oven', 'side', { recurrence: WEEKLY });
    log(w, id);
    const gym = quest(w, 'Gym', 'main', { recurrence: { frequency: 'week', interval: 1, anchorPolicy: 'calendar', timesPerPeriod: 3 } });
    log(w, gym);
    log(w, gym);
    expect(titles(lib(w).active)).toEqual(['Gym', 'Clean the oven']);
    expect(titles(lib(w, 'all', 'gym').active)).toEqual(['Gym']); // matches once, not once per log
  });

  it('a completed one-time quest moves to its own section; archived quests have theirs', () => {
    const w = world();
    const once = quest(w, 'Send an email', 'main', { noDueDate: true });
    const old = quest(w, 'Old habit', 'main', { recurrence: WEEKLY });
    log(w, once);
    w.run((s, c) => archiveTask(s, c, old));
    const l = lib(w);
    expect(l.active).toEqual([]);
    expect(titles(l.completed)).toEqual(['Send an email']);
    expect(titles(l.archived)).toEqual(['Old habit']);
    expect(l.completed[0].occurrence.status).toBe('completed');
  });

  it('type filters and search work together; search covers titles and linked goals', () => {
    const w = world();
    w.run((s, c) => createGoal(s, c, { title: 'Get a new job', description: '', deadline: '2027-06-30' }));
    const goalId = w.s.goals[0].id;
    quest(w, 'Write a cover letter', 'main', { goalId });
    quest(w, 'Update CV', 'main', { goalId });
    quest(w, 'Clean the oven', 'side');
    quest(w, 'Job board: buy printer ink', 'side');
    expect(titles(lib(w, 'main').active)).toEqual(['Update CV', 'Write a cover letter']);
    expect(titles(lib(w, 'side').active)).toEqual(['Clean the oven', 'Job board: buy printer ink']);
    expect(titles(lib(w, 'all', 'job').active)).toEqual(['Job board: buy printer ink', 'Update CV', 'Write a cover letter']);
    expect(titles(lib(w, 'main', 'new job').active)).toEqual(['Update CV', 'Write a cover letter']);
    expect(titles(lib(w, 'side', 'job').active)).toEqual(['Job board: buy printer ink']);
    expect(titles(lib(w, 'main', 'oven').active)).toEqual([]);
  });
});
