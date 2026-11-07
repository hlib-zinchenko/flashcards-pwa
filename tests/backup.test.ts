import { describe, expect, it } from 'vitest';
import { BACKUP_NUDGE_DAYS, BACKUP_NUDGE_SESSIONS, backupDue, daysSince } from '../src/lib/backup';

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime();

describe('daysSince', () => {
  it('is 0 on the same day', () => expect(daysSince(at(2026, 11, 5, 0), at(2026, 11, 5, 23))).toBe(0));
  it('counts calendar days, not 24-hour periods', () => expect(daysSince(at(2026, 11, 4, 23), at(2026, 11, 5, 1))).toBe(1));
  it('counts across months', () => expect(daysSince(at(2026, 10, 24), at(2026, 11, 5))).toBe(12));
  it('never goes negative', () => expect(daysSince(at(2026, 11, 6), at(2026, 11, 5))).toBe(0));
});

describe('backupDue', () => {
  const now = at(2026, 11, 20);

  it('waits for enough sessions', () => {
    expect(backupDue({ lastAt: null, sessionsSince: BACKUP_NUDGE_SESSIONS - 1, firstSessionAt: at(2026, 11, 19) }, now)).toBeNull();
    expect(backupDue({ lastAt: null, sessionsSince: BACKUP_NUDGE_SESSIONS, firstSessionAt: at(2026, 11, 19) }, now)).toBe('sessions');
    expect(backupDue({ lastAt: at(2026, 1, 1), sessionsSince: 0, firstSessionAt: null }, now)).toBeNull();
  });

  it(`reminds about progress ${BACKUP_NUDGE_DAYS} days without a backup`, () => {
    expect(backupDue({ lastAt: at(2026, 10, 1), sessionsSince: 1, firstSessionAt: at(2026, 11, 14) }, now)).toBeNull();
    expect(backupDue({ lastAt: at(2026, 10, 1), sessionsSince: 1, firstSessionAt: at(2026, 11, 13) }, now)).toBe('days');
    expect(backupDue({ lastAt: null, sessionsSince: 2, firstSessionAt: at(2026, 11, 1) }, now)).toBe('days');
  });

  it('never reminds when nothing was studied since the last backup', () => {
    expect(backupDue({ lastAt: at(2026, 1, 1), sessionsSince: 0, firstSessionAt: null }, now)).toBeNull();
  });
});
