import { loadPref, savePref } from './prefs';
import { DEFAULT_CONFIG, type TestConfig } from './session';

/** Test setup shared between the setup and run screens; remembered across launches. */
export const testState = $state({
  config: { ...DEFAULT_CONFIG, ...loadPref<Partial<TestConfig>>('testConfig', {}) } as TestConfig,
  /** Set when "retry missed" restricts the next run to specific cards. */
  onlyCardIds: null as string[] | null,
});

export function saveTestConfig(): void {
  savePref('testConfig', $state.snapshot(testState.config));
}
