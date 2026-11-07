import { expect, test, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';

// README screenshots from the demo library (docs/demo/demo-backup.json). Not part of the normal run:
//   npm run screenshots
// Writes docs/screenshots/*.png at 390×844, 2× (an iPhone-sized window in WebKit).
test.skip(!process.env.SHOTS, 'set SHOTS=1 to take the README screenshots');
test.describe.configure({ timeout: 180_000 });
test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });

const backup = fileURLToPath(new URL('../docs/demo/demo-backup.json', import.meta.url));
const dir = process.env.SHOTS_DIR ?? fileURLToPath(new URL('../docs/screenshots/', import.meta.url));

async function shot(page: Page, name: string): Promise<void> {
  // Let toasts, entry animations and fonts settle.
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${dir}/${name}.png`, animations: 'disabled', caret: 'hide' });
}

async function importDemo(page: Page): Promise<void> {
  await page.goto('#/settings');
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import backup' }).click();
  await (await chooser).setFiles(backup);
  await page.getByRole('button', { name: /Replace everything/ }).click();
  await page.getByRole('button', { name: 'Replace everything', exact: true }).click();
  await expect(page.getByText('travel', { exact: true })).toBeVisible();
  // Start clean, without the "Backup imported" toast.
  await page.reload();
}

test('README screenshots', async ({ page }) => {
  await importDemo(page);

  await page.goto('#/');
  await expect(page.getByText('Trip to Tokyo')).toBeVisible();
  await shot(page, 'home');

  await page.getByText('Japanese N5').click();
  await expect(page.getByText('Japanese N5 verbs')).toBeVisible();
  await shot(page, 'collection');

  await page.getByRole('button', { name: 'Collection settings' }).click();
  await shot(page, 'collection-settings');
  await page.keyboard.press('Escape');

  await page.getByText('Japanese N5 verbs').click();
  await expect(page.getByRole('heading', { name: 'Japanese N5 verbs' })).toBeVisible();
  await shot(page, 'deck');

  await page.getByRole('link', { name: 'Test' }).click();
  await expect(page.getByRole('button', { name: /^Start · / })).toBeVisible();
  await shot(page, 'test-setup');

  await page.getByRole('button', { name: /^Start · / }).click();
  const gotIt = page.getByRole('button', { name: 'Got it' });
  if (await gotIt.isVisible().catch(() => false)) await gotIt.click();
  await expect(page.locator('.flipper').first()).toBeVisible();

  // Answer a couple of cards so the counter and undo mean something.
  const answer = async (name: string) => {
    await page.getByRole('button', { name, exact: true }).click();
    await page.waitForTimeout(700);
  };
  await answer('Know');
  await answer('Don’t know');
  await answer('Know');

  await page.getByRole('button', { name: 'Flip', exact: true }).click();
  await page.waitForTimeout(700);
  await page.getByRole('button', { name: 'Notes' }).last().click();
  await shot(page, 'test-back');

  // Halfway through a swipe to the right.
  const box = (await page.locator('.flipper').first().boundingBox())!;
  const y = box.y + box.height * 0.8; // below the buttons on the card
  const x0 = box.x + box.width / 2;
  await page.mouse.move(x0, y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(x0 + (box.width * 0.42 * i) / 8, y - (box.height * 0.04 * i) / 8);
  await shot(page, 'test-swipe');
  await page.mouse.up();

  await page.waitForTimeout(700);
  await answer('Don’t know');
  for (let i = 0; i < 3; i++) await answer('Know');
  await page.getByRole('button', { name: 'Finish' }).click();
  await shot(page, 'summary');
  await page.getByRole('button', { name: 'Done' }).click();

  await page.goto('#/settings');
  await shot(page, 'settings');

  await page.evaluate(() => localStorage.setItem('theme', '"dark"'));
  await page.goto('#/');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByText('Japanese N5').click();
  await shot(page, 'collection-dark');
});
