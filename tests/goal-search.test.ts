import { describe, expect, it } from 'vitest';

import { searchGoals } from '../src/domain/goal-search';

const goals = [{ title: 'Get a new job' }, { title: 'Run a half marathon' }, { title: 'Read 12 books' }, { title: 'Open a café' }];
const titles = (query: string) => searchGoals(goals, query).map((g) => g.title);

describe('goal search', () => {
  it('an empty query keeps every goal in order', () => {
    expect(titles('')).toEqual(goals.map((g) => g.title));
    expect(titles('   ')).toHaveLength(4);
  });

  it('matches every word in any order, ignoring case and accents', () => {
    expect(titles('JOB')).toEqual(['Get a new job']);
    expect(titles('marathon half')).toEqual(['Run a half marathon']);
    expect(titles('cafe')).toEqual(['Open a café']);
    expect(titles('swim')).toEqual([]);
  });

  it('titles starting with the query come first', () => {
    expect(titles('o')).toEqual(['Open a café', 'Get a new job', 'Run a half marathon', 'Read 12 books']);
  });
});
