import { db } from './db';
import { i18n } from './i18n/index.svelte';
import { install } from './install.svelte';
import { loadPref, savePref } from './prefs';
import { ageBucket, cardsBucket, dayKey, deviceOf, shouldSend, studiedBucket, USAGE_URL, type AppPing } from './usage';

/** Whether the daily count is sent (Settings → Usage counts). On unless turned off. */
export const usage = $state({ enabled: loadPref('usageCounts', true) });

export function setUsageEnabled(enabled: boolean): void {
  usage.enabled = enabled;
  savePref('usageCounts', enabled);
}

/** A test was finished: the count says "studied this week" without saying what or how much. */
export function noteStudied(now = Date.now()): void {
  savePref('lastStudiedAt', now);
}

/** When this device first opened the app. Libraries from before the counter take their oldest collection or deck. */
async function firstOpenedAt(now: number): Promise<number> {
  const saved = loadPref<number | null>('firstOpenedAt', null);
  if (saved !== null) return saved;
  const [collections, decks] = await Promise.all([db.collections.toArray(), db.decks.toArray()]);
  const first = Math.min(now, ...collections.map((c) => c.createdAt), ...decks.map((d) => d.createdAt));
  savePref('firstOpenedAt', first);
  return first;
}

/** When a test was last finished. Libraries from before the counter look it up once from the cards. */
async function lastStudiedAt(): Promise<number | null> {
  const saved = loadPref<number | null | undefined>('lastStudiedAt', undefined);
  if (saved !== undefined) return saved;
  let last: number | null = null;
  await db.cards.each((c) => {
    if (c.lastReviewedAt !== undefined && (last === null || c.lastReviewedAt > last)) last = c.lastReviewedAt;
  });
  savePref('lastStudiedAt', last);
  return last;
}

let sending = false;

/** Send today's count if it's due. Safe to call often: on launch and whenever the app comes back to the screen. */
export async function sendDailyCount(date = new Date()): Promise<void> {
  const today = dayKey(date);
  const due = shouldSend({
    url: USAGE_URL,
    host: location.hostname,
    enabled: usage.enabled,
    gpc: (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true,
    lastSentDay: loadPref<string | null>('usageSentDay', null),
    today,
  });
  if (!due || sending) return;
  sending = true;
  try {
    const now = date.getTime();
    const ping: AppPing = {
      kind: 'app',
      ...deviceOf(navigator.userAgent, navigator.maxTouchPoints),
      installed: install.standalone,
      version: __APP_VERSION__,
      lang: i18n.lang,
      age: ageBucket(await firstOpenedAt(now), now),
      cards: cardsBucket(await db.cards.count()),
      studied: studiedBucket(await lastStudiedAt(), now),
    };
    // text/plain and no-cors: a plain request with no preflight and no cookies; the answer isn't needed.
    await fetch(USAGE_URL, {
      method: 'POST',
      mode: 'no-cors',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      keepalive: true,
      headers: { 'content-type': 'text/plain' },
      body: JSON.stringify(ping),
    });
    savePref('usageSentDay', today);
  } catch {
    // Offline or blocked: try again next time.
  } finally {
    sending = false;
  }
}
