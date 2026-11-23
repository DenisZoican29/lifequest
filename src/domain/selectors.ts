import { doneInPeriod } from './commands';
import { matchesAll } from './goal-search';
import { format, startOfWeek } from 'date-fns';

import { addPeriod, daysBetween, fromLocalDate, toLocalDate } from './dates';
import { canWarn, isQuota, isUndated, periodContaining } from './recurrence';
import type { Goal, LocalDate, Milestone, Snapshot, TaskDefinition, TaskOccurrence, TaskType } from './types';

export interface QuestItem {
  occurrence: TaskOccurrence;
  task: TaskDefinition;
  /** Days until due; negative = overdue (or, for a quest without a due date, available since then). */
  dueInDays: number;
  /** No due date (daily quests and undated one-offs): never overdue, no reminder or deadline warning. */
  undated: boolean;
  overdue: boolean;
  /** Open side quests: the deadline has passed, or it falls inside the quest's warning period. */
  warning?: DeadlineLevel;
  /** "N times per period" quests: progress in the period containing today. */
  quota?: QuotaProgress;
}

export interface QuotaProgress {
  done: number;
  times: number;
  /** Days left in the period, counting today. */
  daysLeft: number;
  /** "this week", "today", "this 2-week period". */
  periodLabel: string;
  /** More left to do than days remain (periods longer than a day, from the first full period). */
  behind: boolean;
  /** Date-range quests: the end date passed before the target was met ("not done"). */
  missed?: boolean;
  /** Date-range quests: last day of the window. */
  endsOn?: LocalDate;
}

export function periodLabel(frequency: string, interval: number): string {
  if (interval === 1) return frequency === 'day' ? 'today' : `this ${frequency}`;
  return `this ${interval}-${frequency} period`;
}

export function quotaProgress(s: Snapshot, task: TaskDefinition, today: LocalDate): QuotaProgress | undefined {
  if (task.window) {
    const w = task.window;
    const done = doneInPeriod(s, task, today);
    const daysLeft = today > w.end ? 0 : daysBetween(today < w.start ? w.start : today, w.end) + 1;
    return {
      done,
      times: w.times,
      daysLeft,
      periodLabel: `by ${format(fromLocalDate(w.end), 'd MMM')}`,
      behind: today >= w.start && today <= w.end && w.times - done > daysLeft,
      missed: today > w.end && done < w.times,
      endsOn: w.end,
    };
  }
  const rule = task.recurrence;
  if (!isQuota(rule)) return undefined;
  const done = doneInPeriod(s, task, today);
  const { start, end } = periodContaining(rule, task.dueAt, today);
  const daysLeft = daysBetween(today, end) + 1;
  const multiDay = !(rule.frequency === 'day' && rule.interval <= 1);
  return {
    done,
    times: rule.timesPerPeriod,
    daysLeft,
    periodLabel: periodLabel(rule.frequency, rule.interval),
    // No warning in a partial first period (e.g. a weekly quest started on Saturday).
    behind: multiDay && start >= task.dueAt && rule.timesPerPeriod - done > daysLeft,
  };
}

export function questItem(s: Snapshot, o: TaskOccurrence, task: TaskDefinition, today: LocalDate): QuestItem {
  const dueInDays = daysBetween(today, o.scheduledFor);
  const quota = quotaProgress(s, task, today);
  const undated = isUndated(task);
  const item: QuestItem = {
    occurrence: o,
    task,
    dueInDays,
    undated,
    quota,
    // A quota quest left open from an earlier period just carries on in the current one, and a
    // quest without a due date just stays available (a missed day leaves no backlog).
    overdue: o.status === 'open' && dueInDays < 0 && !quota && !undated,
  };
  if (task.taskType === 'side' && task.active && o.status === 'open') item.warning = deadlineLevel(item, today);
  return item;
}

function join(s: Snapshot, filter: (o: TaskOccurrence) => boolean, today: LocalDate): QuestItem[] {
  const tasks = new Map(s.tasks.map((t) => [t.id, t]));
  const out: QuestItem[] = [];
  for (const o of s.occurrences) {
    const t = tasks.get(o.taskDefinitionId);
    if (t && filter(o)) out.push(questItem(s, o, t, today));
  }
  return out;
}

const byDue = (a: QuestItem, b: QuestItem) =>
  a.occurrence.scheduledFor.localeCompare(b.occurrence.scheduledFor) || a.task.title.localeCompare(b.task.title);

