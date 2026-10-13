import { loadPref, savePref } from './prefs';
import { normalizeConfig, type TestConfig } from './session';

/** Test setup shared between the setup and run screens; remembered across launches. */
export const testState = $state({
  config: normalizeConfig(loadPref<Partial<TestConfig>>('testConfig', {})),
  /** Set when "retry missed" restricts the next run to specific cards. */
  onlyCardIds: null as string[] | null,
});

export function saveTestConfig(): void {
  savePref('testConfig', $state.snapshot(testState.config));
}
