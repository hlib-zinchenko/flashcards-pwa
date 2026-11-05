import { describe, expect, it } from 'vitest';
import { BACKUP_NUDGE_SESSIONS, backupDue, daysSince } from '../src/lib/backup';

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime();

describe('daysSince', () => {
  it('is 0 on the same day', () => expect(daysSince(at(2026, 11, 5, 0), at(2026, 11, 5, 23))).toBe(0));
  it('counts calendar days, not 24-hour periods', () => expect(daysSince(at(2026, 11, 4, 23), at(2026, 11, 5, 1))).toBe(1));
  it('counts across months', () => expect(daysSince(at(2026, 10, 24), at(2026, 11, 5))).toBe(12));
  it('never goes negative', () => expect(daysSince(at(2026, 11, 6), at(2026, 11, 5))).toBe(0));
});

describe('backupDue', () => {
  it('waits for enough sessions', () => {
    expect(backupDue({ lastAt: null, sessionsSince: BACKUP_NUDGE_SESSIONS - 1 })).toBe(false);
    expect(backupDue({ lastAt: null, sessionsSince: BACKUP_NUDGE_SESSIONS })).toBe(true);
    expect(backupDue({ lastAt: at(2026, 1, 1), sessionsSince: 0 })).toBe(false);
  });
});