/**
 * One row per times-per-period quest: its open occurrence if it's in the list, otherwise its
 * latest completion. Without this, "8 glasses of water" would list every glass as its own row.
 */
export function collapseQuota(items: QuestItem[]): QuestItem[] {
  const rank = (i: QuestItem) => (i.occurrence.status === 'open' ? '~' : (i.occurrence.completedAt ?? ''));
  const best = new Map<string, QuestItem>();
  for (const i of items) {
    if (!i.quota) continue;
    const prev = best.get(i.task.id);
    if (!prev || rank(i) > rank(prev)) best.set(i.task.id, i);
  }
  return items.filter((i) => !i.quota || best.get(i.task.id) === i);
}

/** Open main-quest occurrences due today or overdue. */
export function questsDueToday(s: Snapshot, today: LocalDate, type: TaskType = 'main'): QuestItem[] {
  return join(s, (o) => o.status === 'open', today)
    .filter((i) => i.task.taskType === type && i.task.active && i.dueInDays <= 0)
    .sort(byDue);
}

export function questsUpcoming(s: Snapshot, today: LocalDate, type: TaskType = 'main'): QuestItem[] {
  return join(s, (o) => o.status === 'open', today)
    .filter((i) => i.task.taskType === type && i.task.active && i.dueInDays > 0)
    .sort(byDue);
}

/** Completion history, newest first (FR-08). */
export function questsCompleted(s: Snapshot, today: LocalDate, type?: TaskType): QuestItem[] {
  return join(s, (o) => o.status === 'completed', today)
    .filter((i) => !type || i.task.taskType === type)
    .sort((a, b) => (b.occurrence.completedAt ?? '').localeCompare(a.occurrence.completedAt ?? ''));
}

/** All open side quests (any due date), soonest first. Kept apart from roadmap progress (FR-09). */
export function sideQuests(s: Snapshot, today: LocalDate): QuestItem[] {
  return join(s, (o) => o.status === 'open', today)
    .filter((i) => i.task.taskType === 'side' && i.task.active)
    .sort(byDue);
}

// ---------------------------------------------------------------- quest board (addendum A4 §2)

export type BoardRange = 'today' | 'week';

export interface QuestBoard {
  start: LocalDate;
  end: LocalDate;
  /** Open, scheduled before the range (never quota quests, which carry on in the current period, nor quests without a due date). */
  overdue: QuestItem[];
  /** Open, scheduled inside the range (or a quota quest's current period), by scheduled date. */
  todo: QuestItem[];
  /** Completed inside the range, newest first; one row per quota quest (its latest log). */
  completed: QuestItem[];
  /** Open, scheduled after the range, soonest first. */
  upcoming: QuestItem[];
  /** Open rows (overdue + to do). */
  openCount: number;
  /** Completions logged inside the range (every log of a quota quest counts). */
  doneCount: number;
}

/** Monday to Sunday containing `today`, in the app's local calendar. */
export function weekBounds(today: LocalDate): { start: LocalDate; end: LocalDate } {
  const start = toLocalDate(startOfWeek(fromLocalDate(today), { weekStartsOn: 1 }));
  return { start, end: addPeriod(start, 'day', 6) };
}

/**
 * The Quests tab's lists for Today or This week (Monday–Sunday). Today's quests are part of
 * the week, so completing one updates both views.
 */
export function questBoard(s: Snapshot, today: LocalDate, range: BoardRange, type: TaskType = 'main'): QuestBoard {
  const { start, end } = range === 'today' ? { start: today, end: today } : weekBounds(today);
  const open = join(s, (o) => o.status === 'open', today)
    .filter((i) => i.task.taskType === type && i.task.active)
    .sort(byDue);
  const overdue: QuestItem[] = [];
  const todo: QuestItem[] = [];
  const upcoming: QuestItem[] = [];
  for (const i of open) {
    const d = i.occurrence.scheduledFor;
    if (d > end) upcoming.push(i);
    else if (i.quota && !i.quota.missed && i.quota.done >= i.quota.times) continue; // target met: nothing to do, its logs are under Completed
    else if (d < start && !i.quota && !i.undated) overdue.push(i);
    else todo.push(i);
  }
  const done = join(s, (o) => o.status === 'completed' && !!o.completedOn && o.completedOn >= start && o.completedOn <= end, today)
    .filter((i) => i.task.taskType === type)
    .sort((a, b) => (b.occurrence.completedAt ?? '').localeCompare(a.occurrence.completedAt ?? ''));
  return {
    start,
    end,
    overdue,
    todo,
    completed: collapseQuota(done),
    upcoming,
    openCount: overdue.length + todo.length,
    doneCount: done.length,
  };
}

