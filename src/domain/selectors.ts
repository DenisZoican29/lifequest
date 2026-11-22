import { doneInPeriod } from './commands';
import { format } from 'date-fns';

import { daysBetween, fromLocalDate } from './dates';
import { isQuota, periodContaining } from './recurrence';
import type { Goal, LocalDate, Milestone, Snapshot, TaskDefinition, TaskOccurrence, TaskType } from './types';

export interface QuestItem {
  occurrence: TaskOccurrence;
  task: TaskDefinition;
  /** Days until due; negative = overdue. */
  dueInDays: number;
  overdue: boolean;
  /** Side quests: inside the reminder window. */
  reminderActive: boolean;
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

function toItem(s: Snapshot, o: TaskOccurrence, task: TaskDefinition, today: LocalDate): QuestItem {
  const dueInDays = daysBetween(today, o.scheduledFor);
  const reminder = task.reminderDaysBefore;
  const quota = quotaProgress(s, task, today);
  return {
    occurrence: o,
    task,
    dueInDays,
    quota,
    // A quota quest left open from an earlier period just carries on in the current one.
    overdue: o.status === 'open' && dueInDays < 0 && !quota,
    reminderActive: o.status === 'open' && reminder !== undefined && dueInDays >= 0 && dueInDays <= reminder,
  };
}

function join(s: Snapshot, filter: (o: TaskOccurrence) => boolean, today: LocalDate): QuestItem[] {
  const tasks = new Map(s.tasks.map((t) => [t.id, t]));
  const out: QuestItem[] = [];
  for (const o of s.occurrences) {
    const t = tasks.get(o.taskDefinitionId);
    if (t && filter(o)) out.push(toItem(s, o, t, today));
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
