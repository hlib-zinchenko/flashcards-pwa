/**
 * The daily usage count: once a day per device the app adds 1 to a count in Karbka's own DynamoDB table
 * (infra/usage-counter/). Only the coarse values built here are sent, never an ID, cards or anything
 * typed. The counter checks each one against the same lists (tests/usage.test.ts keeps them in step).
 * Settings → Usage counts explains it and turns it off; Global Privacy Control turns it off too.
 */

/** The counter's Function URL. Empty until it's deployed, and then nothing is sent. Also allow its origin in `connect-src` in index.html. */
export const USAGE_URL = '';
/** Only the real app counts, not dev servers, previews, tests or the legacy build. */
export const USAGE_HOST = 'app.karbka.com';

export type Platform = 'ios' | 'android' | 'mac' | 'windows' | 'linux' | 'other';
export type Form = 'phone' | 'tablet' | 'desktop';

export interface AppPing {
  kind: 'app';
  platform: Platform;
  form: Form;
  installed: boolean;
  version: string;
  lang: string;
  age: '0' | '1-7' | '8-30' | '31-90' | '91+';
  cards: '0' | '1-50' | '51-500' | '501-2000' | '2001+';
  studied: 'week' | 'month' | 'older' | 'never';
}

const DAY = 86_400_000;

/** The kind of device, from the user agent. iPadOS reports a Mac, so a Mac with a touch screen is an iPad. */
export function deviceOf(userAgent: string, maxTouchPoints: number): { platform: Platform; form: Form } {
  if (/iPad/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1)) return { platform: 'ios', form: 'tablet' };
  if (/iPhone|iPod/.test(userAgent)) return { platform: 'ios', form: 'phone' };
  if (/Android/.test(userAgent)) return { platform: 'android', form: /Mobile/.test(userAgent) ? 'phone' : 'tablet' };
  if (/Macintosh/.test(userAgent)) return { platform: 'mac', form: 'desktop' };
  if (/Windows/.test(userAgent)) return { platform: 'windows', form: 'desktop' };
  if (/Linux/.test(userAgent) && !/CrOS/.test(userAgent)) return { platform: 'linux', form: 'desktop' };
  return { platform: 'other', form: /Mobi/.test(userAgent) ? 'phone' : 'desktop' };
}

/** Days since the device first opened the app. */
export function ageBucket(firstOpenedAt: number, now: number): AppPing['age'] {
  const days = Math.floor((now - firstOpenedAt) / DAY);
  if (days < 1) return '0';
  if (days <= 7) return '1-7';
  if (days <= 30) return '8-30';
  if (days <= 90) return '31-90';
  return '91+';
}

export function cardsBucket(n: number): AppPing['cards'] {
  if (n === 0) return '0';
  if (n <= 50) return '1-50';
  if (n <= 500) return '51-500';
  if (n <= 2000) return '501-2000';
  return '2001+';
}

/** When a test was last finished on this device. */
export function studiedBucket(lastStudiedAt: number | null, now: number): AppPing['studied'] {
  if (lastStudiedAt === null) return 'never';
  const days = (now - lastStudiedAt) / DAY;
  if (days <= 7) return 'week';
  if (days <= 30) return 'month';
  return 'older';
}

/** The local calendar day, so "once a day" follows the person's own midnight. */
export function dayKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Whether to send today's count. */
export function shouldSend(o: { url: string; host: string; enabled: boolean; gpc: boolean; lastSentDay: string | null; today: string }): boolean {
  return o.url !== '' && o.host === USAGE_HOST && o.enabled && !o.gpc && o.lastSentDay !== o.today;
}
