import { describe, expect, it } from 'vitest';

import { dayRole, monthGrid, pickDay } from '../src/domain/date-range';

describe('choose dates calendar', () => {
  it('lays a month out in Monday-first weeks', () => {
    const nov = monthGrid('2026-11-15'); // 1 Nov 2026 is a Sunday
    expect(nov[0]).toEqual([null, null, null, null, null, null, '2026-11-01']);
    expect(nov.at(-1)).toEqual(['2026-11-30', null, null, null, null, null, null]);
    expect(nov.flat().filter(Boolean)).toHaveLength(30);
    expect(monthGrid('2027-02-01')[0][0]).toBe('2027-02-01'); // a Monday
  });

  it('two taps make a range in order, across months; a third tap starts again', () => {
    let d = pickDay({}, '2026-11-03');
    expect(d).toEqual({ start: '2026-11-03' });
    d = pickDay(d, '2026-10-28'); // earlier day second
    expect(d).toEqual({ start: '2026-10-28', end: '2026-11-03' });
    expect(dayRole(d, '2026-10-31')).toBe('between');
    expect(dayRole(d, '2026-10-28')).toBe('start');
    expect(dayRole(d, '2026-11-03')).toBe('end');
    expect(pickDay(d, '2026-11-10')).toEqual({ start: '2026-11-10' });
  });

  it('the same day twice is a single day', () => {
    const d = pickDay(pickDay({}, '2026-11-05'), '2026-11-05');
    expect(d).toEqual({ start: '2026-11-05', end: '2026-11-05' });
    expect(dayRole(d, '2026-11-05')).toBe('single');
  });
});
