import { describe, expect, it } from 'vitest';

import { createGoal, updateGoal } from '../src/domain/commands';
import { goalInitials } from '../src/domain/goal-mark';
import { world } from './helpers';

describe('goal mark', () => {
  it('uses the first and last meaningful words as initials', () => {
    expect(goalInitials('Get in better shape')).toBe('GS');
    expect(goalInitials('Read more')).toBe('RM');
    expect(goalInitials('Get a new job')).toBe('GJ');
    expect(goalInitials('Cooking')).toBe('C');
    expect(goalInitials('  run a 5K! ')).toBe('R5');
    expect(goalInitials('învăța limba')).toBe('ÎL');
    expect(goalInitials('🎯 !!')).toBe('');
    expect(goalInitials('The')).toBe('T');
  });

  it('saves, keeps and clears a goal icon', () => {
    const w = world();
    w.run((s, c) => createGoal(s, c, { title: 'Read more', description: '', deadline: '2027-06-30', icon: 'reading' }));
    const g = w.s.goals[0];
    expect(g.icon).toBe('reading');
    w.run((s, c) => updateGoal(s, c, g.id, { title: 'Read more', description: '', deadline: '2027-06-30', icon: 'language' }));
    expect(w.s.goals[0].icon).toBe('language');
    // "Use initials" clears it.
    w.run((s, c) => updateGoal(s, c, g.id, { title: 'Read more', description: '', deadline: '2027-06-30' }));
    expect(w.s.goals[0]).not.toHaveProperty('icon');
    // Junk values are dropped.
    w.run((s, c) => createGoal(s, c, { title: 'X', description: '', deadline: '2027-06-30', icon: '<script>' }));
    expect(w.s.goals.find((x) => x.title === 'X')).not.toHaveProperty('icon');
  });
});
