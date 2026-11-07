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

test('quick add saves notes, clears tags and flags a word already in another deck', async ({ page }) => {
  await createDeck(page, 'Japanese', 'Verbs');
  const form = page.locator('form.add');
  await form.getByPlaceholder('Word, question…').fill('食べる');
  await form.getByPlaceholder('Meaning, answer…').fill('to eat');
  await form.getByLabel('Notes').fill('ichidan');
  await form.getByRole('button', { name: 'verb' }).click();
  await form.getByLabel('Notes').press('Enter');
  await expect(page.getByText('Card added')).toBeVisible();
  // The form is ready for a fresh card: no notes, no tags.
  await expect(form.getByLabel('Notes')).toHaveValue('');
  await expect(form.getByRole('button', { name: 'verb' })).toHaveAttribute('aria-pressed', 'false');

  // The same word in another deck of the collection gets a hint but can still be added.
  await page.getByRole('link', { name: 'Back' }).click();
  await page.getByRole('button', { name: 'New deck' }).first().click();
  await page.getByLabel('Deck name').fill('Food');
  await page.getByRole('button', { name: 'Create' }).click();
  await form.getByPlaceholder('Word, question…').fill(' 食べる');
  await expect(form.getByRole('status')).toContainText('You already have this word');
  await expect(form.getByRole('status')).toContainText('Verbs · to eat');
  await form.getByPlaceholder('Meaning, answer…').fill('eating');
  await form.getByPlaceholder('Meaning, answer…').press('Enter');
  await expect(page.getByText('eating', { exact: true })).toBeVisible();
  await expect(form.getByRole('status')).toBeEmpty();
});

test('word search finds a card in any deck of the collection and opens its deck', async ({ page }) => {
  await createDeck(page, 'Japanese', 'Verbs');
  await addCards(page, [['食べる', 'to eat'], ['飲む', 'to drink']]);
  await page.getByRole('link', { name: 'Back' }).click();
  await page.getByRole('button', { name: 'New deck' }).first().click();
  await page.getByLabel('Deck name').fill('Food');
  await page.getByRole('button', { name: 'Create' }).click();
  await addCards(page, [['食べ物', 'food']]);
  await page.getByRole('link', { name: 'Back' }).click();

  await page.getByRole('button', { name: 'Search words' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('searchbox').fill('ＥＡＴ');
  await expect(dialog.getByRole('status')).toHaveText('1 card');
  await dialog.getByRole('button', { name: /食べる/ }).click();

  await expect(page.getByRole('heading', { name: 'Verbs' })).toBeVisible();
  await expect(page.getByPlaceholder('Search cards')).toHaveValue('食べる');
  await expect(page.getByText('to eat', { exact: true })).toBeVisible();
  await expect(page.getByText('to drink', { exact: true })).toHaveCount(0);
});

test('a session closed halfway can be resumed', async ({ page }) => {
  await createDeck(page);
  await addCards(page, [['猫', 'cat'], ['犬', 'dog'], ['鳥', 'bird']]);

  await page.getByRole('link', { name: 'Test' }).click();
  await page.getByRole('button', { name: /Start · 3 cards/ }).click();
  await page.getByRole('button', { name: 'Got it' }).click();
  await page.getByRole('button', { name: 'Know', exact: true }).click();
  await expect(page.getByText('1 / 3')).toBeVisible();
  const next = await page.locator('.flipper').first().innerText();

  // iOS closes a PWA in the background: hide the page, then load the app from scratch.
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.goto('/');
  await expect(page.getByText('Unfinished session')).toBeVisible();
  await expect(page.getByText('2 cards left')).toBeVisible();
  await page.getByRole('button', { name: 'Resume' }).click();
  await expect(page.getByText('1 / 3')).toBeVisible();
  expect(await page.locator('.flipper').first().innerText()).toBe(next);

  await page.getByRole('button', { name: 'Know', exact: true }).click();
  await expect(page.getByText('2 / 3')).toBeVisible();
  await page.getByRole('button', { name: 'Know', exact: true }).click();
  await expect(page.getByRole('heading', { name: '3 of 3 known' })).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByText('Unfinished session')).toHaveCount(0);
});

test('an unexpected error shows a toast and lands in the diagnostics', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
  await page.goto('#/settings');
  await page.evaluate(() => setTimeout(() => Promise.reject(new DOMException('could not be cloned', 'DataCloneError'))));
  await expect(page.getByText('Something went wrong')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Email hello@hzinchenko.com' })).toHaveAttribute('href', /^mailto:hello@hzinchenko\.com/);
  const log = await page.evaluate(() => localStorage.getItem('errorLog'));
  expect(log).toContain('DataCloneError: could not be cloned');
});

test('the Content-Security-Policy blocks nothing the app uses', async ({ page }) => {
  await page.addInitScript(() => {
    const seen: string[] = ((window as unknown as { cspViolations: string[] }).cspViolations = []);
    document.addEventListener('securitypolicyviolation', (e) => seen.push(`${e.violatedDirective} ${e.blockedURI}`));
  });
  const violations = () => page.evaluate(() => (window as unknown as { cspViolations: string[] }).cspViolations);
  // The theme script runs before first paint only if its hash matches.
  await page.addInitScript(() => localStorage.setItem('theme', '"dark"'));
  await createDeck(page);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await addCards(page, [['猫', 'cat']]);
  await page.getByRole('link', { name: 'Test' }).click();
  await page.getByRole('button', { name: /Start · 1 card/ }).click();
  await page.getByRole('button', { name: 'Got it' }).click();
  await page.getByRole('button', { name: 'Know', exact: true }).click();
  await expect(page.getByRole('heading', { name: '1 of 1 known' })).toBeVisible();
  await page.goto('#/settings');
  await expect(page.getByText('Copy diagnostics for a bug report')).toBeVisible();
  expect(await violations()).toEqual([]);
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

test('a deleted deck can be undone right away or restored from Recently deleted', async ({ page }) => {
  await createDeck(page, 'Japanese', 'Verbs');
  await addCards(page, [['食べる', 'to eat']]);
  const deleteDeck = async () => {
    await page.getByRole('button', { name: 'More' }).click();
    await page.getByRole('button', { name: 'Delete deck' }).click();
    await expect(page.getByText('You can restore it in Settings → Recently deleted.')).toBeVisible();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
  };

  await deleteDeck();
  await page.getByRole('button', { name: 'Undo' }).click();
  await page.goto('#/');
  await page.getByText('Japanese').click();
  await page.getByText('Verbs').click();
  await deleteDeck();

  await page.getByRole('link', { name: 'Settings' }).click();
  await page.getByRole('button', { name: /Recently deleted/ }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Verbs')).toBeVisible();
  await expect(dialog.getByText('Deck · 1 card · Deleted today')).toBeVisible();
  await dialog.getByRole('button', { name: 'Restore' }).click();
  await expect(dialog.getByText('Nothing deleted recently.')).toBeVisible();

  await page.goto('#/');
  await page.getByText('Japanese').click();
  await page.getByText('Verbs').click();
  await expect(page.getByText('食べる')).toBeVisible();
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
