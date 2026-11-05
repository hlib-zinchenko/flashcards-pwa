import { loadPref, savePref } from './prefs';
import { navigate } from './router.svelte';
import { normalizeConfig, quickConfig, type TestConfig } from './session';
import type { Level } from './types';

/** Test setup shared between the setup and run screens; remembered across launches. */
export const testState = $state({
  config: normalizeConfig(loadPref<Partial<TestConfig>>('testConfig', {})),
  /** Set when "retry missed" restricts the next run to specific cards. */
  onlyCardIds: null as string[] | null,
  /** Route the session returns to when it's done: where it was started. */
  origin: '/test',
});

export function saveTestConfig(): void {
  savePref('testConfig', $state.snapshot(testState.config));
}

/** Start a session from the route `origin`, which "Done" returns to. */
export function startSession(origin: string): void {
  testState.onlyCardIds = null;
  testState.origin = origin;
  navigate('/test/run');
}

/** Start a session right away on these decks and levels, keeping the other saved settings. */
export function startQuick(deckIds: readonly string[], levels?: readonly Level[], origin = '/'): void {
  Object.assign(testState.config, quickConfig($state.snapshot(testState.config), deckIds, levels));
  saveTestConfig();
  startSession(origin);
}