// ---------------------------------------------------------------- quests library (addendum A4 §2, Quests library)

export type LibraryFilter = 'all' | TaskType;

export interface QuestLibrary {
  /** Active quests with an open occurrence (including ones scheduled for later), soonest first. */
  active: QuestItem[];
  /** Active quests with nothing left to do: finished one-offs and date ranges. Newest completion first. */
  completed: QuestItem[];
  /** Archived quests, most recently archived first. */
  archived: QuestItem[];
}

const latest = (os: TaskOccurrence[]) =>
  [...os].sort((a, b) => (b.completedAt ?? b.scheduledFor).localeCompare(a.completedAt ?? a.scheduledFor))[0];

/**
 * One row per quest definition for the Quests tab, filtered by type and by a search over the
 * title and the linked goal's title. A repeating quest stays in the library after each log.
 */
export function questLibrary(s: Snapshot, today: LocalDate, filter: LibraryFilter = 'all', query = ''): QuestLibrary {
  const goals = new Map(s.goals.map((g) => [g.id, g.title]));
  const byTask = new Map<string, TaskOccurrence[]>();
  for (const o of s.occurrences) byTask.set(o.taskDefinitionId, [...(byTask.get(o.taskDefinitionId) ?? []), o]);
  const out: QuestLibrary = { active: [], completed: [], archived: [] };
  for (const task of s.tasks) {
    if (filter !== 'all' && task.taskType !== filter) continue;
    if (!matchesAll(`${task.title} ${task.goalId ? (goals.get(task.goalId) ?? '') : ''}`, query)) continue;
    const os = byTask.get(task.id) ?? [];
    const open = os.filter((o) => o.status === 'open').sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor))[0];
    const shown = (task.active && open) || latest(os.filter((o) => o.status === 'completed')) || latest(os)
      || { id: `none-${task.id}`, taskDefinitionId: task.id, scheduledFor: task.dueAt, status: 'skipped' as const };
    const item = questItem(s, shown, task, today);
    if (!task.active) out.archived.push(item);
    else if (open) out.active.push(item);
    else out.completed.push(item);
  }
  out.active.sort(byDue);
  out.completed.sort((a, b) => (b.occurrence.completedAt ?? '').localeCompare(a.occurrence.completedAt ?? ''));
  out.archived.sort((a, b) => b.task.updatedAt.localeCompare(a.task.updatedAt));
  return out;
}

// ---------------------------------------------------------------- Today progress ring (addendum A4 §2)

export interface TodayProgress {
  /** Distinct quests of this type logged today (the first log of a quest counts; more logs don't). */
  logged: number;
  /** Distinct quests available to log today or logged today. */
  total: number;
  /** Quests still to log today. */
  left: number;
}

/**
 * The ring above Today's list: distinct quests of the tab's type that are available to log today
 * (due or overdue, quota not yet met) or were logged on the current local date.
 */
export function todayProgress(s: Snapshot, today: LocalDate, type: TaskType): TodayProgress {
  const board = questBoard(s, today, 'today', type);
  const types = new Map(s.tasks.map((t) => [t.id, t.taskType]));
  const logged = new Set(
    s.occurrences
      .filter((o) => o.status === 'completed' && o.completedOn === today && types.get(o.taskDefinitionId) === type)
      .map((o) => o.taskDefinitionId),
  );
  const all = new Set([...board.overdue, ...board.todo].map((i) => i.task.id).concat([...logged]));
  return { logged: logged.size, total: all.size, left: all.size - logged.size };
}

export function completedTodayCount(s: Snapshot, today: LocalDate): number {
  return s.occurrences.filter((o) => o.status === 'completed' && o.completedOn === today).length;
}

// ---------------------------------------------------------------- roadmap

export interface GoalProgress {
  done: number;
  total: number;
  /** 0..1 */
  ratio: number;
}

/**
 * Progress = completed units / units, where units are the goal's milestones plus its linked
 * one-off main tasks. Repeating tasks build habits and never "finish", so they are excluded.
 * Weighting is an open decision (spec §11); this is the equal-weight default.
 */
