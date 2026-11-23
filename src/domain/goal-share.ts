/**
 * Goals overview: how your effort splits across goals (spec addendum A3, docs/spec-goals-overview.md).
 *
 * Effort = quests done (completions of main quests linked to the goal) in the chosen range.
 * Every goal that isn't archived takes part, so a goal with nothing done shows as 0%.
 */
import { addPeriod } from './dates';
import type { Goal, GoalStatus, LocalDate, Snapshot } from './types';

/** Rolling windows ending today, all history, or two chosen days (both included). */
export type ShareRange = '7d' | '4w' | 'all' | { from: LocalDate; to: LocalDate };

/** The overview's default "recent" range, matching the status window. */
export const SHARE_WINDOW_DAYS = 28;

/**
 * First and last day a range counts (A3 §7): 7 or 28 local calendar days including today; custom
 * dates include both ends (never past today); all time has no first day.
 */
export function rangeBounds(range: ShareRange, today: LocalDate): { from?: LocalDate; to: LocalDate } {
  if (range === '7d') return { from: addPeriod(today, 'day', -6), to: today };
  if (range === '4w') return { from: addPeriod(today, 'day', -(SHARE_WINDOW_DAYS - 1)), to: today };
  if (range === 'all') return { to: today };
  const [a, b] = range.from <= range.to ? [range.from, range.to] : [range.to, range.from];
  return { from: a, to: b > today ? today : b };
}

export interface GoalShare {
  goal: Goal;
  /** Colour slot: the goal's place by creation date, so a goal keeps its colour whatever the range or ranking. */
  slot: number;
  /** Quests done in the range. */
  done: number;
  coins: number;
  /** done / total, 0..1 (0 when nothing was done). */
  share: number;
  /** Whole percentages that add up to 100 across the parts (largest remainder). */
  percent: number;
}

export interface GoalShareOverview {
  /** Largest share first; ties keep creation order. */
  parts: GoalShare[];
  /** Quests done across all goals in the range. */
  total: number;
  coins: number;
  /** Main quests done in the range that aren't linked to any goal (not part of the split). */
  unlinkedDone: number;
  /** First day of the range, or undefined for all time. */
  from?: LocalDate;
  /** Last day of the range. */
  to: LocalDate;
}

/** Colours in the goal palette (`series` in the theme). Slots from here on show as a neutral. */
export const GOAL_COLOR_COUNT = 7;

/**
 * Each non-archived goal's colour slot, stable across screens and ranges. A goal with a chosen
 * colour uses it; the others take the colours nobody chose, in creation order. When those run
 * out, the rest get slots past the palette (shown as a neutral).
 */
export function goalSlots(s: Snapshot): Map<string, number> {
  const goals = s.goals
    .filter((g) => g.status !== 'archived')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  const chosen = (g: Goal) => (Number.isInteger(g.color) && g.color! >= 0 && g.color! < GOAL_COLOR_COUNT ? g.color : undefined);
  const taken = new Set(goals.map(chosen).filter((c) => c !== undefined));
  const free = Array.from({ length: GOAL_COLOR_COUNT }, (_, i) => i).filter((i) => !taken.has(i));
  let next = 0;
  return new Map(goals.map((g) => {
    const c = chosen(g);
    if (c !== undefined) return [g.id, c];
    const slot = next < free.length ? free[next] : GOAL_COLOR_COUNT + (next - free.length);
    next++;
    return [g.id, slot];
  }));
}

/**
 * `only` limits the split to goals with that status (Roadmap's Active view uses 'active').
 * Colour slots still come from every non-archived goal, so colours never shift between views.
 */
export function goalShares(s: Snapshot, today: LocalDate, range: ShareRange, only?: GoalStatus): GoalShareOverview {
  const { from, to } = rangeBounds(range, today);
  const slots = goalSlots(s);
  const goals = s.goals.filter((g) => slots.has(g.id) && (!only || g.status === only)).sort((a, b) => slots.get(a.id)! - slots.get(b.id)!);
  const goalOf = new Map<string, string | undefined>(s.tasks.filter((t) => t.taskType === 'main').map((t) => [t.id, t.goalId]));

  const done = new Map<string, number>();
  const doneIds = new Map<string, string>(); // occurrence id → goal id
  let unlinkedDone = 0;
  for (const o of s.occurrences) {
    if (o.status !== 'completed' || !o.completedOn || o.completedOn > to) continue;
    if (from && o.completedOn < from) continue;
    if (!goalOf.has(o.taskDefinitionId)) continue; // side quests
    const goalId = goalOf.get(o.taskDefinitionId);
    if (!goalId) {
      unlinkedDone++;
      continue;
    }
    done.set(goalId, (done.get(goalId) ?? 0) + 1);
    doneIds.set(o.id, goalId);
  }
  const coins = new Map<string, number>();
  for (const t of s.wallet) {
    if (t.kind !== 'earn' || t.sourceType !== 'occurrence') continue;
    const goalId = doneIds.get(t.sourceId);
    if (goalId) coins.set(goalId, (coins.get(goalId) ?? 0) + t.coinDelta);
  }

  const total = goals.reduce((a, g) => a + (done.get(g.id) ?? 0), 0);
  const parts = goals.map((goal) => {
    const n = done.get(goal.id) ?? 0;
    return { goal, slot: slots.get(goal.id)!, done: n, coins: coins.get(goal.id) ?? 0, share: total ? n / total : 0, percent: 0 };
  });
  assignPercents(parts, total);
  parts.sort((a, b) => b.done - a.done || a.slot - b.slot);

  return { parts, total, coins: parts.reduce((a, p) => a + p.coins, 0), unlinkedDone, from, to };
}

/** Largest-remainder rounding, so the shown percentages always add up to exactly 100. */
function assignPercents(parts: GoalShare[], total: number) {
  if (!total) return;
  const raw = parts.map((p) => (p.done / total) * 100);
  parts.forEach((p, i) => (p.percent = Math.floor(raw[i])));
  let left = 100 - parts.reduce((a, p) => a + p.percent, 0);
  const order = parts.map((_, i) => i).sort((a, b) => raw[b] - Math.floor(raw[b]) - (raw[a] - Math.floor(raw[a])) || parts[a].slot - parts[b].slot);
  for (const i of order) {
    if (left <= 0) break;
    if (parts[i].done === 0) continue;
    parts[i].percent++;
    left--;
  }
}
