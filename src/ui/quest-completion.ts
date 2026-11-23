import { completeOccurrence } from '@/domain/commands';
import { quotaProgress } from '@/domain/selectors';
import { useStore } from '@/state/store';

import { celebrate, toast } from './toast';
import { seeYouAgain } from './visuals';

/** Shares one completion path across list gestures and the quest editor. */
export async function completeQuest(occurrenceId: string): Promise<boolean> {
  const result = await useStore.getState().run((s, clock) => {
    const changes = completeOccurrence(s, clock, occurrenceId);
    const completed = changes.put.occurrences?.find((occurrence) => occurrence.id === occurrenceId);
    const task = s.tasks.find((t) => t.id === completed?.taskDefinitionId);
    const quota = task && quotaProgress(s, task, clock.today());
    const coins = changes.put.wallet?.[0]?.coinDelta ?? 0;

    return { changes, value: { task, quota, coins } };
  });
  if (!result.ok) {
    toast(result.message, 'error');
    return false;
  }

  const { task, quota, coins } = result.value;
  if (quota) {
    const done = Math.min(quota.done + 1, quota.times);
    const finished = done === quota.times;
    celebrate({
      kind: finished ? 'complete' : 'log',
      title: finished ? 'Target reached' : 'Progress logged',
      detail: `${done} of ${quota.times} ${quota.periodLabel}`,
      coins,
      progress: { done, total: quota.times },
    });
  } else {
    const next = task?.taskType === 'side' && task.recurrence ? seeYouAgain(task.recurrence) : undefined;
    celebrate({
      kind: 'complete',
      title: 'Quest complete',
      detail: next ? next[0].toUpperCase() + next.slice(1) : task?.title,
      coins,
    });
  }
  return true;
}
