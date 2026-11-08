import { describe, expect, it } from 'vitest';
import { IS_LEGACY, LEGACY_ORIGIN, NEW_ORIGIN, prefsToApply, readBackupMessage, readReply } from '../src/lib/transfer';

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

describe('readReply', () => {
  const NEW = 'https://app.karbka.com';

  it('defaults to the new address and a normal build', () => {
    expect(NEW_ORIGIN).toBe(NEW);
    expect(IS_LEGACY).toBe(false);
  });

  it('reads ready, done and failed from the new address', () => {
    expect(readReply(NEW, { type: 'karbka-transfer-ready' })).toEqual({ type: 'karbka-transfer-ready' });
    expect(readReply(NEW, { type: 'karbka-transfer-done', decks: 2, cards: 30, x: 1 })).toEqual({ type: 'karbka-transfer-done', decks: 2, cards: 30 });
    expect(readReply(NEW, { type: 'karbka-transfer-failed', error: 'boom' })).toEqual({ type: 'karbka-transfer-failed', error: 'boom' });
  });

  it('ignores other origins and shapes', () => {
    expect(readReply(OLD, { type: 'karbka-transfer-ready' })).toBeNull();
    expect(readReply('https://app.karbka.com.evil.example', { type: 'karbka-transfer-ready' })).toBeNull();
    expect(readReply(NEW, { type: 'karbka-transfer-done', decks: '2', cards: 30 })).toBeNull();
    expect(readReply(NEW, { type: 'karbka-transfer-backup', backup: '{}' })).toBeNull();
    expect(readReply(NEW, null)).toBeNull();
  });
});
