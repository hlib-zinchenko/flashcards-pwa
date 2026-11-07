import { expect, test, type Page } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

// Load test: how the app copes with big libraries. Not part of the normal run:
//   PERF=1 npx playwright test perf
// Prints a timing table per scenario. Numbers are from desktop WebKit; a phone is several times slower.
test.skip(!process.env.PERF, 'set PERF=1 to run the load test');
test.describe.configure({ mode: 'serial', timeout: 600_000 });

interface Scenario {
  name: string;
  collections: number;
  decksPerCollection: number;
  cardsPerDeck: number;
}

const ONLY = process.env.PERF_ONLY;
const SCENARIOS = ([
  // Decks hold at most 999 cards (MAX_DECK_CARDS); the Test tab studies a whole collection at once.
  { name: '1 full deck (999)', collections: 1, decksPerCollection: 1, cardsPerDeck: 999 },
  { name: '10 full decks in a collection (~10k)', collections: 1, decksPerCollection: 10, cardsPerDeck: 999 },
  { name: '30 full decks in a collection (~30k)', collections: 1, decksPerCollection: 30, cardsPerDeck: 999 },
  { name: '50 full decks over 5 collections (~50k)', collections: 5, decksPerCollection: 10, cardsPerDeck: 999 },
  // Over the limit: only from backups made before it. Shows why the limit is there.
  { name: 'old 5k-card deck (over the limit)', collections: 1, decksPerCollection: 1, cardsPerDeck: 5_000 },
] satisfies Scenario[]).filter((s) => !ONLY || s.name.startsWith(ONLY));

const words = ['猫', 'いぬ', 'たべる', 'のむ', 'ありがとう', 'がっこう', 'でんしゃ', 'あたらしい'];
function backup(s: Scenario) {
  const now = Date.now();
  const collections: object[] = [], decks: object[] = [], cards: object[] = [];
  for (let k = 0; k < s.collections; k++) {
    collections.push({ id: `k${k}`, name: `Collection ${k}`, position: k, languages: [{ lang: 'ja-JP' }], createdAt: now, updatedAt: now });
    for (let d = 0; d < s.decksPerCollection; d++) {
      const deckId = `k${k}d${d}`;
      decks.push({ id: deckId, name: `Deck ${k}.${d}`, collectionId: `k${k}`, speech: { front: 'ja-JP' }, position: k * s.decksPerCollection + d, createdAt: now, updatedAt: now });
      for (let c = 0; c < s.cardsPerDeck; c++) {
        const i = cards.length;
        cards.push({
          id: `c${i}`, deckId, front: `${words[i % words.length]} ${i}`, back: `meaning number ${i}, a little longer`,
          notes: i % 3 === 0 ? `example sentence for card ${i} with some notes` : '',
          tags: i % 2 ? ['noun'] : ['verb'], position: c, level: i % 6, timesSeen: i % 7, timesKnown: i % 5, timesMissed: i % 3,
          lastReviewedAt: i % 4 ? now - i * 1000 : undefined, createdAt: now, updatedAt: now,
        });
      }
    }
  }
  return { app: 'flashcards-pwa', schemaVersion: 2, exportedAt: now, collections, decks, cards, tags: [] };
}

async function timed(page: Page, fn: () => Promise<unknown>): Promise<number> {
  const t0 = Date.now();
  await fn();
  return Date.now() - t0;
}

const results: Record<string, Record<string, string | number>> = {};

