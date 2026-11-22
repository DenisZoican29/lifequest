import { format } from 'date-fns';

import { fromLocalDate } from '@/domain/dates';
import type { GoalHealth } from '@/domain/goal-insights';
import type { RecurrenceRule, Snapshot, TaskDefinition } from '@/domain/types';

import type { CardTone, ChipTone, IconName } from './components';

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const word = (n: number) => WORDS[n] ?? String(n);

/** "Daily", "Weekly", "Every 2 months", "3× a week", "One-off". */
export function recurrenceWord(rule: RecurrenceRule | undefined): string {
  if (!rule) return 'One-off';
  if (rule.timesPerPeriod) {
    const per = rule.interval === 1 ? `a ${rule.frequency}` : `every ${rule.interval} ${rule.frequency}s`;
    return `${rule.timesPerPeriod}× ${per}`;
  }
  if (rule.interval === 1) return { day: 'Daily', week: 'Weekly', month: 'Monthly', year: 'Yearly' }[rule.frequency];
  return `Every ${rule.interval} ${rule.frequency}s`;
}

/** "4× by 1 Dec" for date-range quests, otherwise the repeat word. */
export function taskRepeatWord(task: TaskDefinition): string {
  if (task.window) return `${task.window.times}× by ${format(fromLocalDate(task.window.end), 'd MMM')}`;
  return recurrenceWord(task.recurrence);
}

/** Row meta line: "Daily quest · Run a half marathon" (spec §03 task cards). */
export function questContext(s: Snapshot, task: TaskDefinition): string {
  const kind =
    task.taskType === 'side'
      ? 'Side quest'
      : task.window
        ? `Quest · ${taskRepeatWord(task)}`
        : task.recurrence?.timesPerPeriod
        ? `Quest · ${recurrenceWord(task.recurrence)}`
        : `${recurrenceWord(task.recurrence)} quest`;
  const goal = task.goalId ? s.goals.find((g) => g.id === task.goalId)?.title : undefined;
  return goal ? `${kind} · ${goal}` : kind;
}

/** "see you in two months" / "see you tomorrow" for side-quest completion copy (spec §08). */
export function seeYouAgain(rule: RecurrenceRule | undefined): string {
  if (!rule) return 'all done';
  if (rule.frequency === 'day' && rule.interval === 1) return 'see you tomorrow';
  const unit = rule.interval === 1 ? rule.frequency : `${rule.frequency}s`;
  return `see you in ${rule.interval === 1 ? 'a' : word(rule.interval)} ${unit}`;
}

/**
 * Goal status: label, colours and a calm one-line message (design spec: "a cozy quest journal,
 * not a punishment app"). Colour always comes with an icon and words.
 */
export interface HealthStyle {
  label: string;
  chip: ChipTone;
  card: CardTone;
  icon: IconName;
  message: string;
}

export function healthStyle(h: GoalHealth): HealthStyle {
  return HEALTH[h];
}

const HEALTH: Record<GoalHealth, HealthStyle> = {
  'on-track': { label: 'On track', chip: 'done', card: 'mint', icon: 'trending-up', message: 'You are keeping your plan. Keep the rhythm going.' },
  'needs-push': {
    label: 'Needs a push',
    chip: 'due',
    card: 'peach',
    icon: 'walk-outline',
    message: 'A little behind your plan. One extra session this week gets you back.',
  },
  'falling-behind': {
    label: 'Falling behind',
    chip: 'overdue',
    card: 'rose',
    icon: 'leaf-outline',
    message: 'This goal needs some love. Try a smaller, easier quest to get moving again.',
  },
  'getting-started': {
    label: 'Getting started',
    chip: 'demo',
    card: 'sky',
    icon: 'sparkles-outline',
    message: 'Your status shows up once your quests have run for about a week.',
  },
  'no-quests': {
    label: 'No quests yet',
    chip: 'neutral',
    card: 'cream',
    icon: 'add-circle-outline',
    message: 'Link a quest to this goal so we can show how you are doing.',
  },
  'past-deadline': {
    label: 'Deadline passed',
    chip: 'overdue',
    card: 'cream',
    icon: 'time-outline',
    message: 'The deadline has passed. Mark the goal reached, or give it a new date.',
  },
  completed: { label: 'Reached', chip: 'done', card: 'mint', icon: 'trophy-outline', message: 'Goal reached. What a journey!' },
  archived: { label: 'Archived', chip: 'neutral', card: 'cream', icon: 'archive-outline', message: 'This goal is archived.' },
};

/** "86 days left", "Due today", "12 days past the deadline". */
export function deadlineWord(daysLeft: number | undefined): string {
  if (daysLeft === undefined) return 'No deadline';
  if (daysLeft === 0) return 'Due today';
  if (daysLeft === 1) return '1 day left';
  if (daysLeft > 1) return `${daysLeft} days left`;
  return `${-daysLeft} day${daysLeft === -1 ? '' : 's'} past the deadline`;
}

const BRANDS: Record<string, { icon: IconName; bg: string }> = {
  'mock:instagram': { icon: 'logo-instagram', bg: '#D6457A' },
  'mock:youtube': { icon: 'logo-youtube', bg: '#E5483F' },
  'mock:tiktok': { icon: 'logo-tiktok', bg: '#273D35' },
  'mock:reddit': { icon: 'logo-reddit', bg: '#EE6A33' },
  'mock:x': { icon: 'logo-x', bg: '#273D35' },
  'mock:netflix': { icon: 'film-outline', bg: '#B8333A' },
};
const CUSTOM = ['#316E54', '#5B7FB0', '#8A6BC4', '#C27B3E', '#3F8F8A'];

/** Sample app tile. Custom apps get a coloured initial. */
export function appVisual(appRef: string, label: string): { icon?: IconName; letter?: string; bg: string } {
  const brand = BRANDS[appRef];
  if (brand) return brand;
  let h = 0;
  for (const ch of label) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return { letter: label.trim().charAt(0).toUpperCase() || '?', bg: CUSTOM[Math.abs(h) % CUSTOM.length] };
}
