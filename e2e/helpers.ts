import { expect, type Page } from '@playwright/test';

/** Create a collection from the empty home screen, then a deck in it; ends on the deck screen. */
export async function createDeck(page: Page, collection = 'Japanese', deck = 'N5'): Promise<void> {
  await page.goto('#/');
  await page.getByRole('button', { name: 'New collection' }).first().click();
  await page.getByLabel('Collection name').fill(collection);
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('heading', { name: collection })).toBeVisible();
  await page.getByRole('button', { name: 'New deck' }).first().click();
  await page.getByLabel('Deck name').fill(deck);
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('heading', { name: deck })).toBeVisible();
}

/** Add cards on the deck screen. */
export async function addCards(page: Page, cards: [front: string, back: string][]): Promise<void> {
  for (const [front, back] of cards) {
    const addToggle = page.getByRole('button', { name: 'Add card' });
    if (!(await page.getByPlaceholder('Word, question…').first().isVisible())) await addToggle.first().click();
    await page.getByPlaceholder('Word, question…').first().fill(front);
    await page.getByPlaceholder('Meaning, answer…').first().fill(back);
    await page.getByPlaceholder('Meaning, answer…').first().press('Enter');
    await expect(page.getByText(front, { exact: true }).last()).toBeVisible();
  }
}

/** Drag horizontally across an element, as a finger swipe would. */
export async function swipe(page: Page, selector: string, direction: 'left' | 'right'): Promise<void> {
  const box = (await page.locator(selector).boundingBox())!;
  const y = box.y + box.height / 2;
  const x0 = box.x + box.width / 2;
  const x1 = x0 + (direction === 'right' ? 1 : -1) * box.width * 0.6;
  await page.mouse.move(x0, y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(x0 + ((x1 - x0) * i) / 8, y);
  await page.mouse.up();
}
