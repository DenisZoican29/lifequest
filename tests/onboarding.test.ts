import { describe, expect, it } from 'vitest';

import { completeOnboarding, createTask } from '../src/domain/commands';
import { questBoard } from '../src/domain/selectors';
import { world } from './helpers';

describe('onboarding (addendum A4 §4)', () => {
  it('reaches Today with a quest while deferring screen-time setup', () => {
    const w = world();
    w.run((s, c) => createTask(s, c, { title: 'Read for 20 minutes', description: '', taskType: 'main', rewardCoins: 10, dueAt: c.today() }));
    w.run((s, c) => completeOnboarding(s, c, [], 30));
    expect(w.s.settings.onboarded).toBe(true);
    expect(w.s.apps.filter((a) => a.enabled)).toHaveLength(0);
    expect(questBoard(w.s, w.clock.today(), 'today').todo.map((i) => i.task.title)).toEqual(['Read for 20 minutes']);
  });
});
