/**
 * Goal status from how well its linked quests are kept (spec addendum A1, docs/spec-goals-roadmap.md).
 *
 * Every linked quest is a plan: "3 times a week" means 3 per Mon–Sun week, "every day" means
 * 1 per day, a one-off means 1 by its due date. Each of the quest's periods scores
 * min(done, target) / target. A period only counts once it is over, except that a period
 * already kept counts early (and a multi-day one that can no longer be kept counts as missed).
 * Partial periods (the quest started or was archived mid-period) only count when kept,
 * so starting on a Saturday never makes you look behind.
 */
import { startOfWeek } from 'date-fns';

import { addPeriod, daysBetween, fromLocalDate, toLocalDate } from './dates';
import { periodContaining } from './recurrence';
import type { Goal, LocalDate, Snapshot, TaskDefinition } from './types';

/** At or above: on track. */
export const ON_TRACK = 0.8;
/** At or above (and below ON_TRACK): needs a push. Below: falling behind. */
export const NEEDS_PUSH = 0.5;
/** Status looks at the last four weeks. */
export const WINDOW_DAYS = 28;
/** Charts show up to twelve weeks... */
export const HISTORY_WEEKS = 12;
/** ...and at least six, so a new goal's chart isn't one fat bar. */
export const MIN_WEEKS = 6;
/** No verdict until quests have run this long (unless already on track). */
const SETTLE_DAYS = 7;

export type GoalHealth =
  | 'on-track'
  | 'needs-push'
  | 'falling-behind'
  | 'getting-started'
  | 'no-quests'
  | 'past-deadline'
  | 'completed'
  | 'archived';

export interface PlanPeriod {
  start: LocalDate;
  end: LocalDate;
  target: number;
  done: number;
  /** min(done, target). */
  kept: number;
  /** The day this period is filed under: its last day, or today if it counted early. */
  on: LocalDate;
}

export interface QuestStanding {
  task: TaskDefinition;
  /** Sum of kept / planned over the status window. */
  kept: number;
  planned: number;
  /** kept / planned, or null when nothing was due yet. */
  ratio: number | null;
}

export interface WeekStanding {
  /** Monday. */
  start: LocalDate;
  /** Mean of the linked quests' scores for periods filed in this week; null when nothing was due. */
  ratio: number | null;
  kept: number;
  planned: number;
  current: boolean;
}

export interface DayActivity {
  date: LocalDate;
  count: number;
  future: boolean;
  /** Before the goal (or its earliest quest) began: not a missed day. */
  beforeStart: boolean;
}

export interface GoalInsights {
  health: GoalHealth;
  /** 0..1 over the last four weeks, or null before anything was due. */
  consistency: number | null;
  quests: QuestStanding[];
  /** Oldest first; the last entry is the current week. From the first week (at least MIN_WEEKS, at most HISTORY_WEEKS). */
  weeks: WeekStanding[];
  /** HISTORY_WEEKS × 7 days, Monday-aligned, oldest first. */
  days: DayActivity[];
  /** Weeks in a row on track (≥ 80%). Weeks with nothing due neither count nor break it. */
  streak: number;
  bestStreak: number;
  totalDone: number;
  activeDays: number;
  coinsEarned: number;
  start: LocalDate;
  deadline?: LocalDate;
  /** Negative once the deadline has passed. */
  daysLeft?: number;
  /** Share of the time from start to deadline already used, 0..1. */
  timeUsed?: number;
}

const localDateOf = (iso: string): LocalDate => toLocalDate(new Date(iso));
const monday = (d: LocalDate): LocalDate => toLocalDate(startOfWeek(fromLocalDate(d), { weekStartsOn: 1 }));
const minDate = (a: LocalDate, b: LocalDate) => (a < b ? a : b);
const maxDate = (a: LocalDate, b: LocalDate) => (a > b ? a : b);
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** Periods longer than the status window: fall back to the latest one. */
function isLongRule(task: TaskDefinition): boolean {
  if (task.window) return daysBetween(task.window.start, task.window.end) + 1 > WINDOW_DAYS;
  const r = task.recurrence;
  if (!r) return true;
  const days = r.interval * { day: 1, week: 7, month: 30, year: 365 }[r.frequency];
  return days > WINDOW_DAYS;
}

