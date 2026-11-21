import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  differenceInCalendarDays,
  format,
  isValid,
  parse,
} from 'date-fns';

import type { LocalDate, RecurrenceFrequency } from './types';

const FORMAT = 'yyyy-MM-dd';

/**
 * The single source of "now" for the app. The POC can shift it by whole days
 * to simulate tomorrow without touching the PC clock (spec §7).
 */
export interface Clock {
  now(): Date;
  today(): LocalDate;
}

export function createClock(dayOffset: number, base: () => Date = () => new Date()): Clock {
  const now = () => addDays(base(), dayOffset);
  return { now, today: () => toLocalDate(now()) };
}

export function toLocalDate(d: Date): LocalDate {
  return format(d, FORMAT);
}

/** Parses `YYYY-MM-DD` as local midnight. */
export function fromLocalDate(s: LocalDate): Date {
  return parse(s, FORMAT, new Date(2000, 0, 1));
}

export function isLocalDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && isValid(fromLocalDate(s)) && toLocalDate(fromLocalDate(s)) === s;
}

export function addPeriod(date: LocalDate, frequency: RecurrenceFrequency, amount: number): LocalDate {
  const d = fromLocalDate(date);
  switch (frequency) {
    case 'day':
      return toLocalDate(addDays(d, amount));
    case 'week':
      return toLocalDate(addWeeks(d, amount));
    case 'month':
      return toLocalDate(addMonths(d, amount));
    case 'year':
      return toLocalDate(addYears(d, amount));
  }
}

/** b - a in calendar days. */
export function daysBetween(a: LocalDate, b: LocalDate): number {
  return differenceInCalendarDays(fromLocalDate(b), fromLocalDate(a));
}

export function formatFriendly(date: LocalDate, today: LocalDate): string {
  const diff = daysBetween(today, date);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff < 0) return `${-diff} days overdue`;
  if (diff < 7) return format(fromLocalDate(date), 'EEEE');
  return format(fromLocalDate(date), 'd MMM yyyy');
}
