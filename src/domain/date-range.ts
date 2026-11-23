/**
 * The Choose dates calendar (addendum A3 §7): a Monday-first month grid and two-tap range picking.
 * Pure helpers so the dialog's rules are testable.
 */
import { addPeriod, fromLocalDate } from './dates';
import type { LocalDate } from './types';

export interface DraftRange {
  start?: LocalDate;
  end?: LocalDate;
}

/** First day of the month containing `date`. */
export function monthOf(date: LocalDate): LocalDate {
  return `${date.slice(0, 7)}-01`;
}

/** The month's days in Monday-first weeks; `null` pads days outside the month. */
export function monthGrid(month: LocalDate): (LocalDate | null)[][] {
  const first = monthOf(month);
  const lead = (fromLocalDate(first).getDay() + 6) % 7; // Monday = 0
  const next = addPeriod(first, 'month', 1);
  const days: (LocalDate | null)[] = Array.from({ length: lead }, () => null);
  for (let d = first; d < next; d = addPeriod(d, 'day', 1)) days.push(d);
  while (days.length % 7) days.push(null);
  const weeks: (LocalDate | null)[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return weeks;
}

/**
 * One tap on a day. The first tap starts a draft; the second completes it, putting the dates in
 * order (the same day twice is a single day); a tap after both are set starts a new draft.
 */
export function pickDay(draft: DraftRange, day: LocalDate): DraftRange {
  if (!draft.start || draft.end) return { start: day };
  return day < draft.start ? { start: day, end: draft.start } : { start: draft.start, end: day };
}

/** Where a day sits relative to the draft, for drawing circles and the band between them. */
export function dayRole(draft: DraftRange, day: LocalDate): 'start' | 'end' | 'single' | 'between' | undefined {
  const { start, end } = draft;
  if (!start) return undefined;
  if (!end) return day === start ? 'single' : undefined;
  if (day === start && day === end) return 'single';
  if (day === start) return 'start';
  if (day === end) return 'end';
  return day > start && day < end ? 'between' : undefined;
}

