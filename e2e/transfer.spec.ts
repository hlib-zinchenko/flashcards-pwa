import { expect, test } from '@playwright/test';

// The old address runs a legacy build (127.0.0.1:4175) that moves the library to the new one
// (localhost:4174). Two origins, so two separate storages, as on the real domains.
const OLD = 'http://127.0.0.1:4175/';

test('the old address moves decks, cards and settings to the new one in one tap', async ({ page }) => {
  await page.goto(`${OLD}#/`);
  const moved = page.getByRole('dialog', { name: 'Karbka has moved' });
  await expect(moved).toBeVisible();
  await moved.getByRole('button', { name: 'Not now' }).click();

  // Make a library at the old address.
  await page.getByRole('button', { name: 'New collection' }).first().click();
  await page.getByLabel('Collection name').fill('Japanese');
  await page.getByRole('button', { name: 'Create' }).click();
  await page.getByRole('button', { name: 'New deck' }).first().click();
  await page.getByLabel('Deck name').fill('N5');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('heading', { name: 'N5' })).toBeVisible();
  for (const [front, back] of [['猫', 'cat'], ['犬', 'dog']]) {
    const frontField = page.getByPlaceholder('Word, question…').first();
    await expect(frontField.or(page.getByRole('button', { name: 'Add card' }).first())).toBeVisible();
    if (!(await frontField.isVisible())) await page.getByRole('button', { name: 'Add card' }).first().click();
    await frontField.fill(front);
    await page.getByPlaceholder('Meaning, answer…').first().fill(back);
    await page.getByPlaceholder('Meaning, answer…').first().press('Enter');
    await expect(page.getByText(front, { exact: true }).last()).toBeVisible();
  }
  await page.evaluate(() => localStorage.setItem('theme', JSON.stringify('dark')));

  // Next launch: the notice counts the cards and moves them.
  await page.reload();
  await expect(moved.getByText('Decks: 1. Cards: 2.')).toBeVisible();
  const [popup] = await Promise.all([page.waitForEvent('popup'), moved.getByRole('button', { name: 'Move my cards' }).click()]);

  await expect(popup).toHaveURL(/localhost:4174\/#\/import-legacy$/);
  await expect(popup.getByText('Your cards are here')).toBeVisible();
  await expect(popup.getByText('Decks: 1. Cards: 2.')).toBeVisible();
  // The old tab hears back too.
  await expect(moved.getByText('Your cards are here')).toBeVisible();

  await popup.getByRole('button', { name: 'Open my cards' }).click();
  // The collection used last at the old address opens, with its deck and the dark theme.
  await expect(popup.getByRole('heading', { name: 'Japanese' })).toBeVisible();
  await expect(popup.getByText('N5')).toBeVisible();
  expect(await popup.evaluate(() => localStorage.getItem('theme'))).toBe('"dark"');
});

test('the receiving page opened on its own explains where to start', async ({ page }) => {
  await page.goto('#/import-legacy');
  await expect(page.getByText(/This page receives cards from the old address/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible();
});

test('the receiving page ignores a library from any other address', async ({ page }) => {
  // A page on another origin (about:blank here) opens the receiver and sends it a backup: nothing is imported.
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.evaluate(() => {
      const win = window.open('http://localhost:4174/#/import-legacy', '_blank')!;
      const backup = JSON.stringify({ app: 'flashcards-pwa', schemaVersion: 2, exportedAt: 1, collections: [], decks: [], cards: [], tags: [] });
      setInterval(() => win.postMessage({ type: 'karbka-transfer-backup', backup, prefs: {} }, '*'), 200);
    }),
  ]);
  await expect(popup.getByText('Moving your cards from the old address…')).toBeVisible();
  await popup.waitForTimeout(1500);
  await expect(popup.getByText('Your cards are here')).toHaveCount(0);
});
