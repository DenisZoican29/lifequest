import { describe, expect, it } from 'vitest';

import { repeatFromRule, repeatSummary, ruleFromRepeat, type RepeatValue } from '../src/domain/repeat';

const custom = (patch: Partial<RepeatValue>): RepeatValue => ({ mode: 'custom', times: '1', every: '1', unit: 'week', anchor: 'completion', ...patch });

describe('repeat picker mapping', () => {
  it('once and daily', () => {
    expect(ruleFromRepeat(custom({ mode: 'once' }))).toBeUndefined();
    expect(ruleFromRepeat(custom({ mode: 'daily' }))).toEqual({ frequency: 'day', interval: 1, anchorPolicy: 'completion' });
  });

  it('custom with 2+ times is a times-per-period quota', () => {
    const v = custom({ times: '3' });
    expect(ruleFromRepeat(v)).toEqual({ frequency: 'week', interval: 1, anchorPolicy: 'calendar', timesPerPeriod: 3 });
    expect(repeatSummary(v)).toBe('3 times a week');
  });

  it('custom with 1 time is a classic repeat that keeps its schedule choice', () => {
    const v = custom({ every: '2', unit: 'month', anchor: 'calendar' });
    expect(ruleFromRepeat(v)).toEqual({ frequency: 'month', interval: 2, anchorPolicy: 'calendar' });
    expect(repeatSummary(v)).toBe('Once every 2 months');
  });

  it('round-trips existing rules, including the old Weekly/Monthly presets', () => {
    for (const rule of [
      { frequency: 'day' as const, interval: 1, anchorPolicy: 'calendar' as const },
      { frequency: 'week' as const, interval: 1, anchorPolicy: 'completion' as const },
      { frequency: 'month' as const, interval: 6, anchorPolicy: 'calendar' as const },
      { frequency: 'week' as const, interval: 2, anchorPolicy: 'calendar' as const, timesPerPeriod: 4 },
    ]) {
      expect(ruleFromRepeat(repeatFromRule(rule))).toEqual(rule);
    }
    expect(repeatFromRule({ frequency: 'week', interval: 1, anchorPolicy: 'completion' }).mode).toBe('custom');
  });
});