export function goalProgress(s: Snapshot, goalId: string): GoalProgress {
  const milestones = s.milestones.filter((m) => m.goalId === goalId);
  const oneOffs = s.tasks.filter((t) => t.goalId === goalId && !t.recurrence && !t.window && t.taskType === 'main');
  const oneOffIds = new Set(oneOffs.map((t) => t.id));
  const doneTasks = new Set(
    s.occurrences.filter((o) => oneOffIds.has(o.taskDefinitionId) && o.status === 'completed').map((o) => o.taskDefinitionId),
  );
  const activeOneOffs = oneOffs.filter((t) => t.active || doneTasks.has(t.id));
  const done = milestones.filter((m) => m.completedAt).length + activeOneOffs.filter((t) => doneTasks.has(t.id)).length;
  const total = milestones.length + activeOneOffs.length;
  return { done, total, ratio: total === 0 ? 0 : done / total };
}

export function sortedMilestones(s: Snapshot, goalId: string): Milestone[] {
  return s.milestones.filter((m) => m.goalId === goalId).sort((a, b) => a.order - b.order);
}

export interface NextMilestone {
  goal: Goal;
  milestone: Milestone;
}

/** The first unfinished milestone across active goals, preferring the earliest due date. */
export function nextMilestone(s: Snapshot): NextMilestone | undefined {
  const goals = new Map(s.goals.filter((g) => g.status === 'active').map((g) => [g.id, g]));
  const candidates = s.milestones
    .filter((m) => !m.completedAt && goals.has(m.goalId))
    .sort((a, b) => (a.dueAt ?? '9999').localeCompare(b.dueAt ?? '9999') || a.order - b.order);
  const m = candidates[0];
  return m ? { goal: goals.get(m.goalId)!, milestone: m } : undefined;
}

// ---------------------------------------------------------------- side-quest warning (addendum A4 §2, Today tabs)

/** `overdue`: a deadline has passed (red). `soon`: the deadline is inside the quest's warning period (amber). */
export type DeadlineLevel = 'overdue' | 'soon';

/** Side quests without their own setting warn from the day before ("today or tomorrow"). */
export const DEFAULT_WARNING_DAYS = 1;

/** How many days before its deadline a side quest starts warning (`reminderDaysBefore`, e.g. 14 for an oil change). */
export const warningDays = (task: Pick<TaskDefinition, 'reminderDaysBefore'>) => task.reminderDaysBefore ?? DEFAULT_WARNING_DAYS;

/** Red once the deadline has passed; amber from `warningDays` before it; nothing before that or without a deadline. */
export function deadlineLevel(i: QuestItem, today: LocalDate): DeadlineLevel | undefined {
  const d = questDeadline(i, today);
  if (!d) return undefined;
  if (d < today) return i.undated ? undefined : 'overdue';
  return d <= addPeriod(today, 'day', warningDays(i.task)) ? 'soon' : undefined;
}

/**
 * The last day an open quest can be done on time: the end date of a date range, the end of the
 * active period for an unfinished repeating quota, otherwise the occurrence's due date.
 * Undefined when there is nothing left to do (a quota already met) or the quest has no due date.
 */
export function questDeadline(i: QuestItem, today: LocalDate): LocalDate | undefined {
  const { task, occurrence: o, quota } = i;
  if (i.undated) {
    // A repeating quest without a due date: the end of the current period is the last chance this
    // time round. Done for this period (waiting for the next one) or daily: no deadline.
    if (!canWarn(task) || !quota || !isQuota(task.recurrence) || o.scheduledFor > today || quota.done >= quota.times) return undefined;
    return periodContaining(task.recurrence, task.dueAt, today).end;
  }
  if (task.window) return quota && quota.done >= quota.times ? undefined : task.window.end;
  if (quota && isQuota(task.recurrence)) {
    // Target met: the quest waits for its next period, whose end is the next deadline.
    if (o.scheduledFor > today) return periodContaining(task.recurrence, task.dueAt, o.scheduledFor).end;
    return quota.done >= quota.times ? undefined : periodContaining(task.recurrence, task.dueAt, today).end;
  }
  return o.scheduledFor;
}

export interface DeadlineWarning {
  /** The worse state across open side quests; red wins over amber. */
  level?: DeadlineLevel;
  /** Open side quests whose deadline has passed. */
  overdue: number;
  /** Open side quests inside their warning period. */
  soon: number;
}

/** The Side quests tab indicator. Completed and archived quests are ignored (only open, active ones count). */
export function sideQuestWarning(s: Snapshot, today: LocalDate): DeadlineWarning {
  let overdue = 0;
  let soon = 0;
  for (const i of sideQuests(s, today)) {
    if (i.warning === 'overdue') overdue++;
    else if (i.warning === 'soon') soon++;
  }
  return { level: overdue ? 'overdue' : soon ? 'soon' : undefined, overdue, soon };
}
