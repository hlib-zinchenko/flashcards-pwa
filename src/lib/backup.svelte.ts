import type { BackupStatus } from './backup';
import { loadPref, savePref } from './prefs';

export const backupStatus = $state<BackupStatus>({
  lastAt: loadPref<number | null>('lastBackupAt', null),
  sessionsSince: loadPref('sessionsSinceBackup', 0),
});

export function markBackedUp(now = Date.now()): void {
  backupStatus.lastAt = now;
  backupStatus.sessionsSince = 0;
  savePref('lastBackupAt', now);
  savePref('sessionsSinceBackup', 0);
}

export function countSession(): void {
  backupStatus.sessionsSince++;
  savePref('sessionsSinceBackup', backupStatus.sessionsSince);
}
