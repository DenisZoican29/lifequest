/**
 * Pure commands: (snapshot, clock, input) -> ChangeSet.
 * They never touch storage; the repository applies a ChangeSet atomically and
 * re-checks its guards inside the transaction (FR-16, spec §5 "Concurrency").
 */
import { addPeriod, isLocalDate } from './dates';
import { allowanceFor, coinBalance } from './economy';
import { newId } from './ids';
import { GOAL_COLOR_COUNT } from './goal-share';
import { questIconPreset, type QuestIcon } from './quest-mark';
import { canWarn, isDailyRule, isQuota, nextDueDate, nextQuotaDate, periodContaining } from './recurrence';
import { isQuestColor } from './types';
import type {
  AppSelection,
  ChangeSet,
  Goal,
  GoalStatus,
  Milestone,
  QuestColor,
  RecurrenceRule,
  Settings,
  Snapshot,
  TaskDefinition,
  TaskOccurrence,
  TargetWindow,
  TaskType,
  ThemePreference,
  TimeOffer,
  TimePurchase,
  UsageEvent,
  WalletTransaction,
} from './types';
import type { Clock } from './dates';

export type DomainErrorCode =
  | 'not-found'
  | 'invalid'
  | 'already-completed'
  | 'insufficient-funds'
  | 'duplicate'
  | 'blocked';

