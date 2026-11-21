import { daysBetween } from './dates';
import type { Goal, LocalDate, Milestone, Snapshot, TaskDefinition, TaskOccurrence, TaskType } from './types';

export interface QuestItem {
  occurrence: TaskOccurrence;
  task: TaskDefinition;
  /** Days until due; negative = overdue. */
  dueInDays: number;
  overdue: boolean;
  /** Side quests: inside the reminder window. */
  reminderActive: boolean;
}

function toItem(o: TaskOccurrence, task: TaskDefinition, today: LocalDate): QuestItem {
  const dueInDays = daysBetween(today, o.scheduledFor);
  const reminder = task.reminderDaysBefore;
  return {
    occurrence: o,
    task,
    dueInDays,
    overdue: o.status === 'open' && dueInDays < 0,
    reminderActive: o.status === 'open' && reminder !== undefined && dueInDays >= 0 && dueInDays <= reminder,
  };
}

function join(s: Snapshot, filter: (o: TaskOccurrence) => boolean, today: LocalDate): QuestItem[] {
  const tasks = new Map(s.tasks.map((t) => [t.id, t]));
  const out: QuestItem[] = [];
  for (const o of s.occurrences) {
    const t = tasks.get(o.taskDefinitionId);
    if (t && filter(o)) out.push(toItem(o, t, today));
  }
  return out;
}

const byDue = (a: QuestItem, b: QuestItem) =>
  a.occurrence.scheduledFor.localeCompare(b.occurrence.scheduledFor) || a.task.title.localeCompare(b.task.title);

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
  const oneOffs = s.tasks.filter((t) => t.goalId === goalId && !t.recurrence && t.taskType === 'main');
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
