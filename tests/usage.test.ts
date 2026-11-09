import { describe, expect, it } from 'vitest';
import { AGES, CARDS, LANGS, PLATFORMS, FORMS, STUDIED, referrer, toCount } from '../infra/usage-counter/index.mjs';
import { LANGUAGES } from '../src/lib/i18n/index.svelte';
import { ageBucket, cardsBucket, dayKey, deviceOf, shouldSend, studiedBucket, USAGE_HOST, type AppPing } from '../src/lib/usage';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 9, 12);

const UA = {
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  ipad: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  androidPhone: 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36',
  androidTablet: 'Mozilla/5.0 (Linux; Android 15; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36',
  windows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36 Edg/140.0',
  linux: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36',
};

describe('deviceOf', () => {
  it('tells phones, tablets and computers apart', () => {
    expect(deviceOf(UA.iphone, 5)).toEqual({ platform: 'ios', form: 'phone' });
    expect(deviceOf(UA.ipad, 5)).toEqual({ platform: 'ios', form: 'tablet' });
    expect(deviceOf(UA.ipad, 0)).toEqual({ platform: 'mac', form: 'desktop' });
    expect(deviceOf(UA.androidPhone, 5)).toEqual({ platform: 'android', form: 'phone' });
    expect(deviceOf(UA.androidTablet, 5)).toEqual({ platform: 'android', form: 'tablet' });
    expect(deviceOf(UA.windows, 0)).toEqual({ platform: 'windows', form: 'desktop' });
    expect(deviceOf(UA.linux, 0)).toEqual({ platform: 'linux', form: 'desktop' });
    expect(deviceOf('curl/8', 0)).toEqual({ platform: 'other', form: 'desktop' });
  });
});

describe('buckets', () => {
  it('rounds age, cards and the last study into ranges', () => {
    expect(ageBucket(NOW - DAY / 2, NOW)).toBe('0');
    expect(ageBucket(NOW - 7 * DAY, NOW)).toBe('1-7');
    expect(ageBucket(NOW - 30 * DAY, NOW)).toBe('8-30');
    expect(ageBucket(NOW - 90 * DAY, NOW)).toBe('31-90');
    expect(ageBucket(NOW - 400 * DAY, NOW)).toBe('91+');
    expect([0, 1, 50, 51, 500, 501, 2000, 2001].map(cardsBucket)).toEqual(['0', '1-50', '1-50', '51-500', '51-500', '501-2000', '501-2000', '2001+']);
    expect(studiedBucket(null, NOW)).toBe('never');
    expect(studiedBucket(NOW - 2 * DAY, NOW)).toBe('week');
    expect(studiedBucket(NOW - 20 * DAY, NOW)).toBe('month');
    expect(studiedBucket(NOW - 60 * DAY, NOW)).toBe('older');
  });
});

describe('shouldSend', () => {
  const base = { url: 'https://x.lambda-url.eu-north-1.on.aws/', host: USAGE_HOST, enabled: true, gpc: false, lastSentDay: '2026-11-08', today: '2026-11-09' };
  it('sends once a day from the real app only', () => {
    expect(shouldSend(base)).toBe(true);
    expect(shouldSend({ ...base, lastSentDay: '2026-11-09' })).toBe(false);
    expect(shouldSend({ ...base, host: 'localhost' })).toBe(false);
    expect(shouldSend({ ...base, host: 'flashcards.hzinchenko.com' })).toBe(false);
  });
  it('sends nothing when turned off, under Global Privacy Control, or before the counter exists', () => {
    expect(shouldSend({ ...base, enabled: false })).toBe(false);
    expect(shouldSend({ ...base, gpc: true })).toBe(false);
    expect(shouldSend({ ...base, url: '' })).toBe(false);
  });
  it('counts days by the local calendar', () => {
    expect(dayKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
});

describe('the counter (infra/usage-counter)', () => {
  const ping: AppPing = { kind: 'app', platform: 'ios', form: 'phone', installed: true, version: '0.18.0', lang: 'uk', age: '8-30', cards: '51-500', studied: 'week' };

  it('knows every value the app can send', () => {
    expect(LANGS).toEqual(LANGUAGES.map((l) => l.code));
    for (const n of [0, 1, 51, 501, 2001]) expect(CARDS).toContain(cardsBucket(n));
    for (const d of [0, 2, 10, 40, 100]) expect(AGES).toContain(ageBucket(NOW - d * DAY, NOW));
    for (const d of [2, 20, 60]) expect(STUDIED).toContain(studiedBucket(NOW - d * DAY, NOW));
    expect(STUDIED).toContain(studiedBucket(null, NOW));
    for (const ua of Object.values(UA)) {
      const { platform, form } = deviceOf(ua, 0);
      expect(PLATFORMS).toContain(platform);
      expect(FORMS).toContain(form);
    }
  });

  it('counts an app ping in the row for its UTC day and values', () => {
    expect(toCount(ping, new Date(NOW))).toEqual({
      pk: 'app#2026-11-09',
      sk: 'app|ios|phone|installed|0.18.0|uk|8-30|51-500|week',
      fields: { kind: 'app', platform: 'ios', form: 'phone', installed: 'installed', version: '0.18.0', lang: 'uk', age: '8-30', cards: '51-500', studied: 'week' },
    });
  });

  it('counts site views and clicks', () => {
    expect(toCount({ kind: 'view', page: 'ua', platform: 'android', form: 'phone', ref: 'www.google.com' }, new Date(NOW))?.sk).toBe('view|ua|android|phone|google.com');
    expect(toCount({ kind: 'open', page: 'en', platform: 'mac', form: 'desktop' }, new Date(NOW))?.pk).toBe('site#2026-11-09');
  });

  it('turns referrers into bare host names', () => {
    expect(referrer('')).toBe('direct');
    expect(referrer('app.karbka.com')).toBe('karbka.com');
    expect(referrer('https://evil.example/?q=1')).toBe('other');
    expect(referrer('x'.repeat(70) + '.com')).toBe('other');
  });

  it('refuses anything unexpected, so nothing else can be stored', () => {
    expect(toCount({ ...ping, lang: 'xx' })).toBeNull();
    expect(toCount({ ...ping, version: '1.0.0; drop' })).toBeNull();
    expect(toCount({ ...ping, installed: 'yes' })).toBeNull();
    expect(toCount({ ...ping, kind: 'other' })).toBeNull();
    expect(toCount({ kind: 'view', page: 'de', platform: 'ios', form: 'phone', ref: '' })).toBeNull();
    expect(toCount(null)).toBeNull();
    expect(toCount({ ...ping, id: 'abc' })?.sk).not.toContain('abc');
  });
});
