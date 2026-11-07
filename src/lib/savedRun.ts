/**
 * A test session saved when the app goes to the background, so it can be resumed after iOS
 * closes the app. Grades are already in the database; this keeps the queue and the counters.
 */
import { MODES, type Direction, type SessionState } from './session';
import { LEVELS, type Level } from './types';

export interface SavedRun {
  savedAt: number;
  /** Route the session returns to when it's done. */
  origin: string;
  direction: Direction;
  session: SessionState;
  /** Card levels when the session started, for the summary. */
  startLevels: [string, Level][];
  /** Already counted toward the backup reminder. */
  counted: boolean;
}

/** A session left longer than this is no longer offered. */
export const SAVED_RUN_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

const isIdList = (x: unknown): x is string[] => Array.isArray(x) && x.every((id) => typeof id === 'string');
const isCount = (x: unknown): x is number => typeof x === 'number' && Number.isInteger(x) && x >= 0;

function isSessionState(x: unknown): x is SessionState {
  if (!x || typeof x !== 'object') return false;
  const s = x as Record<string, unknown>;
  return (
    isIdList(s.pool) &&
    MODES.includes(s.mode as SessionState['mode']) &&
    isIdList(s.queue) &&
    (s.current === null || typeof s.current === 'string') &&
    isCount(s.answered) &&
    isCount(s.knownCount) &&
    isIdList(s.learned) &&
    isIdList(s.missed) &&
    isIdList(s.firstTry) &&
    isIdList(s.attempted)
  );
}

/** The saved session if it's well-formed, unfinished and recent enough to offer; otherwise null. */
export function parseSavedRun(raw: unknown, now = Date.now()): SavedRun | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.savedAt !== 'number' || now - r.savedAt > SAVED_RUN_MAX_AGE) return null;
  if (typeof r.origin !== 'string' || !r.origin.startsWith('/')) return null;
  if (r.direction !== 'front' && r.direction !== 'back') return null;
  if (!isSessionState(r.session) || r.session.current === null) return null;
  if (!Array.isArray(r.startLevels)) return null;
  const startLevels = r.startLevels.filter(
    (e): e is [string, Level] => Array.isArray(e) && typeof e[0] === 'string' && LEVELS.includes(e[1]),
  );
  return {
    savedAt: r.savedAt,
    origin: r.origin,
    direction: r.direction,
    session: r.session,
    startLevels,
    counted: r.counted === true,
  };
}

/** Cards still to finish in a saved session, for the Resume prompt. */
export function savedRemaining(run: SavedRun): number {
  const s = run.session;
  return s.pool.length - (s.mode === 'cram' ? s.learned.length : s.attempted.length);
}