/** Counted plan periods of one quest, oldest first. `completions` are sorted local dates ≤ `end`. */
export function questPeriods(task: TaskDefinition, completions: LocalDate[], today: LocalDate, end: LocalDate): PlanPeriod[] {
  const created = localDateOf(task.createdAt);
  const activeFrom = minDate(maxDate(created, task.dueAt), completions[0] ?? '9999-12-31');
  const activeTo = minDate(end, task.active ? end : localDateOf(task.updatedAt));
  if (activeFrom > activeTo) return [];

  if (task.window) {
    // One plan for the whole window: counts once it's over, kept, or can no longer be kept.
    const w = task.window;
    const done = completions.filter((c) => c >= w.start && c <= w.end).length;
    const kept = Math.min(done, w.times);
    const over = w.end < today && w.end <= end;
    const current = w.start <= today && today <= w.end;
    const lost = current && task.active && w.times - done > daysBetween(today, w.end) + 1;
    if (!task.active && kept < w.times) return [];
    if (over || kept >= w.times || lost) return [{ start: w.start, end: w.end, target: w.times, done, kept, on: minDate(w.end, today) }];
    return [];
  }

  if (!task.recurrence) {
    const c = completions[0];
    if (c) return [{ start: activeFrom, end: task.dueAt, target: 1, done: 1, kept: 1, on: c }];
    if (task.active && task.dueAt < today && task.dueAt <= end) {
      return [{ start: activeFrom, end: task.dueAt, target: 1, done: 0, kept: 0, on: task.dueAt }];
    }
    return [];
  }

  const rule = task.recurrence;
  const target = rule.timesPerPeriod ?? 1;
  const multiDay = !(rule.frequency === 'day' && rule.interval <= 1);
  const out: PlanPeriod[] = [];
  let cursor = activeFrom;
  for (let guard = 0; cursor <= activeTo && guard < 20_000; guard++) {
    const p = periodContaining(rule, task.dueAt, cursor);
    const done = completions.filter((c) => c >= p.start && c <= p.end).length;
    const kept = Math.min(done, target);
    const whole = p.start >= activeFrom && p.end <= activeTo && p.end < today;
    const current = p.start <= today && today <= p.end;
    const lost = current && multiDay && task.active && p.start >= activeFrom && target - done > daysBetween(today, p.end) + 1;
    if (whole || kept >= target || lost) {
      out.push({ start: p.start, end: p.end, target, done, kept, on: minDate(p.end, today) });
    }
    cursor = addPeriod(p.end, 'day', 1);
  }
  return out;
}

function standing(task: TaskDefinition, periods: PlanPeriod[]): QuestStanding {
  const kept = periods.reduce((a, p) => a + p.kept, 0);
  const planned = periods.reduce((a, p) => a + p.target, 0);
  return { task, kept, planned, ratio: planned ? kept / planned : null };
}

/** Mean of per-quest scores, so a quest done 8× a day doesn't drown out one done 3× a week. */
function weekOf(per: { periods: PlanPeriod[] }[], start: LocalDate, current: boolean): WeekStanding {
  const end = addPeriod(start, 'day', 6);
  let kept = 0;
  let planned = 0;
  const ratios: number[] = [];
  for (const q of per) {
    const ps = q.periods.filter((p) => p.on >= start && p.on <= end);
    if (!ps.length) continue;
    const k = ps.reduce((a, p) => a + p.kept, 0);
    const t = ps.reduce((a, p) => a + p.target, 0);
    kept += k;
    planned += t;
    ratios.push(k / t);
  }
  return { start, ratio: mean(ratios), kept, planned, current };
}

export function healthOf(goal: Goal, today: LocalDate, consistency: number | null, hasQuests: boolean, settled: boolean): GoalHealth {
  if (goal.status === 'completed') return 'completed';
  if (goal.status === 'archived') return 'archived';
  if (goal.deadline && today > goal.deadline) return 'past-deadline';
  if (!hasQuests) return 'no-quests';
  if (consistency === null) return 'getting-started';
  if (consistency >= ON_TRACK) return 'on-track';
  if (!settled) return 'getting-started';
  return consistency >= NEEDS_PUSH ? 'needs-push' : 'falling-behind';
}

