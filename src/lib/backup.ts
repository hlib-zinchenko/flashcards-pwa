/** Finished study sessions without a backup before the app suggests exporting. */
export const BACKUP_NUDGE_SESSIONS = 10;

export interface BackupStatus {
  /** When the library was last exported (ms), or null if never. */
  lastAt: number | null;
  /** Study sessions finished since then. */
  sessionsSince: number;
}

/** Whole calendar days (local time) from `then` to `now`: 0 = same day, 1 = yesterday. */
export function daysSince(then: number, now: number): number {
  const day = (ms: number) => {
    const d = new Date(ms);
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  };
  return Math.max(0, Math.round((day(now) - day(then)) / 86_400_000));
}

/** True when it's time to remind the user to export a backup. */
export function backupDue(status: BackupStatus): boolean {
  return status.sessionsSince >= BACKUP_NUDGE_SESSIONS;
}
