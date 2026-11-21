/**
 * Domain records. Independent of UI and storage engine (spec §5).
 * All timestamps are ISO strings; calendar days are local `YYYY-MM-DD` strings.
 */

export type ISODateTime = string;
/** Local calendar date, `YYYY-MM-DD`. */
export type LocalDate = string;

export type Cadence = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type GoalStatus = 'active' | 'completed' | 'archived';

export interface Goal {
  id: string;
  title: string;
  description: string;
  cadence: Cadence;
  deadline?: LocalDate;
  status: GoalStatus;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface Milestone {
  id: string;
  goalId: string;
  title: string;
  dueAt?: LocalDate;
  order: number;
  completedAt?: ISODateTime;
}

export type RecurrenceFrequency = 'day' | 'week' | 'month' | 'year';
/**
 * `completion`: next occurrence is `interval` after the day it was completed.
 * `calendar`: next occurrence stays on the original schedule grid (missed slots are skipped).
 */
export type AnchorPolicy = 'completion' | 'calendar';

export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  interval: number;
  anchorPolicy: AnchorPolicy;
}

export type TaskType = 'main' | 'side';

export interface TaskDefinition {
  id: string;
  title: string;
  description: string;
  taskType: TaskType;
  goalId?: string;
  rewardCoins: number;
  recurrence?: RecurrenceRule;
  /** First due date. */
  dueAt: LocalDate;
  /** Side quests: show a reminder this many days before the due date (in-app only in the POC). */
  reminderDaysBefore?: number;
  active: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export type OccurrenceStatus = 'open' | 'completed' | 'skipped';

export interface TaskOccurrence {
  id: string;
  taskDefinitionId: string;
  /** Local date this occurrence is due. */
  scheduledFor: LocalDate;
  status: OccurrenceStatus;
  completedAt?: ISODateTime;
  /** Simulated local date on which it was completed. */
  completedOn?: LocalDate;
  rewardTransactionId?: string;
}

export type WalletKind = 'earn' | 'spend' | 'adjust';
export type WalletSource = 'occurrence' | 'purchase' | 'manual';

export interface WalletTransaction {
  id: string;
  kind: WalletKind;
  /** Positive for credits, negative for debits. Integer. */
  coinDelta: number;
  sourceType: WalletSource;
  sourceId: string;
  reason: string;
  createdAt: ISODateTime;
  /** Unique: guarantees a reward/purchase is applied at most once. */
  idempotencyKey: string;
}

export interface TimeOffer {
  id: string;
  minutes: number;
  coins: number;
}

export interface TimePurchase {
  id: string;
  offerId: string;
  coinsSpent: number;
  minutesGranted: number;
  effectiveLocalDate: LocalDate;
  walletTransactionId: string;
  createdAt: ISODateTime;
}

export interface AppSelection {
  id: string;
  platform: 'web-mock' | 'ios' | 'android';
  label: string;
  /** Opaque token on native; mock id in the browser. */
  appRef: string;
  enabled: boolean;
  selectedAt: ISODateTime;
}

export interface UsageEvent {
  id: string;
  platform: 'web-mock' | 'ios' | 'android';
  appRef: string;
  localDate: LocalDate;
  durationMinutes: number;
  simulationFlag: boolean;
  createdAt: ISODateTime;
}

export type ThemePreference = 'system' | 'light' | 'dark';

export interface Settings {
  id: 'main';
  onboarded: boolean;
  baseDailyMinutes: number;
  offers: TimeOffer[];
  /** Simulated-clock offset in whole days (POC test control). */
  dayOffset: number;
  /** Appearance preference. */
  theme: ThemePreference;
  updatedAt: ISODateTime;
}

/** Everything persisted. Small enough to load fully in the POC. */
export interface Snapshot {
  settings: Settings;
  goals: Goal[];
  milestones: Milestone[];
  tasks: TaskDefinition[];
  occurrences: TaskOccurrence[];
  wallet: WalletTransaction[];
  purchases: TimePurchase[];
  apps: AppSelection[];
  usage: UsageEvent[];
}

export type TableName = Exclude<keyof Snapshot, 'settings'> | 'settings';

/** Preconditions re-checked inside the storage transaction. */
export type Guard =
  | { kind: 'minBalance'; coins: number }
  | { kind: 'occurrenceOpen'; occurrenceId: string }
  | { kind: 'uniqueIdempotencyKey'; key: string };

type Rows = {
  settings: Settings;
  goals: Goal;
  milestones: Milestone;
  tasks: TaskDefinition;
  occurrences: TaskOccurrence;
  wallet: WalletTransaction;
  purchases: TimePurchase;
  apps: AppSelection;
  usage: UsageEvent;
};

/** An atomic set of writes, produced by pure domain commands. */
export interface ChangeSet {
  put: { [K in TableName]?: Rows[K][] };
  delete: { [K in TableName]?: string[] };
  guards: Guard[];
}

export const DEFAULT_OFFERS: TimeOffer[] = [
  { id: 'pack-15', minutes: 15, coins: 25 },
  { id: 'pack-30', minutes: 30, coins: 45 },
  { id: 'pack-60', minutes: 60, coins: 80 },
];

export const DEFAULT_SETTINGS: Settings = {
  id: 'main',
  onboarded: false,
  baseDailyMinutes: 30,
  offers: DEFAULT_OFFERS,
  dayOffset: 0,
  theme: 'system',
  updatedAt: new Date(0).toISOString(),
};

export function emptySnapshot(): Snapshot {
  return {
    settings: { ...DEFAULT_SETTINGS, offers: [...DEFAULT_OFFERS] },
    goals: [],
    milestones: [],
    tasks: [],
    occurrences: [],
    wallet: [],
    purchases: [],
    apps: [],
    usage: [],
  };
}
