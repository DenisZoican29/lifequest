import type { AnchorPolicy, RecurrenceFrequency, RecurrenceRule } from './types';

/** Quest "Repeat" picker: Every day / Just once / Custom. */
export type RepeatMode = 'once' | 'daily' | 'custom';

/** Form state for "how often". Numbers stay strings so the fields can be edited freely. */
export interface RepeatValue {
  mode: RepeatMode;
  /** Custom: how many times per period. */
  times: string;
  /** Custom: period length, e.g. 2 for "every 2 weeks". */
  every: string;
  unit: RecurrenceFrequency;
  /** Custom with 1 time per period: when the next one is due. */
  anchor: AnchorPolicy;
}

export function repeatFromRule(rule: RecurrenceRule | undefined): RepeatValue {
  const base: RepeatValue = { mode: 'once', times: '1', every: '1', unit: 'week', anchor: 'completion' };
  if (!rule) return base;
  const anchor = rule.timesPerPeriod ? 'completion' : rule.anchorPolicy;
  if (!rule.timesPerPeriod && rule.frequency === 'day' && rule.interval === 1) return { ...base, mode: 'daily', anchor };
  return { mode: 'custom', times: String(rule.timesPerPeriod ?? 1), every: String(rule.interval), unit: rule.frequency, anchor };
}

/**
 * 1 time per period is a classic repeat (due again N units later or on a fixed grid);
 * 2+ times is a "times per period" quota with calendar-aligned periods.
 */
export function ruleFromRepeat(v: RepeatValue): RecurrenceRule | undefined {
  if (v.mode === 'once') return undefined;
  if (v.mode === 'daily') return { frequency: 'day', interval: 1, anchorPolicy: v.anchor };
  const times = Number(v.times);
  const interval = Number(v.every);
  if (times === 1) return { frequency: v.unit, interval, anchorPolicy: v.anchor };
  return { frequency: v.unit, interval, anchorPolicy: 'calendar', timesPerPeriod: times };
}

export const plural = (n: string, word: string) => (n === '1' ? word : `${word}s`);

/** "3 times a week", "once every 2 months". */
export function repeatSummary(v: RepeatValue): string {
  if (v.mode === 'once') return 'Just once';
  if (v.mode === 'daily') return 'Every day';
  const times = v.times === '1' ? 'Once' : `${v.times || 'N'} times`;
  const per = v.every === '1' ? `a ${v.unit}` : `every ${v.every || 'N'} ${v.unit}s`;
  return `${times} ${per}`;
}