export function goalInsights(s: Snapshot, goal: Goal, today: LocalDate): GoalInsights {
  const start = localDateOf(goal.createdAt);
  const end = goal.status === 'active' ? today : maxDate(start, minDate(today, localDateOf(goal.updatedAt)));
  const tasks = s.tasks.filter((t) => t.goalId === goal.id && t.taskType === 'main');
  const taskIds = new Set(tasks.map((t) => t.id));
  const occ = s.occurrences.filter((o) => taskIds.has(o.taskDefinitionId));
  const done = occ.filter((o) => o.status === 'completed' && o.completedOn && o.completedOn <= end);

  const winStart = addPeriod(end, 'day', -(WINDOW_DAYS - 1));
  const per = tasks.map((task) => {
    const completions = done
      .filter((o) => o.taskDefinitionId === task.id)
      .map((o) => o.completedOn!)
      .sort();
    const periods = questPeriods(task, completions, today, end);
    let recent = periods.filter((p) => p.on >= winStart);
    if (!recent.length && periods.length && isLongRule(task)) recent = periods.slice(-1);
    return { task, periods, recent, firstDay: periods[0]?.start ?? completions[0] };
  });

  const quests = per.filter((q) => q.task.active || q.periods.length).map((q) => standing(q.task, q.recent));
  const consistency = mean(quests.flatMap((q) => (q.ratio === null ? [] : [q.ratio])));

  // Weeks: every week since the goal began (for streaks), the last HISTORY_WEEKS for the chart.
  const thisWeek = monday(end);
  const firstWeek = minDate(monday(start), addPeriod(thisWeek, 'week', -(HISTORY_WEEKS - 1)));
  const allWeeks: WeekStanding[] = [];
  for (let w = firstWeek, i = 0; w <= thisWeek && i < 1040; w = addPeriod(w, 'week', 1), i++) {
    allWeeks.push(weekOf(per, w, w === thisWeek));
  }
  const firstDay = per.map((q) => q.firstDay).filter((d): d is string => !!d).sort()[0];
  const began = firstDay && firstDay < start ? firstDay : start;
  const sinceStart = allWeeks.filter((w) => w.start >= monday(began)).length;
  const weeks = allWeeks.slice(-Math.min(HISTORY_WEEKS, Math.max(MIN_WEEKS, sinceStart)));

  let streak = 0;
  for (let i = allWeeks.length - 1; i >= 0; i--) {
    const r = allWeeks[i].ratio;
    if (r === null) continue;
    if (r >= ON_TRACK) streak++;
    else if (!allWeeks[i].current) break;
  }
  let bestStreak = 0;
  let run = 0;
  for (const w of allWeeks) {
    if (w.ratio === null) continue;
    if (w.ratio >= ON_TRACK) bestStreak = Math.max(bestStreak, ++run);
    else if (!w.current) run = 0;
  }

  const perDay = new Map<string, number>();
  for (const o of done) perDay.set(o.completedOn!, (perDay.get(o.completedOn!) ?? 0) + 1);
  const gridStart = addPeriod(thisWeek, 'week', -(HISTORY_WEEKS - 1));
  const days: DayActivity[] = Array.from({ length: HISTORY_WEEKS * 7 }, (_, i) => {
    const date = addPeriod(gridStart, 'day', i);
    return { date, count: perDay.get(date) ?? 0, future: date > end, beforeStart: date < began };
  });

  const doneIds = new Set(done.map((o) => o.id));
  const coinsEarned = s.wallet
    .filter((t) => t.kind === 'earn' && t.sourceType === 'occurrence' && doneIds.has(t.sourceId))
    .reduce((a, t) => a + t.coinDelta, 0);

  const settled = !!firstDay && daysBetween(firstDay, end) >= SETTLE_DAYS;
  const hasQuests = tasks.some((t) => t.active) || done.length > 0;

  const daysLeft = goal.deadline ? daysBetween(today, goal.deadline) : undefined;
  const span = goal.deadline ? Math.max(1, daysBetween(start, goal.deadline)) : 0;
  return {
    health: healthOf(goal, today, consistency, hasQuests, settled),
    consistency,
    quests,
    weeks,
    days,
    streak,
    bestStreak,
    totalDone: done.length,
    activeDays: perDay.size,
    coinsEarned,
    start,
    deadline: goal.deadline,
    daysLeft,
    timeUsed: goal.deadline ? Math.max(0, Math.min(1, daysBetween(start, today) / span)) : undefined,
  };
}
