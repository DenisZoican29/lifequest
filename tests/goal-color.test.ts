import { describe, expect, it } from 'vitest';

import { createGoal, updateGoal } from '../src/domain/commands';
import { GOAL_COLOR_COUNT, goalSlots } from '../src/domain/goal-share';
import { emptySnapshot, type Goal } from '../src/domain/types';
import { world } from './helpers';

const goal = (id: string, n: number, extra: Partial<Goal> = {}): Goal => ({
  id,
  title: id,
  description: '',
  status: 'active',
  createdAt: `2026-11-${String(n).padStart(2, '0')}T10:00:00.000Z`,
  updatedAt: `2026-11-${String(n).padStart(2, '0')}T10:00:00.000Z`,
  ...extra,
});
const slots = (goals: Goal[]) => Object.fromEntries(goalSlots({ ...emptySnapshot(), goals }));

describe('goal colours', () => {
  it('without chosen colours, goals take slots in creation order', () => {
    expect(slots([goal('b', 2), goal('a', 1), goal('c', 3)])).toEqual({ a: 0, b: 1, c: 2 });
  });

  it('a chosen colour is kept, and automatic goals skip the colours others chose', () => {
    expect(slots([goal('a', 1), goal('b', 2, { color: 0 }), goal('c', 3)])).toEqual({ a: 1, b: 0, c: 2 });
  });

  it('two goals may choose the same colour', () => {
    expect(slots([goal('a', 1, { color: 4 }), goal('b', 2, { color: 4 })])).toEqual({ a: 4, b: 4 });
  });

  it('when the free colours run out, the rest get the neutral slots past the palette', () => {
    const chosen = Array.from({ length: GOAL_COLOR_COUNT - 1 }, (_, i) => goal(`x${i}`, i + 1, { color: i }));
    const s = slots([...chosen, goal('auto1', 20), goal('auto2', 21)]);
    expect(s.auto1).toBe(GOAL_COLOR_COUNT - 1);
    expect(s.auto2).toBe(GOAL_COLOR_COUNT);
  });

  it('archived goals and invalid stored colours are ignored', () => {
    expect(slots([goal('old', 1, { status: 'archived', color: 0 }), goal('a', 2), goal('b', 3, { color: 99 })])).toEqual({ a: 0, b: 1 });
  });

  it('goals save, change and clear their colour; values outside the palette are rejected', () => {
    const w = world();
    w.run((s, c) => createGoal(s, c, { title: 'Get a new job', description: '', deadline: '2027-06-30', color: 3 }));
    const g = w.s.goals[0];
    expect(g.color).toBe(3);
    w.run((s, c) => updateGoal(s, c, g.id, { title: g.title, description: '', deadline: '2027-06-30', color: 5 }));
    expect(w.s.goals[0].color).toBe(5);
    w.run((s, c) => updateGoal(s, c, g.id, { title: g.title, description: '', deadline: '2027-06-30' }));
    expect(w.s.goals[0].color).toBeUndefined();
    expect(() => w.run((s, c) => createGoal(s, c, { title: 'Bad', description: '', deadline: '2027-06-30', color: GOAL_COLOR_COUNT }))).toThrow();
  });
});
