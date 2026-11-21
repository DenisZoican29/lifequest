import { addPeriod } from './dates';
import type { LocalDate, RecurrenceRule } from './types';

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
  const unit = rule.frequency;
  const every = rule.interval === 1 ? `Every ${unit}` : `Every ${rule.interval} ${unit}s`;
  return rule.anchorPolicy === 'calendar' ? `${every} (fixed schedule)` : `${every} after completion`;
}
