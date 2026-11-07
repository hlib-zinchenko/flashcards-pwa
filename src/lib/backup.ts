/** Finished study sessions without a backup before the app suggests exporting. */
export const BACKUP_NUDGE_SESSIONS = 10;
/** Days since the first study session without a backup before the app suggests exporting. */
export const BACKUP_NUDGE_DAYS = 7;

export interface BackupStatus {
  /** When the library was last exported (ms), or null if never. */
  lastAt: number | null;
  /** Study sessions finished since then. */
  sessionsSince: number;
  /** When the first of those sessions finished (ms), or null if none yet. */
  firstSessionAt: number | null;
}

/** Whole calendar days (local time) from `then` to `now`: 0 = same day, 1 = yesterday. */
export function daysSince(then: number, now: number): number {
  const day = (ms: number) => {
    const d = new Date(ms);
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  };
  return Math.max(0, Math.round((day(now) - day(then)) / 86_400_000));
}

/**
 * Why it's time to remind the user to export a backup, or null if it isn't: many sessions, or progress
 * that's been without a backup for a week (someone studying once in a while never gets to 10 sessions).
 */
export function backupDue(status: BackupStatus, now: number): 'sessions' | 'days' | null {
  if (status.sessionsSince >= BACKUP_NUDGE_SESSIONS) return 'sessions';
  if (status.sessionsSince > 0 && status.firstSessionAt !== null && daysSince(status.firstSessionAt, now) >= BACKUP_NUDGE_DAYS) return 'days';
  return null;
}
