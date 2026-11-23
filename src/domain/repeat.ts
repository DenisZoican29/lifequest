import { format } from 'date-fns';

import { fromLocalDate, isLocalDate } from './dates';
import type { AnchorPolicy, LocalDate, RecurrenceFrequency, RecurrenceRule, TargetWindow } from './types';

/** Quest schedule: Once, or Repeating ("every N days/weeks/months/years", or N times between two dates). */
export type RepeatMode = 'once' | 'repeating';

/** Form state for "how often". Numbers stay strings so the fields can be edited freely. */
export interface RepeatValue {
  mode: RepeatMode;
  /** Repeating: how many times per period. */
  times: string;
  /** Repeating: period length, e.g. 2 for "every 2 weeks". */
  every: string;
  unit: RecurrenceFrequency;
  /** Repeating with 1 time per period: when the next one is due. */
  anchor: AnchorPolicy;
  /** Repeating: every period (default), or N times between the start date and `end`. */
  span?: 'repeat' | 'dates';
  /** "Between dates": last day, `YYYY-MM-DD`. */
  end?: string;
}

export function repeatFromRule(rule: RecurrenceRule | undefined, window?: TargetWindow): RepeatValue {
  // Switching to Repeating starts at "every 1 day".
  const base: RepeatValue = { mode: 'once', times: '1', every: '1', unit: 'day', anchor: 'completion' };
  if (window) return { ...base, mode: 'repeating', span: 'dates', times: String(window.times), end: window.end };
  if (!rule) return base;
  const anchor = rule.timesPerPeriod ? 'completion' : rule.anchorPolicy;
  return { mode: 'repeating', times: String(rule.timesPerPeriod ?? 1), every: String(rule.interval), unit: rule.frequency, anchor };
}

/**
 * 1 time per period is a classic repeat (due again N units later or on a fixed grid);
 * 2+ times is a "times per period" quota with calendar-aligned periods.
 */
export function ruleFromRepeat(v: RepeatValue): RecurrenceRule | undefined {
  if (v.mode === 'once' || isDates(v)) return undefined;
  const times = Number(v.times);
  const interval = Number(v.every);
  if (times === 1) return { frequency: v.unit, interval, anchorPolicy: v.anchor };
  return { frequency: v.unit, interval, anchorPolicy: 'calendar', timesPerPeriod: times };
}

export const isDates = (v: RepeatValue) => v.mode === 'repeating' && v.span === 'dates';

/** "N times between start and end", or undefined for every other choice. */
export function windowFromRepeat(v: RepeatValue, start: LocalDate): TargetWindow | undefined {
  if (!isDates(v)) return undefined;
  return { start, end: v.end ?? '', times: Number(v.times) };
}

const short = (d: string | undefined) => (d && isLocalDate(d) ? format(fromLocalDate(d), 'd MMM') : '…');

export const plural = (n: string, word: string) => (n === '1' ? word : `${word}s`);

/** "3 times a week", "once every 2 months", "4 times between 20 Nov and 1 Dec". */
export function repeatSummary(v: RepeatValue, start?: string): string {
  if (v.mode === 'once') return 'Just once';
  if (!isDates(v) && v.every === '1' && v.unit === 'day' && v.times === '1') return 'Every day';
  if (isDates(v)) return `${v.times === '1' ? 'Once' : `${v.times || 'N'} times`} between ${short(start)} and ${short(v.end)}`;
  const times = v.times === '1' ? 'Once' : `${v.times || 'N'} times`;
  const per = v.every === '1' ? `a ${v.unit}` : `every ${v.every || 'N'} ${v.unit}s`;
  return `${times} ${per}`;
}
