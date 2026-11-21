import { differenceInCalendarMonths, startOfWeek } from 'date-fns';

import { addPeriod, daysBetween, fromLocalDate, toLocalDate } from './dates';
import type { LocalDate, RecurrenceRule } from './types';

export const isQuota = (rule: RecurrenceRule | undefined): rule is RecurrenceRule & { timesPerPeriod: number } =>
  !!rule && typeof rule.timesPerPeriod === 'number' && rule.timesPerPeriod >= 1;

export interface Period {
  /** First day, inclusive. */
  start: LocalDate;
  /** Last day, inclusive. */
  end: LocalDate;
}

/** Grid origin for quota periods: Monday of the anchor's week, the 1st of its month or year, or the anchor day. */
function periodOrigin(rule: RecurrenceRule, anchor: LocalDate): LocalDate {
  const d = fromLocalDate(anchor);
  switch (rule.frequency) {
    case 'day':
      return anchor;
    case 'week':
      return toLocalDate(startOfWeek(d, { weekStartsOn: 1 }));
    case 'month':
      return toLocalDate(new Date(d.getFullYear(), d.getMonth(), 1));
    case 'year':
      return toLocalDate(new Date(d.getFullYear(), 0, 1));
  }
}

/** The calendar-aligned period (e.g. Mon–Sun week) of a quota rule that contains `date`. */
export function periodContaining(rule: RecurrenceRule, anchor: LocalDate, date: LocalDate): Period {
  const interval = Math.max(1, Math.floor(rule.interval));
  const origin = periodOrigin(rule, anchor);
  let units: number;
  if (rule.frequency === 'day') units = daysBetween(origin, date);
  else if (rule.frequency === 'week') units = Math.floor(daysBetween(origin, date) / 7);
  else {
    const months = differenceInCalendarMonths(fromLocalDate(date), fromLocalDate(origin));
    units = rule.frequency === 'month' ? months : Math.floor(months / 12);
  }
  const k = Math.floor(units / interval);
  const start = addPeriod(origin, rule.frequency, k * interval);
  const next = addPeriod(origin, rule.frequency, (k + 1) * interval);
  return { start, end: addPeriod(next, 'day', -1) };
}

/**
 * Where a quota quest goes after one is completed on `finishedOn`, given how many are now done
 * in that period. It comes back tomorrow (or later today for one-day periods) until the target
 * is met, then waits for the next period. Missed ones are not carried over.
 */
export function nextQuotaDate(rule: RecurrenceRule, anchor: LocalDate, finishedOn: LocalDate, doneInPeriod: number): LocalDate {
  const period = periodContaining(rule, anchor, finishedOn);
  const nextPeriod = addPeriod(period.end, 'day', 1);
  if (doneInPeriod >= (rule.timesPerPeriod ?? 1)) return nextPeriod;
  const sameDayAllowed = rule.frequency === 'day' && Math.floor(rule.interval) <= 1;
  if (sameDayAllowed) return finishedOn;
  const tomorrow = addPeriod(finishedOn, 'day', 1);
  return tomorrow <= period.end ? tomorrow : nextPeriod;
}

/**
 * Next due date after an occurrence is completed (or skipped) on `completedOn`.
 *
 * - `completion`: interval counted from the completion day.
 * - `calendar`: stays on the grid anchored at `anchor` (the task's first due date);
 *   returns the first grid slot strictly after both the finished slot and the completion day,
 *   so missed slots are skipped rather than piling up.
 */
export function nextDueDate(
  rule: RecurrenceRule,
  anchor: LocalDate,
  scheduledFor: LocalDate,
  completedOn: LocalDate,
): LocalDate {
  const interval = Math.max(1, Math.floor(rule.interval));
  if (rule.anchorPolicy === 'completion') {
    return addPeriod(completedOn, rule.frequency, interval);
  }
  const floor = scheduledFor > completedOn ? scheduledFor : completedOn;
  // Computing each slot from the anchor avoids month-end drift (31 Jan -> 28 Feb -> 28 Mar).
  for (let k = 1; k < 100_000; k++) {
    const slot = addPeriod(anchor, rule.frequency, interval * k);
    if (slot > floor) return slot;
  }
  return addPeriod(floor, rule.frequency, interval);
}

export function describeRule(rule: RecurrenceRule | undefined): string {
  if (!rule) return 'One-off';
  if (isQuota(rule)) {
    const per = rule.interval === 1 ? rule.frequency : `${rule.interval} ${rule.frequency}s`;
    return `${rule.timesPerPeriod} time${rule.timesPerPeriod === 1 ? '' : 's'} per ${per}`;
  }
  const unit = rule.frequency;
  const every = rule.interval === 1 ? `Every ${unit}` : `Every ${rule.interval} ${unit}s`;
  return rule.anchorPolicy === 'calendar' ? `${every} (fixed schedule)` : `${every} after completion`;
}
