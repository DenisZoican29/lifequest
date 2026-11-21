/**
 * Platform boundary for app restriction (spec §6 "Minimum app-blocker contract").
 * UI and domain code never talk to FamilyControls / UsageStatsManager directly.
 *
 * In the browser POC, selection and usage are simulated and stored as normal domain records
 * (AppSelection, UsageEvent with simulationFlag=true), so the mock only mirrors restriction state.
 * Native adapters will additionally feed real usage in and apply real shields.
 */
export type AuthorizationStatus = 'granted' | 'denied' | 'not-determined';

export interface RestrictionState {
  blocked: boolean;
  remainingMinutes: number;
  /** Apps the restriction applies to. */
  appRefs: string[];
}

export interface AppBlocker {
  readonly platform: 'web-mock' | 'ios' | 'android';
  /** True when nothing outside this app is actually blocked. The UI must say so (spec §4). */
  readonly simulated: boolean;
  authorize(): Promise<AuthorizationStatus>;
  /** Native: present the system picker. Mock: selection is handled by in-app UI, returns null. */
  selectApps(): Promise<string[] | null>;
  /** Apply (or lift) restrictions for the shared budget. Called after every relevant change. */
  refreshRestrictions(state: RestrictionState): Promise<void>;
  getRestrictionState(): RestrictionState;
}

export class WebMockAppBlocker implements AppBlocker {
  readonly platform = 'web-mock' as const;
  readonly simulated = true;
  private state: RestrictionState = { blocked: false, remainingMinutes: 0, appRefs: [] };

  async authorize() {
    return 'granted' as const;
  }

  async selectApps() {
    return null;
  }

  async refreshRestrictions(state: RestrictionState) {
    this.state = { ...state, appRefs: [...state.appRefs] };
  }

  getRestrictionState() {
    return this.state;
  }
}
