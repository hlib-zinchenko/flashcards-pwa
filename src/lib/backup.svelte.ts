import type { BackupStatus } from './backup';
import { loadPref, savePref } from './prefs';

export const backupStatus = $state<BackupStatus>({
  lastAt: loadPref<number | null>('lastBackupAt', null),
  sessionsSince: loadPref('sessionsSinceBackup', 0),
  firstSessionAt: loadPref<number | null>('firstSessionSinceBackupAt', null),
});

export function markBackedUp(now = Date.now()): void {
  backupStatus.lastAt = now;
  backupStatus.sessionsSince = 0;
  backupStatus.firstSessionAt = null;
  savePref('lastBackupAt', now);
  savePref('sessionsSinceBackup', 0);
  savePref('firstSessionSinceBackupAt', null);
}

export function countSession(now = Date.now()): void {
  if (backupStatus.firstSessionAt === null) {
    backupStatus.firstSessionAt = now;
    savePref('firstSessionSinceBackupAt', now);
  }
  backupStatus.sessionsSince++;
  savePref('sessionsSinceBackup', backupStatus.sessionsSince);
}
