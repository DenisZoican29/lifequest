/**
 * Pure commands: (snapshot, clock, input) -> ChangeSet.
 * They never touch storage; the repository applies a ChangeSet atomically and
 * re-checks its guards inside the transaction (FR-16, spec §5 "Concurrency").
 */
import { addPeriod, isLocalDate } from './dates';
import { allowanceFor, coinBalance } from './economy';
import { newId } from './ids';
import { nextDueDate } from './recurrence';
import type {
  AppSelection,
  Cadence,
  ChangeSet,
  Goal,
  GoalStatus,
  Milestone,
  RecurrenceRule,
  Settings,
  Snapshot,
  TaskDefinition,
  TaskOccurrence,
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
  return { frequency: rule.frequency, interval: rule.interval, anchorPolicy: rule.anchorPolicy };
}

function find<T extends { id: string }>(rows: readonly T[], id: string, what: string): T {
  const row = rows.find((r) => r.id === id);
  if (!row) throw new DomainError('not-found', `${what} not found.`);
  return row;
}

// ---------------------------------------------------------------- goals

export interface GoalInput {
  title: string;
  description: string;
  cadence: Cadence;
  deadline?: string;
}

export function createGoal(_s: Snapshot, clock: Clock, input: GoalInput): ChangeSet {
  const now = clock.now().toISOString();
  const goal: Goal = {
    id: newId(),
    title: requireText(input.title, 'Title'),
    description: input.description.trim(),
    cadence: input.cadence,
    deadline: requireDate(input.deadline, 'Deadline'),
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };
  return changes({ put: { goals: [goal] } });
}

export function updateGoal(s: Snapshot, clock: Clock, id: string, input: GoalInput): ChangeSet {
  const goal = find(s.goals, id, 'Goal');
  return changes({
    put: {
      goals: [
        {
          ...goal,
          title: requireText(input.title, 'Title'),
          description: input.description.trim(),
          cadence: input.cadence,
          deadline: requireDate(input.deadline, 'Deadline'),
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

export interface TaskInput {
  title: string;
  description: string;
  taskType: TaskType;
  goalId?: string;
  rewardCoins: number;
  dueAt: string;
  recurrence?: RecurrenceRule;
  reminderDaysBefore?: number;
}

function validateTask(s: Snapshot, input: TaskInput) {
  const dueAt = requireDate(input.dueAt, 'Due date');
  if (!dueAt) throw new DomainError('invalid', 'Due date is required.');
  if (input.goalId) {
    if (input.taskType === 'side') throw new DomainError('invalid', 'Side quests cannot be linked to a goal.');
    find(s.goals, input.goalId, 'Goal');
  }
  return {
    title: requireText(input.title, 'Title'),
    description: input.description.trim(),
    taskType: input.taskType,
    goalId: input.taskType === 'main' ? input.goalId || undefined : undefined,
    rewardCoins: requireNonNegativeInt(input.rewardCoins, 'Coin reward', 10_000),
    dueAt,
    recurrence: validateRule(input.recurrence),
    reminderDaysBefore:
      input.reminderDaysBefore === undefined
        ? undefined
        : requireNonNegativeInt(input.reminderDaysBefore, 'Reminder', 365),
  };
}

export function createTask(s: Snapshot, clock: Clock, input: TaskInput): ChangeSet {
  const now = clock.now().toISOString();
  const task: TaskDefinition = {
    id: newId(),
    ...validateTask(s, input),
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

function followUp(task: TaskDefinition, occ: TaskOccurrence, finishedOn: string): TaskOccurrence[] {
  if (!task.recurrence || !task.active) return [];
  return [
    {
      id: newId(),
      taskDefinitionId: task.id,
      scheduledFor: nextDueDate(task.recurrence, task.dueAt, occ.scheduledFor, finishedOn),
      status: 'open',
    },
  ];
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
    put: { occurrences: [done, ...followUp(task, occ, today)], wallet },
    guards: [{ kind: 'occurrenceOpen', occurrenceId: occ.id }, { kind: 'uniqueIdempotencyKey', key }],
  });
}

/** Skips a recurring occurrence without reward and schedules the next one. */
export function skipOccurrence(s: Snapshot, clock: Clock, occurrenceId: string): ChangeSet {
  const occ = find(s.occurrences, occurrenceId, 'Quest');
  if (occ.status !== 'open') throw new DomainError('already-completed', 'This quest is already closed.');
  const task = find(s.tasks, occ.taskDefinitionId, 'Task');
  if (!task.recurrence) throw new DomainError('invalid', 'Only repeating quests can be skipped.');
  return changes({
    put: { occurrences: [{ ...occ, status: 'skipped' }, ...followUp(task, occ, clock.today())] },
    guards: [{ kind: 'occurrenceOpen', occurrenceId: occ.id }],
  });
}

/**
 * Moves an open occurrence to `days` from today without reward (spec design §10:
 * "A little behind schedule. Snooze, reschedule, or complete").
 */
export function snoozeOccurrence(s: Snapshot, clock: Clock, occurrenceId: string, days: number): ChangeSet {
  const occ = find(s.occurrences, occurrenceId, 'Quest');
  if (occ.status !== 'open') throw new DomainError('already-completed', 'This quest is already closed.');
  if (!Number.isInteger(days) || days < 1 || days > 365) throw new DomainError('invalid', 'Snooze must be 1–365 days.');
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
