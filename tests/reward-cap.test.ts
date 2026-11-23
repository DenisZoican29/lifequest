import { describe, expect, it } from 'vitest';

import { createTask, MAX_REWARD_COINS } from '../src/domain/commands';
import { world } from './helpers';

describe('coin reward cap', () => {
  const make = (rewardCoins: number) => {
    const w = world();
    w.run((s, c) => createTask(s, c, { title: 'Study', description: '', taskType: 'main', rewardCoins, dueAt: c.today() }));
    return w.s.tasks[0];
  };

  it('accepts 0 up to the cap of 50', () => {
    expect(MAX_REWARD_COINS).toBe(50);
    expect(make(0).rewardCoins).toBe(0);
    expect(make(50).rewardCoins).toBe(50);
  });

  it('rejects more than 50 coins', () => {
    expect(() => make(51)).toThrow(/between 0 and 50/);
  });
});
