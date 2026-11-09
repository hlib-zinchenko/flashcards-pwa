import { expect, test, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { en } from '../src/lib/i18n/en';
import { uk } from '../src/lib/i18n/uk';

// README screenshots from the demo library (docs/demo/demo-backup.json). Not part of the normal run:
//   npm run screenshots
// Writes docs/screenshots/*.png at 390×844, 2× (an iPhone-sized window in WebKit).
// SHOTS_LANG=uk takes the same set with the Ukrainian interface and a library for learning English
// (docs/demo/demo-backup-uk.json) into docs/screenshots/uk/, for the Ukrainian landing page.
test.skip(!process.env.SHOTS, 'set SHOTS=1 to take the README screenshots');
test.describe.configure({ timeout: 180_000 });
test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });

const LANG = process.env.SHOTS_LANG === 'uk' ? 'uk' : 'en';
const M = LANG === 'uk' ? uk : en;
const DEMO = {
  en: { file: 'demo-backup.json', home: 'Trip to Tokyo', collection: 'Japanese N5', deck: 'Japanese N5 verbs', tag: 'travel' },
  uk: { file: 'demo-backup-uk.json', home: 'Поїздка до Лондона', collection: 'Англійська B1', deck: 'Англійські дієслова', tag: 'подорож' },
}[LANG];
const backup = fileURLToPath(new URL(`../docs/demo/${DEMO.file}`, import.meta.url));
const dir = process.env.SHOTS_DIR ?? fileURLToPath(new URL(LANG === 'uk' ? '../docs/screenshots/uk/' : '../docs/screenshots/', import.meta.url));
// "Start · {n} cards" without the count.
const startLabel = new RegExp(`^${M['test.start'].split(' · ')[0]} · `);

async function shot(page: Page, name: string): Promise<void> {
  // Let toasts, entry animations and fonts settle.
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${dir}/${name}.png`, animations: 'disabled', caret: 'hide' });
}

async function importDemo(page: Page): Promise<void> {
  await page.goto('#/settings');
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: M['settings.import'] }).click();
  await (await chooser).setFiles(backup);
  await page.getByRole('button', { name: M['settings.replace'] }).first().click();
  await page.getByRole('button', { name: M['settings.replace'], exact: true }).last().click();
  await expect(page.getByText(DEMO.tag, { exact: true })).toBeVisible();
  // Start clean, without the "Backup imported" toast.
  await page.reload();
}

test('README screenshots', async ({ page }) => {
  await page.addInitScript((lang) => localStorage.setItem('lang', JSON.stringify(lang)), LANG);
  await importDemo(page);

  await page.goto('#/');
  await expect(page.getByText(DEMO.home)).toBeVisible();
  await shot(page, 'home');

  await page.getByText(DEMO.collection, { exact: true }).click();
  await expect(page.getByText(DEMO.deck)).toBeVisible();
  await shot(page, 'collection');

  await page.getByRole('button', { name: M['collection.settings'] }).click();
  await shot(page, 'collection-settings');
  await page.keyboard.press('Escape');

  await page.getByText(DEMO.deck).click();
  await expect(page.getByRole('heading', { name: DEMO.deck })).toBeVisible();
  await shot(page, 'deck');

  await page.getByRole('link', { name: M['nav.test'] }).click();
  await expect(page.getByRole('button', { name: startLabel })).toBeVisible();
  await shot(page, 'test-setup');

  await page.getByRole('button', { name: startLabel }).click();
  const gotIt = page.getByRole('button', { name: M['run.gestureOk'] });
  if (await gotIt.isVisible().catch(() => false)) await gotIt.click();
  await expect(page.locator('.flipper').first()).toBeVisible();

  // Answer a couple of cards so the counter and undo mean something.
  const answer = async (name: string) => {
    await page.getByRole('button', { name, exact: true }).click();
    await page.waitForTimeout(700);
  };
  await answer(M['run.know']);
  await answer(M['run.dontKnow']);
  await answer(M['run.know']);

  await page.getByRole('button', { name: M['run.flip'], exact: true }).click();
  await page.waitForTimeout(700);
  await page.getByRole('button', { name: M['run.showNotes'] }).last().click();
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
  await answer(M['run.dontKnow']);
  for (let i = 0; i < 3; i++) await answer(M['run.know']);
  await page.getByRole('button', { name: M['run.finish'] }).click();
  await shot(page, 'summary');
  await page.getByRole('button', { name: M['summary.done'] }).click();

  await page.goto('#/settings');
  await shot(page, 'settings');

  await page.evaluate(() => localStorage.setItem('theme', '"dark"'));
  await page.goto('#/');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByText(DEMO.collection, { exact: true }).click();
  await shot(page, 'collection-dark');
});