export class DomainError extends Error {
  constructor(
    public readonly code: DomainErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

function changes(partial: Partial<ChangeSet> = {}): ChangeSet {
  return { put: partial.put ?? {}, delete: partial.delete ?? {}, guards: partial.guards ?? [] };
}

function requireText(value: string, field: string): string {
  const v = value.trim();
  if (!v) throw new DomainError('invalid', `${field} is required.`);
  if (v.length > 200) throw new DomainError('invalid', `${field} is too long.`);
  return v;
}

function requireDate(value: string | undefined, field: string): string | undefined {
  if (value === undefined || value === '') return undefined;
  if (!isLocalDate(value)) throw new DomainError('invalid', `${field} must be a date like 2026-12-31.`);
  return value;
}

function requireNonNegativeInt(value: number, field: string, max = 100_000): number {
  if (!Number.isInteger(value) || value < 0 || value > max) {
    throw new DomainError('invalid', `${field} must be a whole number between 0 and ${max}.`);
  }
  return value;
}

function validateRule(rule: RecurrenceRule | undefined): RecurrenceRule | undefined {
  if (!rule) return undefined;
  if (!Number.isInteger(rule.interval) || rule.interval < 1 || rule.interval > 365) {
    throw new DomainError('invalid', 'Repeat interval must be a whole number between 1 and 365.');
  }
  if (rule.timesPerPeriod !== undefined) {
    if (!Number.isInteger(rule.timesPerPeriod) || rule.timesPerPeriod < 1 || rule.timesPerPeriod > 100) {
      throw new DomainError('invalid', 'Times per period must be a whole number between 1 and 100.');
    }
    return { frequency: rule.frequency, interval: rule.interval, anchorPolicy: 'calendar', timesPerPeriod: rule.timesPerPeriod };
  }
  return { frequency: rule.frequency, interval: rule.interval, anchorPolicy: rule.anchorPolicy };
}

function find<T extends { id: string }>(rows: readonly T[], id: string, what: string): T {
  const row = rows.find((r) => r.id === id);
  if (!row) throw new DomainError('not-found', `${what} not found.`);
  return row;
}

// ---------------------------------------------------------------- goals

/** An end goal ("Get a new job"), with an optional deadline; quests linked to it drive its status. */
export interface GoalInput {
  title: string;
  description: string;
  /** Optional: empty means no deadline. */
  deadline: string;
  /** Preset icon key; empty or undefined means "use initials". */
  icon?: string;
  /** Goal colour index (0 to GOAL_COLOR_COUNT - 1); undefined means automatic. */
  color?: number;
}

function cleanGoalColor(color: number | undefined): number | undefined {
  if (color === undefined) return undefined;
  if (!Number.isInteger(color) || color < 0 || color >= GOAL_COLOR_COUNT) throw new DomainError('invalid', 'Choose a goal colour from the palette.');
  return color;
}

/** Icon keys are short tokens; anything else is dropped (shown as initials). */
function cleanIcon(icon: string | undefined): string | undefined {
  const v = icon?.trim();
  return v && /^[a-z0-9-]{1,32}$/.test(v) ? v : undefined;
}

/** A goal's deadline is optional; when given, a new one must not be in the past. */
function checkDeadline(value: string, today: string, previous?: string): string | undefined {
  const d = requireDate(value, 'Deadline');
  if (!d) return undefined;
  // Keeping an existing (possibly passed) deadline is fine; a new one must not be in the past.
  if (d < today && d !== previous) throw new DomainError('invalid', 'The deadline must be today or later.');
  return d;
}

export function createGoal(_s: Snapshot, clock: Clock, input: GoalInput): ChangeSet {
  const now = clock.now().toISOString();
  const deadline = checkDeadline(input.deadline, clock.today());
  const goal: Goal = {
    id: newId(),
    title: requireText(input.title, 'Title'),
    description: input.description.trim(),
    ...(deadline ? { deadline } : {}),
    ...(cleanIcon(input.icon) ? { icon: cleanIcon(input.icon) } : {}),
    ...(cleanGoalColor(input.color) !== undefined ? { color: input.color } : {}),
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };
  return changes({ put: { goals: [goal] } });
}

export function updateGoal(s: Snapshot, clock: Clock, id: string, input: GoalInput): ChangeSet {
  const { icon: _old, color: _oldColor, deadline: oldDeadline, ...goal } = find(s.goals, id, 'Goal');
  const icon = cleanIcon(input.icon);
  const color = cleanGoalColor(input.color);
  const deadline = checkDeadline(input.deadline, clock.today(), oldDeadline);
  return changes({
    put: {
      goals: [
        {
          ...goal,
          ...(icon ? { icon } : {}),
          ...(color !== undefined ? { color } : {}),
          ...(deadline ? { deadline } : {}),
          title: requireText(input.title, 'Title'),
          description: input.description.trim(),
          updatedAt: clock.now().toISOString(),
        },
      ],
    },
  });
}

export function setGoalStatus(s: Snapshot, clock: Clock, id: string, status: GoalStatus): ChangeSet {
  const goal = find(s.goals, id, 'Goal');
  return changes({ put: { goals: [{ ...goal, status, updatedAt: clock.now().toISOString() }] } });
}

export function addMilestone(s: Snapshot, _clock: Clock, goalId: string, title: string, dueAt?: string): ChangeSet {
  find(s.goals, goalId, 'Goal');
  const order = s.milestones.filter((m) => m.goalId === goalId).reduce((max, m) => Math.max(max, m.order), -1) + 1;
  const milestone: Milestone = {
    id: newId(),
    goalId,
    title: requireText(title, 'Milestone'),
    dueAt: requireDate(dueAt, 'Due date'),
    order,
  };
  return changes({ put: { milestones: [milestone] } });
}

export function toggleMilestone(s: Snapshot, clock: Clock, id: string): ChangeSet {
  const m = find(s.milestones, id, 'Milestone');
  const next: Milestone = m.completedAt
    ? { ...m, completedAt: undefined }
    : { ...m, completedAt: clock.now().toISOString() };
  return changes({ put: { milestones: [next] } });
}

export function deleteMilestone(s: Snapshot, _clock: Clock, id: string): ChangeSet {
  find(s.milestones, id, 'Milestone');
  return changes({ delete: { milestones: [id] } });
}

// ---------------------------------------------------------------- tasks

/** Most coins one completion can pay. */
export const MAX_REWARD_COINS = 50;

export interface TaskInput {
  title: string;
  description: string;
  taskType: TaskType;
  goalId?: string;
  /** Omit to keep the current icon. Use null to return to the default. */
  icon?: QuestIcon | null;
  /** Omit to keep the current color. Use null to return to the default. */
  color?: QuestColor | null;
  rewardCoins: number;
  dueAt: string;
  recurrence?: RecurrenceRule;
  /** "N times between two dates". Replaces `recurrence`; `dueAt` is ignored in favour of `window.start`. */
  window?: TargetWindow;
  /** No due date: one-offs stay available until done; repeating quests run any time in each period. Ignored for date ranges. */
  noDueDate?: boolean;
  /** Deadline warning, in days. Ignored for undated one-offs and daily quests (see `canWarn`). */
  reminderDaysBefore?: number;
}

function validateWindow(w: TargetWindow | undefined): TargetWindow | undefined {
  if (!w) return undefined;
  const start = requireDate(w.start, 'Start date');
  const end = requireDate(w.end, 'End date');
  if (!start || !end) throw new DomainError('invalid', 'Pick a start and an end date.');
  if (end < start) throw new DomainError('invalid', 'The end date must be on or after the start date.');
  if (!Number.isInteger(w.times) || w.times < 1 || w.times > 100) {
    throw new DomainError('invalid', 'Times must be a whole number between 1 and 100.');
  }
  return { start, end, times: w.times };
}

function validateTask(s: Snapshot, input: TaskInput) {
  const window = validateWindow(input.window);
  const dueAt = window ? window.start : requireDate(input.dueAt, 'Due date');
  if (!dueAt) throw new DomainError('invalid', 'Due date is required.');
  if (input.goalId) {
    if (input.taskType === 'side') throw new DomainError('invalid', 'Side quests cannot be linked to a goal.');
    find(s.goals, input.goalId, 'Goal');
  }
  if (input.color != null && !isQuestColor(input.color)) throw new DomainError('invalid', 'Choose a quest color from the palette.');
  if (input.icon != null && !questIconPreset(input.icon)) throw new DomainError('invalid', 'Choose a quest icon from the picker.');
  const noDueDate = !window && !!input.noDueDate;
  const rule = window ? undefined : validateRule(input.recurrence);
  // Without a due date, "every 2 weeks" means once in each 2-week period, whenever suits you.
  const recurrence = noDueDate && rule && !rule.timesPerPeriod && !isDailyRule(rule)
    ? { frequency: rule.frequency, interval: rule.interval, anchorPolicy: 'calendar' as const, timesPerPeriod: 1 }
    : rule;
  const warns = canWarn({ recurrence, window, noDueDate });
  return {
    title: requireText(input.title, 'Title'),
    description: input.description.trim(),
    taskType: input.taskType,
    goalId: input.taskType === 'main' ? input.goalId || undefined : undefined,
    ...(input.icon !== undefined ? { icon: input.icon ?? undefined } : {}),
    ...(input.color !== undefined ? { color: input.color ?? undefined } : {}),
    rewardCoins: requireNonNegativeInt(input.rewardCoins, 'Coin reward', MAX_REWARD_COINS),
    dueAt,
    recurrence,
    window,
    noDueDate: noDueDate || undefined,
    reminderDaysBefore:
      input.reminderDaysBefore === undefined || !warns
        ? undefined
        : requireNonNegativeInt(input.reminderDaysBefore, 'Warning days', 365),
  };
}

export function createTask(s: Snapshot, clock: Clock, input: TaskInput): ChangeSet {
  const now = clock.now().toISOString();
  const valid = validateTask(s, input);
  if (valid.window && valid.window.end < clock.today()) throw new DomainError('invalid', 'The end date must be today or later.');
  const task: TaskDefinition = {
    id: newId(),
    ...valid,
    active: true,
    createdAt: now,
    updatedAt: now,
  };
  const occurrence: TaskOccurrence = {
    id: newId(),
    taskDefinitionId: task.id,
    scheduledFor: task.dueAt,
    status: 'open',
  };
  return changes({ put: { tasks: [task], occurrences: [occurrence] } });
}

/** Due date of the task's open occurrence (what the user sees as "next due"). */
export function nextDueOf(s: Snapshot, task: TaskDefinition): string {
  return s.occurrences.find((o) => o.taskDefinitionId === task.id && o.status === 'open')?.scheduledFor ?? task.dueAt;
}

/** Edits apply to the open occurrence and future ones; completed history is untouched (FR-08). */
export function updateTask(s: Snapshot, clock: Clock, id: string, input: TaskInput): ChangeSet {
  const task = find(s.tasks, id, 'Task');
  const valid = validateTask(s, input);
  const open = s.occurrences.filter((o) => o.taskDefinitionId === id && o.status === 'open');
  if (valid.window) {
    // Date-range quests: the form edits the window itself; what's already done inside it still counts.
    const updated: TaskDefinition = { ...task, ...valid, updatedAt: clock.now().toISOString() };
    const window = valid.window;
    const changed = task.window?.start !== window.start || task.window.end !== window.end || task.window.times !== window.times;
    return changes({ put: { tasks: [updated], occurrences: changed ? windowOccurrences(s, updated, window, clock.today()) : [] } });
  }
  // The form edits the *next* due date. Moving it re-anchors the schedule there.
  const moved = valid.dueAt !== nextDueOf(s, task);
  const updated: TaskDefinition = {
    ...task,
    ...valid,
    dueAt: moved ? valid.dueAt : task.dueAt,
    updatedAt: clock.now().toISOString(),
  };
  const occurrences = moved ? open.map((o) => ({ ...o, scheduledFor: valid.dueAt })) : [];
  return changes({ put: { tasks: [updated], occurrences } });
}

/** Completions of a task that fall inside a date window. */
export function doneInWindow(s: Snapshot, taskId: string, w: TargetWindow): number {
  return s.occurrences.filter(
    (o) => o.taskDefinitionId === taskId && o.status === 'completed' && !!o.completedOn && o.completedOn >= w.start && o.completedOn <= w.end,
  ).length;
}

/** The open occurrence a date-range quest should have after its window changed: none once the target is met. */
function windowOccurrences(s: Snapshot, task: TaskDefinition, w: TargetWindow, today: string): TaskOccurrence[] {
  if (doneInWindow(s, task.id, w) >= w.times) return [];
  const when = w.start > today ? w.start : today;
  const open = s.occurrences.filter((o) => o.taskDefinitionId === task.id && o.status === 'open');
  if (open.length) return open.map((o) => ({ ...o, scheduledFor: when }));
  return [{ id: newId(), taskDefinitionId: task.id, scheduledFor: when, status: 'open' }];
}

/** Gives a date-range quest that ran out of time a new end date. What was already done still counts. */
export function rescheduleWindow(s: Snapshot, clock: Clock, id: string, end: string): ChangeSet {
  const task = find(s.tasks, id, 'Task');
  if (!task.window) throw new DomainError('invalid', 'Only date-range quests can be given more time.');
  const e = requireDate(end, 'End date');
  if (!e) throw new DomainError('invalid', 'Pick a new end date.');
  if (e < clock.today()) throw new DomainError('invalid', 'Pick today or a later date.');
  const window: TargetWindow = { ...task.window, end: e };
  const updated: TaskDefinition = { ...task, window, active: true, updatedAt: clock.now().toISOString() };
  return changes({ put: { tasks: [updated], occurrences: windowOccurrences(s, updated, window, clock.today()) } });
}

/**
 * Deletes a quest for good. Its open occurrences go with it; completed ones and the coins they
 * paid stay as history (the ledger is never rewritten).
 */
export function deleteTask(s: Snapshot, _clock: Clock, id: string): ChangeSet {
  find(s.tasks, id, 'Task');
  const pending = s.occurrences.filter((o) => o.taskDefinitionId === id && o.status !== 'completed').map((o) => o.id);
  return changes({ delete: { tasks: [id], occurrences: pending } });
}

/** Archives the task; completed occurrences and their ledger entries remain for auditing. */
export function archiveTask(s: Snapshot, clock: Clock, id: string): ChangeSet {
  const task = find(s.tasks, id, 'Task');
  const open = s.occurrences.filter((o) => o.taskDefinitionId === id && o.status === 'open');
  return changes({
    put: {
      tasks: [{ ...task, active: false, updatedAt: clock.now().toISOString() }],
      occurrences: open.map((o) => ({ ...o, status: 'skipped' as const })),
    },
  });
}

/** Brings an archived task back with one open occurrence due today (or its later due date). */
export function restoreTask(s: Snapshot, clock: Clock, id: string): ChangeSet {
  const task = find(s.tasks, id, 'Task');
  if (task.active) throw new DomainError('invalid', 'This quest is already active.');
  const today = clock.today();
  const scheduledFor = task.dueAt > today ? task.dueAt : today;
  return changes({
    put: {
      tasks: [{ ...task, active: true, dueAt: task.recurrence ? scheduledFor : task.dueAt, updatedAt: clock.now().toISOString() }],
      occurrences: [{ id: newId(), taskDefinitionId: task.id, scheduledFor, status: 'open' }],
    },
  });
}

export const occurrenceRewardKey =(occurrenceId: string) => `occurrence:${occurrenceId}`;

/** Completions of a task that fall inside the quota period containing `day`. */
export function doneInPeriod(s: Snapshot, task: TaskDefinition, day: string): number {
  if (task.window) return doneInWindow(s, task.id, task.window);
  if (!task.recurrence) return 0;
  const { start, end } = periodContaining(task.recurrence, task.dueAt, day);
  return s.occurrences.filter(
    (o) => o.taskDefinitionId === task.id && o.status === 'completed' && !!o.completedOn && o.completedOn >= start && o.completedOn <= end,
  ).length;
}

/**
 * The next open occurrence after one is finished. `completed` is how many now count toward the
 * current quota period (pass Infinity to skip the rest of the period).
 */
function followUp(task: TaskDefinition, occ: TaskOccurrence, finishedOn: string, completed = 0): TaskOccurrence[] {
  if (task.window) {
    // Stays available (same day too) until the target is met; then the quest is finished.
    if (!task.active || completed >= task.window.times) return [];
    const scheduledFor = finishedOn > task.window.start ? finishedOn : task.window.start;
    return [{ id: newId(), taskDefinitionId: task.id, scheduledFor, status: 'open' }];
  }
  const rule = task.recurrence;
  if (!rule || !task.active) return [];
  const scheduledFor = isQuota(rule)
    ? nextQuotaDate(rule, task.dueAt, finishedOn, completed)
    : nextDueDate(rule, task.dueAt, occ.scheduledFor, finishedOn);
  return [{ id: newId(), taskDefinitionId: task.id, scheduledFor, status: 'open' }];
}

/**
 * Completes one occurrence and credits its reward exactly once (FR-06, FR-07, T-01).
 * Recurring tasks get a fresh open occurrence (FR-11, T-03).
 */
export function completeOccurrence(s: Snapshot, clock: Clock, occurrenceId: string): ChangeSet {
  const occ = find(s.occurrences, occurrenceId, 'Quest');
  if (occ.status !== 'open') throw new DomainError('already-completed', 'This quest is already done.');
  const task = find(s.tasks, occ.taskDefinitionId, 'Task');
  const now = clock.now().toISOString();
  const today = clock.today();
  const key = occurrenceRewardKey(occ.id);
  if (task.window && today > task.window.end) {
    throw new DomainError('invalid', 'This quest ended. Give it more time or delete it.');
  }
  if (task.window && today < task.window.start) throw new DomainError('invalid', 'This quest has not started yet.');

  const wallet: WalletTransaction[] = [];
  let rewardTransactionId: string | undefined;
  if (task.rewardCoins > 0) {
    rewardTransactionId = newId();
    wallet.push({
      id: rewardTransactionId,
      kind: 'earn',
      coinDelta: task.rewardCoins,
      sourceType: 'occurrence',
      sourceId: occ.id,
      reason: `Completed: ${task.title}`,
      createdAt: now,
      idempotencyKey: key,
    });
  }
  const done: TaskOccurrence = { ...occ, status: 'completed', completedAt: now, completedOn: today, rewardTransactionId };
  return changes({
    put: { occurrences: [done, ...followUp(task, occ, today, doneInPeriod(s, task, today) + 1)], wallet },
    guards: [{ kind: 'occurrenceOpen', occurrenceId: occ.id }, { kind: 'uniqueIdempotencyKey', key }],
  });
}

/** Skips a recurring occurrence without reward and schedules the next one (quota quests: the next period). */
export function skipOccurrence(s: Snapshot, clock: Clock, occurrenceId: string): ChangeSet {
  const occ = find(s.occurrences, occurrenceId, 'Quest');
  if (occ.status !== 'open') throw new DomainError('already-completed', 'This quest is already closed.');
  const task = find(s.tasks, occ.taskDefinitionId, 'Task');
  if (!task.recurrence) throw new DomainError('invalid', 'Only repeating quests can be skipped.');
  return changes({
    put: { occurrences: [{ ...occ, status: 'skipped' }, ...followUp(task, occ, clock.today(), Infinity)] },
    guards: [{ kind: 'occurrenceOpen', occurrenceId: occ.id }],
  });
}

export const MAX_SNOOZE_DAYS = 365;

/**
 * Moves an open occurrence to `days` from today without reward (spec design §10:
 * "A little behind schedule. Snooze, reschedule, or complete").
 */
export function snoozeOccurrence(s: Snapshot, clock: Clock, occurrenceId: string, days: number): ChangeSet {
  const occ = find(s.occurrences, occurrenceId, 'Quest');
  if (occ.status !== 'open') throw new DomainError('already-completed', 'This quest is already closed.');
  if (!Number.isInteger(days) || days < 1 || days > MAX_SNOOZE_DAYS) throw new DomainError('invalid', `Snooze must be 1–${MAX_SNOOZE_DAYS} days.`);
  return changes({
    put: { occurrences: [{ ...occ, scheduledFor: addPeriod(clock.today(), 'day', days) }] },
    guards: [{ kind: 'occurrenceOpen', occurrenceId: occ.id }],
  });
}

// ---------------------------------------------------------------- shop

export const purchaseKey = (intentId: string) => `purchase:${intentId}`;

/**
 * Manual coin -> minutes exchange (FR-15). `intentId` is created when the confirmation opens,
 * so double-submitting the same confirmation is rejected (FR-16, T-06).
 * Minutes apply to the current local day (FR-21).
 */
export function purchaseTime(s: Snapshot, clock: Clock, offerId: string, intentId: string): ChangeSet {
  const offer = find(s.settings.offers, offerId, 'Time pack');
  const key = purchaseKey(intentId);
  if (s.wallet.some((t) => t.idempotencyKey === key)) {
    throw new DomainError('duplicate', 'This purchase was already made.');
  }
  if (coinBalance(s.wallet) < offer.coins) {
    throw new DomainError('insufficient-funds', `You need ${offer.coins} coins for this pack.`);
  }
  const now = clock.now().toISOString();
  const purchaseId = newId();
  const txId = newId();
  const tx: WalletTransaction = {
    id: txId,
    kind: 'spend',
    coinDelta: -offer.coins,
    sourceType: 'purchase',
    sourceId: purchaseId,
    reason: `Bought ${offer.minutes} min`,
    createdAt: now,
    idempotencyKey: key,
  };
  const purchase: TimePurchase = {
    id: purchaseId,
    offerId: offer.id,
    coinsSpent: offer.coins,
    minutesGranted: offer.minutes,
    effectiveLocalDate: clock.today(),
    walletTransactionId: txId,
    createdAt: now,
  };
  return changes({
    put: { wallet: [tx], purchases: [purchase] },
    guards: [
      { kind: 'minBalance', coins: offer.coins },
      { kind: 'uniqueIdempotencyKey', key },
    ],
  });
}

// ---------------------------------------------------------------- app selection & mock usage

export const MOCK_APP_CATALOG: { appRef: string; label: string }[] = [
  { appRef: 'mock:instagram', label: 'Instagram' },
  { appRef: 'mock:youtube', label: 'YouTube' },
  { appRef: 'mock:tiktok', label: 'TikTok' },
  { appRef: 'mock:reddit', label: 'Reddit' },
  { appRef: 'mock:x', label: 'X' },
  { appRef: 'mock:netflix', label: 'Netflix' },
];

export const FORCE_EXHAUST_REF = 'mock:force-exhaust';

/** Enables exactly the given appRefs; known apps not listed are disabled (history kept). */
export function setSelectedApps(
  s: Snapshot,
  clock: Clock,
  selection: { appRef: string; label: string }[],
): ChangeSet {
  const now = clock.now().toISOString();
  const wanted = new Map(selection.map((a) => [a.appRef, a.label.trim()]));
  const put: AppSelection[] = [];
  for (const app of s.apps) {
    const enabled = wanted.has(app.appRef);
    if (app.enabled !== enabled) put.push({ ...app, enabled, selectedAt: enabled ? now : app.selectedAt });
    wanted.delete(app.appRef);
  }
  for (const [appRef, label] of wanted) {
    put.push({ id: newId(), platform: 'web-mock', appRef, label: requireText(label, 'App name'), enabled: true, selectedAt: now });
  }
  return changes({ put: { apps: put } });
}

export function addCustomApp(s: Snapshot, clock: Clock, label: string): ChangeSet {
  const name = requireText(label, 'App name');
  if (s.apps.some((a) => a.label.toLowerCase() === name.toLowerCase())) {
    throw new DomainError('duplicate', `${name} is already in the list.`);
  }
  const app: AppSelection = {
    id: newId(),
    platform: 'web-mock',
    appRef: `custom:${newId()}`,
    label: name,
    enabled: true,
    selectedAt: clock.now().toISOString(),
  };
  return changes({ put: { apps: [app] } });
}

/**
 * Simulates `minutes` of foreground use in one selected app. Like a real OS shield,
 * usage stops at the budget: only the remaining minutes are recorded.
 */
export function logMockUsage(s: Snapshot, clock: Clock, appRef: string, minutes: number): { changes: ChangeSet; recorded: number } {
  const app = s.apps.find((a) => a.appRef === appRef && a.enabled);
  if (!app) throw new DomainError('not-found', 'That app is not in your restricted list.');
  requireNonNegativeInt(minutes, 'Minutes', 24 * 60);
  const today = clock.today();
  const day = allowanceFor(s, today);
  if (day.blocked) throw new DomainError('blocked', `${app.label} is blocked — today's shared time is used up.`);
  const recorded = Math.min(minutes, day.remainingMinutes);
  const event: UsageEvent = {
    id: newId(),
    platform: 'web-mock',
    appRef,
    localDate: today,
    durationMinutes: recorded,
    simulationFlag: true,
    createdAt: clock.now().toISOString(),
  };
  return { changes: changes({ put: { usage: [event] } }), recorded };
}

export function forceExhaust(s: Snapshot, clock: Clock): ChangeSet {
  const today = clock.today();
  const day = allowanceFor(s, today);
  if (day.blocked) return changes();
  const event: UsageEvent = {
    id: newId(),
    platform: 'web-mock',
    appRef: FORCE_EXHAUST_REF,
    localDate: today,
    durationMinutes: day.remainingMinutes,
    simulationFlag: true,
    createdAt: clock.now().toISOString(),
  };
  return changes({ put: { usage: [event] } });
}

/** Clears today's simulated usage (test control). Purchases and coins are untouched. */
export function resetTodayUsage(s: Snapshot, clock: Clock): ChangeSet {
  const today = clock.today();
  return changes({ delete: { usage: s.usage.filter((u) => u.localDate === today).map((u) => u.id) } });
}

// ---------------------------------------------------------------- settings

function putSettings(s: Snapshot, clock: Clock, patch: Partial<Settings>): ChangeSet {
  return changes({ put: { settings: [{ ...s.settings, ...patch, id: 'main', updatedAt: clock.now().toISOString() }] } });
}

/** Shifts the simulated clock by whole days (T-08). */
export function shiftDays(s: Snapshot, clock: Clock, days: number): ChangeSet {
  if (!Number.isInteger(days)) throw new DomainError('invalid', 'Days must be whole.');
  return putSettings(s, clock, { dayOffset: s.settings.dayOffset + days });
}

export function resetClock(s: Snapshot, clock: Clock): ChangeSet {
  return putSettings(s, clock, { dayOffset: 0 });
}

export function setTheme(s: Snapshot, clock: Clock, theme: ThemePreference): ChangeSet {
  if (!['system', 'light', 'dark'].includes(theme)) throw new DomainError('invalid', 'Unknown theme.');
  return putSettings(s, clock, { theme });
}

export function setBaseAllowance(s: Snapshot, clock: Clock, minutes: number): ChangeSet {
  return putSettings(s, clock, { baseDailyMinutes: requireNonNegativeInt(minutes, 'Daily allowance', 24 * 60) });
}

export function setOffers(s: Snapshot, clock: Clock, offers: TimeOffer[]): ChangeSet {
  if (offers.length === 0) throw new DomainError('invalid', 'Keep at least one time pack.');
  const valid = offers.map((o) => ({
    id: o.id,
    minutes: requireNonNegativeInt(o.minutes, 'Minutes', 24 * 60),
    coins: requireNonNegativeInt(o.coins, 'Price', 100_000),
  }));
  if (valid.some((o) => o.minutes === 0)) throw new DomainError('invalid', 'A time pack must grant at least 1 minute.');
  return putSettings(s, clock, { offers: valid });
}

export function completeOnboarding(
  s: Snapshot,
  clock: Clock,
  apps: { appRef: string; label: string }[],
  baseDailyMinutes: number,
): ChangeSet {
  const sel = setSelectedApps(s, clock, apps);
  const set = putSettings(s, clock, {
    onboarded: true,
    baseDailyMinutes: requireNonNegativeInt(baseDailyMinutes, 'Daily allowance', 24 * 60),
  });
  return changes({ put: { ...sel.put, ...set.put } });
}
