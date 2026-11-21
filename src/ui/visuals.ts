import type { Cadence, RecurrenceRule, Snapshot, TaskDefinition } from '@/domain/types';

import type { CardTone, IconName } from './components';

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const word = (n: number) => WORDS[n] ?? String(n);

/** "Daily", "Weekly", "Every 2 months", "One-off". */
export function recurrenceWord(rule: RecurrenceRule | undefined): string {
  if (!rule) return 'One-off';
  if (rule.interval === 1) return { day: 'Daily', week: 'Weekly', month: 'Monthly', year: 'Yearly' }[rule.frequency];
  return `Every ${rule.interval} ${rule.frequency}s`;
}

/** Row meta line: "Daily quest · Run a half marathon" (spec §03 task cards). */
export function questContext(s: Snapshot, task: TaskDefinition): string {
  const kind = task.taskType === 'side' ? 'Side quest' : `${recurrenceWord(task.recurrence)} quest`;
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

/** Card tint and icon per goal cadence. */
export function cadenceStyle(c: Cadence): { tone: CardTone; icon: IconName; label: string } {
  return {
    yearly: { tone: 'lavender' as CardTone, icon: 'trophy-outline' as IconName, label: 'Yearly goal' },
    monthly: { tone: 'sky' as CardTone, icon: 'calendar-outline' as IconName, label: 'Monthly goal' },
    weekly: { tone: 'mint' as CardTone, icon: 'leaf-outline' as IconName, label: 'Weekly goal' },
    daily: { tone: 'peach' as CardTone, icon: 'sunny-outline' as IconName, label: 'Daily goal' },
  }[c];
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
