import { loadPref, savePref } from './prefs';
import { navigate } from './router.svelte';
import { parseSavedRun, type SavedRun } from './savedRun';
import { normalizeConfig, quickConfig, type TestConfig } from './session';
import type { Level } from './types';

/** Test setup shared between the setup and run screens; remembered across launches. */
export const testState = $state({
  config: normalizeConfig(loadPref<Partial<TestConfig>>('testConfig', {})),
  /** Set when "retry missed" restricts the next run to specific cards. */
  onlyCardIds: null as string[] | null,
  /** Route the session returns to when it's done: where it was started. */
  origin: '/test',
  /** The run screen should start a new session instead of resuming a saved one. */
  fresh: false,
});

const RUN_PREF = 'savedRun';

/** An unfinished session saved when the app went to the background; offered as "Resume session". */
// raw: plain data, replaced as a whole, read back by TestRun without Proxies.
class SavedRunStore {
  run = $state.raw<SavedRun | null>(parseSavedRun(loadPref<unknown>(RUN_PREF, null)));
}
export const savedRun = new SavedRunStore();

export function saveRun(run: SavedRun): void {
  savedRun.run = run;
  savePref(RUN_PREF, run);
}

export function clearSavedRun(): void {
  if (savedRun.run === null && loadPref<unknown>(RUN_PREF, null) === null) return;
  savedRun.run = null;
  savePref(RUN_PREF, null);
}

/** Open the run screen on the saved session. */
export function resumeRun(): void {
  testState.onlyCardIds = null;
  testState.fresh = false;
  navigate('/test/run');
}

export function saveTestConfig(): void {
  savePref('testConfig', $state.snapshot(testState.config));
}

/** Start a session from the route `origin`, which "Done" returns to. */
export function startSession(origin: string): void {
  testState.onlyCardIds = null;
  testState.origin = origin;
  testState.fresh = true;
  clearSavedRun();
  navigate('/test/run');
}

/** Start a session right away on these decks and levels, keeping the other saved settings. */
export function startQuick(deckIds: readonly string[], levels?: readonly Level[], origin = '/'): void {
  Object.assign(testState.config, quickConfig($state.snapshot(testState.config), deckIds, levels));
  saveTestConfig();
  startSession(origin);
}
