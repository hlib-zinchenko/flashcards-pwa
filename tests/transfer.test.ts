import { describe, expect, it } from 'vitest';
import { LEGACY_ORIGIN, prefsToApply, readBackupMessage } from '../src/lib/transfer';

const OLD = 'https://flashcards.hzinchenko.com';
const msg = (extra: Record<string, unknown> = {}) => ({ type: 'karbka-transfer-backup', backup: '{}', prefs: {}, ...extra });

describe('readBackupMessage', () => {
  it('defaults to the old address', () => {
    expect(LEGACY_ORIGIN).toBe(OLD);
  });

  it('accepts a backup from the old address', () => {
    expect(readBackupMessage(OLD, msg({ prefs: { lang: 'uk' } }))).toEqual({ backup: '{}', prefs: { lang: 'uk' } });
  });

  it('ignores every other origin', () => {
    for (const origin of ['https://evil.example', 'http://flashcards.hzinchenko.com', 'https://flashcards.hzinchenko.com.evil.example', 'null']) {
      expect(readBackupMessage(origin, msg())).toBeNull();
    }
  });

  it('ignores other shapes', () => {
    for (const data of [null, 'text', 42, { type: 'karbka-transfer-ready' }, { type: 'karbka-transfer-backup', backup: {} }]) {
      expect(readBackupMessage(OLD, data)).toBeNull();
    }
  });

  it('keeps only known preferences', () => {
    const got = readBackupMessage(OLD, msg({ prefs: { theme: 'dark', lastBackupAt: 5, sneaky: 'x', lang: null } }));
    expect(got?.prefs).toEqual({ theme: 'dark', lastBackupAt: 5 });
  });

  it('works without prefs', () => {
    expect(readBackupMessage(OLD, { type: 'karbka-transfer-backup', backup: '{}' })?.prefs).toEqual({});
  });
});

describe('prefsToApply', () => {
  it('never overwrites what is already set here', () => {
    const set = new Set(['lang']);
    expect(prefsToApply({ lang: 'uk', theme: 'dark' }, (k) => set.has(k))).toEqual({ theme: 'dark' });
  });
});
