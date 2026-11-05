import { loadPref, savePref } from './prefs';
import { navigate } from './router.svelte';
import { normalizeConfig, quickConfig, type TestConfig } from './session';
import type { Level } from './types';

/** Test setup shared between the setup and run screens; remembered across launches. */
export const testState = $state({
  config: normalizeConfig(loadPref<Partial<TestConfig>>('testConfig', {})),
  /** Set when "retry missed" restricts the next run to specific cards. */
  onlyCardIds: null as string[] | null,
});

export function saveTestConfig(): void {
  savePref('testConfig', $state.snapshot(testState.config));
}

/** Start a session right away on these decks and levels, keeping the other saved settings. */
export function startQuick(deckIds: readonly string[], levels?: readonly Level[]): void {
  Object.assign(testState.config, quickConfig($state.snapshot(testState.config), deckIds, levels));
  saveTestConfig();
  testState.onlyCardIds = null;
  navigate('/test/run');
}