for (const s of SCENARIOS) {
  test(s.name, async ({ page }, info) => {
    const total = s.collections * s.decksPerCollection * s.cardsPerDeck;
    const file = info.outputPath('backup.json');
    const text = JSON.stringify(backup(s));
    await writeFile(file, text);
    const r: Record<string, string | number> = { cards: total, 'backup MB': +(text.length / 1e6).toFixed(1) };

    await page.goto('#/settings');
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Import backup' }).click();
    await (await chooser).setFiles(file);
    await page.getByRole('button', { name: /Replace everything/ }).click();
    r['import ms'] = await timed(page, async () => {
      await page.getByRole('button', { name: 'Replace everything', exact: true }).click();
      await expect(page.getByText('Backup imported')).toBeVisible({ timeout: 300_000 });
    });

    // Cold start on the collections list (live queries load every card).
    await page.goto('#/');
    r['launch → home ms'] = await timed(page, async () => {
      await page.reload();
      await expect(page.getByText('Collection 0', { exact: true })).toBeVisible({ timeout: 120_000 });
    });

    r['open collection ms'] = await timed(page, async () => {
      await page.getByText('Collection 0', { exact: true }).click();
      await expect(page.getByText('Deck 0.0', { exact: true })).toBeVisible({ timeout: 120_000 });
    });

    r['open deck ms'] = await timed(page, async () => {
      await page.getByText('Deck 0.0', { exact: true }).click();
      await expect(page.locator('.card-row').nth(s.cardsPerDeck - 1)).toBeAttached({ timeout: 120_000 });
    });
    r['deck DOM nodes'] = await page.evaluate(() => document.getElementsByTagName('*').length);

    r['search ms'] = await timed(page, async () => {
      await page.getByPlaceholder('Search').fill(`${words[1]} 1`);
      await expect(page.locator('.card-row').first()).toContainText(words[1]);
    });

    r['clear search ms'] = await timed(page, async () => {
      await page.getByPlaceholder('Search').fill('');
      await expect(page.locator('.card-row').nth(s.cardsPerDeck - 1)).toBeAttached({ timeout: 300_000 });
    });

    if (s.cardsPerDeck >= 999) {
      // A full deck offers no add form, only the hint.
      await expect(page.getByText(/This deck is full/)).toBeVisible();
      r['add card ms'] = 'deck full';
    } else {
      // Measured in the page: polling Playwright locators over thousands of rows is itself slow.
      if (!(await page.getByPlaceholder('Word, question…').first().isVisible())) await page.getByRole('button', { name: 'Add card' }).first().click();
      await page.getByPlaceholder('Word, question…').first().fill('perf-new');
      await page.getByPlaceholder('Meaning, answer…').first().fill('new');
      r['add card ms'] = await page.evaluate(() => new Promise<number>((resolve) => {
        const t0 = performance.now();
        const list = document.querySelector('ul.cards')!;
        const done = () => requestAnimationFrame(() => requestAnimationFrame(() => resolve(Math.round(performance.now() - t0))));
        new MutationObserver((_, mo) => {
          if (list.lastElementChild?.textContent?.includes('perf-new')) { mo.disconnect(); done(); }
        }).observe(list, { childList: true, subtree: true });
        (document.querySelector('form button[type=submit]') as HTMLButtonElement).click();
      }));
    }

    await page.getByRole('link', { name: 'Test' }).click();
    const start = page.getByRole('button', { name: /^Start · / });
    const inCollection = s.decksPerCollection * s.cardsPerDeck + (s.cardsPerDeck >= 999 ? 0 : 1);
    r['test setup ms'] = await timed(page, () => expect(start).toBeEnabled({ timeout: 120_000 }));
    r['start test ms'] = await timed(page, async () => {
      await start.click();
      await expect(page.getByText(`0 / ${inCollection}`, { exact: true })).toBeVisible({ timeout: 120_000 });
    });
    const gotIt = page.getByRole('button', { name: 'Got it' });
    if (await gotIt.isVisible()) await gotIt.click();
    const grades: number[] = [];
    for (let i = 1; i <= 9; i++) {
      grades.push(await timed(page, async () => {
        await page.getByRole('button', { name: 'Know', exact: true }).click();
        await expect(page.getByText(new RegExp(`^${i} / \\d+$`))).toBeVisible({ timeout: 60_000 });
      }));
    }
    r['grade ms (median of 9)'] = grades.sort((a, b) => a - b)[4];

    r['finish → summary ms'] = await timed(page, async () => {
      await page.getByRole('button', { name: 'Finish' }).click();
      await expect(page.getByRole('heading', { name: /of \d+ known/ })).toBeVisible({ timeout: 60_000 });
    });
    await page.goto('#/settings');
    r['export ms'] = await timed(page, async () => {
      const download = page.waitForEvent('download', { timeout: 120_000 });
      await page.getByRole('button', { name: 'Export library' }).click();
      await download;
    });
    r['storage used'] = (await page.locator('text=/\\d+(\\.\\d)? (MB|KB)/').first().textContent().catch(() => '')) ?? '';

    results[s.name] = r;
    console.log(`\n${s.name}\n${Object.entries(r).map(([k, v]) => `  ${k.padEnd(24)} ${v}`).join('\n')}`);
  });
}
