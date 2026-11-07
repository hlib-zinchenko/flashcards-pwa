import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { addCards, createDeck, swipe } from './helpers';

test('create a deck, study it by swiping, see the summary', async ({ page }) => {
  await createDeck(page);
  await addCards(page, [['猫', 'cat'], ['犬', 'dog']]);

  await page.getByRole('link', { name: 'Test' }).click();
  await page.getByRole('button', { name: /Start · 2 cards/ }).click();
  await page.getByRole('button', { name: 'Got it' }).click();

  // The counter shows answered / total.
  await expect(page.getByText('0 / 2')).toBeVisible();
  await swipe(page, '.flipper', 'right');
  await expect(page.getByText('1 / 2')).toBeVisible();
  await expect(page.getByText('犬').first()).toBeVisible();
  await swipe(page, '.flipper', 'left');
  // "Learn until known" (the default) brings the missed card back.
  await page.waitForTimeout(500);
  await expect(page.getByText('1 / 2')).toBeVisible();
  await page.getByRole('button', { name: 'Know', exact: true }).click();

  await expect(page.getByRole('heading', { name: '1 of 2 known' })).toBeVisible();
  await expect(page.getByText('Missed cards')).toBeVisible();
});

test('export a backup, wipe the library, import it back', async ({ page }) => {
  await createDeck(page);
  await addCards(page, [['猫', 'cat']]);

  await page.getByRole('link', { name: 'Settings' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export library' }).click();
  const download = await downloadPromise;
  const file = await download.path();
  const backup = JSON.parse(await readFile(file, 'utf8'));
  expect(backup.cards).toHaveLength(1);

  // Start over on a fresh origin state.
  await page.evaluate(async () => {
    indexedDB.deleteDatabase('flashcards');
  });
  await page.reload();
  await page.goto('#/');
  await expect(page.getByText('A collection holds decks')).toBeVisible();

  await page.getByRole('link', { name: 'Settings' }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import backup' }).click();
  await (await chooser).setFiles(file);
  await page.getByRole('button', { name: /Replace everything/ }).click();
  await page.getByRole('button', { name: 'Replace everything', exact: true }).click();

  await page.goto('#/');
  await page.getByText('Japanese').click();
  await page.getByText('N5').click();
  await expect(page.getByText('猫')).toBeVisible();
});

test('works offline after the first visit', async ({ page, context }) => {
  await page.goto('./');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  await createDeck(page);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'N5' })).toBeVisible();
  await context.setOffline(false);
});

test('a full deck takes no more cards; a big CSV is split into decks', async ({ page }, info) => {
  const { writeFile } = await import('node:fs/promises');
  const csv = info.outputPath('words.csv');
  await writeFile(csv, Array.from({ length: 1000 }, (_, i) => `w${i},m${i}`).join('\n'));

  await page.goto('#/');
  await page.getByRole('button', { name: 'New collection' }).first().click();
  await page.getByLabel('Collection name').fill('Big');
  await page.getByRole('button', { name: 'Create' }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import CSV' }).first().click();
  await (await chooser).setFiles(csv);
  await expect(page.getByText('2 decks')).toBeVisible();
  await page.getByRole('button', { name: 'Import 1000 cards' }).click();

  await expect(page.getByText('words 2', { exact: true })).toBeVisible();
  await page.getByText('words', { exact: true }).click();
  await expect(page.getByText('999 cards', { exact: true })).toBeVisible();
  await expect(page.getByText(/This deck is full/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add card' })).toHaveCount(0);
});
