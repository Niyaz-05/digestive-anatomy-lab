import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';

const SHOTS = 'docs/screenshots';
fs.mkdirSync(SHOTS, { recursive: true });

async function open(page: Page, query = '') {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`/${query}`);
  return errors;
}
async function ready(page: Page) {
  await expect(page.locator('.viewer[data-ready="true"]')).toBeVisible({ timeout: 90_000 });
  await settle(page);
}
/** Waits until the canvas has rendered two more frames (software WebGL can be slow to compile shaders). */
async function settle(page: Page, ms = 1000) {
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.waitForTimeout(ms);
}
const detailTitle = (page: Page) => page.locator('#detail-title');
const listButton = (page: Page, name: string | RegExp) => page.locator('.struct-list button', { hasText: name });
const radio = (page: Page, name: string) => page.getByRole('radio', { name, exact: true });

test('loads the digestive organs without console errors and with a clean main screen', async ({ page }) => {
  const errors = await open(page);
  await ready(page);
  await expect(page.getByRole('heading', { name: 'Digestive System', level: 1 })).toBeVisible();
  await expect(page.locator('aside.right')).toHaveCount(0);
  await expect(radio(page, 'Real')).toHaveAttribute('aria-checked', 'true');
  await page.screenshot({ path: `${SHOTS}/01-initial.png` });
  expect(errors).toEqual([]);
});

test('clicking the model selects the structure under the pointer', async ({ page }) => {
  await open(page);
  await ready(page);
  const box = (await page.locator('.viewer canvas').boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.55, box.y + box.height * 0.45);
  await expect(detailTitle(page)).toHaveText(/./);
  await expect(page.locator('aside.right')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/02-selected.png` });
});

test('search finds organs by name and synonym', async ({ page }) => {
  await open(page);
  await ready(page);
  const search = page.getByLabel('Search structures');
  await search.fill('esophagus');
  await search.press('Enter');
  await expect(detailTitle(page)).toHaveText('Oesophagus');
  await search.fill('ampulla of vater');
  await expect(page.locator('.search-results')).toContainText('Hepatopancreatic ampulla');
  await search.fill('zzzz');
  await expect(page.getByText('No structure matches')).toBeVisible();
  await search.press('Escape');
  await expect(page.locator('fieldset.layers')).toBeVisible();
});

test('an organ lists its parts and a part links back to its organ', async ({ page }) => {
  await open(page);
  await ready(page);
  await listButton(page, /^Duodenum$/).click();
  await expect(detailTitle(page)).toHaveText('Duodenum');
  await expect(page.locator('aside.right')).toContainText('5 parts');
  await page.locator('aside.right .chips button', { hasText: 'Duodenum, descending part' }).click();
  await expect(detailTitle(page)).toHaveText('Duodenum, descending part');
  await page.locator('aside.right .chip-row button', { hasText: 'Duodenum' }).click();
  await expect(detailTitle(page)).toHaveText('Duodenum');
});

test('colour by organ paints each organ', async ({ page }) => {
  await open(page);
  await ready(page);
  const canvas = page.locator('.viewer canvas');
  const real = await canvas.screenshot();
  await radio(page, 'Organs').click();
  await settle(page);
  expect(Buffer.compare(real, await canvas.screenshot())).not.toBe(0);
  await page.screenshot({ path: `${SHOTS}/03-colour-organs.png` });
});

test('layers hide and show structures; liver segments show through the liver', async ({ page }) => {
  await open(page);
  await ready(page);
  await expect(listButton(page, /^Caudate lobe/).locator('.tag')).toHaveText('hidden');
  await page.getByLabel('Liver segments').check();
  await expect(listButton(page, /^Caudate lobe/).locator('.tag')).toHaveCount(0);
  await page.getByLabel('Digestive tract').uncheck();
  await expect(listButton(page, /^Stomach/).locator('.tag')).toHaveText('hidden');
  await settle(page);
  await page.screenshot({ path: `${SHOTS}/04-liver-segments.png` });
});

test('isolate, zoom and reset', async ({ page }) => {
  await open(page);
  await ready(page);
  await listButton(page, /^Stomach$/).click();
  await page.getByLabel('Isolate').check();
  await expect(listButton(page, /^Jejunum/).locator('.tag')).toHaveText('hidden');
  await page.getByRole('button', { name: 'Zoom to' }).click();
  await settle(page);
  await page.screenshot({ path: `${SHOTS}/05-isolated-stomach.png` });
  await page.getByRole('button', { name: 'Reset' }).click();
  await expect(detailTitle(page)).toHaveCount(0);
  await expect(listButton(page, /^Jejunum/).locator('.tag')).toHaveCount(0);
});

test('camera presets switch views', async ({ page }) => {
  await open(page);
  await ready(page);
  const canvas = page.locator('.viewer canvas');
  const front = await canvas.screenshot();
  await page.getByRole('button', { name: 'Left side', exact: true }).click();
  await settle(page, 1200);
  expect(Buffer.compare(front, await canvas.screenshot())).not.toBe(0);
});

test('labels mode shows non-overlapping labels', async ({ page }) => {
  await open(page);
  await ready(page);
  await page.getByLabel('Labels').check();
  await settle(page, 1500);
  const shown = page.locator('.scene-label[data-state="shown"]');
  expect(await shown.count()).toBeGreaterThanOrEqual(3);
  const boxes = await shown.evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => [r.left, r.top, r.right, r.bottom]));
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const [a, b] = [boxes[i]!, boxes[j]!];
    expect(!(a[2]! <= b[0]! || b[2]! <= a[0]! || a[3]! <= b[1]! || b[3]! <= a[1]!), `labels ${i} and ${j} overlap`).toBe(false);
  }
  await page.screenshot({ path: `${SHOTS}/06-labels.png` });
});

test('the cut opens the organs and can be moved and turned off', async ({ page }) => {
  const errors = await open(page);
  await ready(page);
  const canvas = page.locator('.viewer canvas');
  const whole = await canvas.screenshot();
  await radio(page, 'Front').click();
  // The camera turns to face the cut, and the panel says what is kept.
  await expect(page.locator('[aria-label="Camera views"] button', { hasText: /^Front$/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.slice-hint')).toHaveText('Showing the back half');
  await page.getByLabel('Cut position').fill('0.05');
  await settle(page, 2500);
  expect(Buffer.compare(whole, await canvas.screenshot())).not.toBe(0);
  await page.screenshot({ path: `${SHOTS}/07-cut-coronal.png` });
  await radio(page, 'Top').click();
  await expect(page.locator('[aria-label="Camera views"] button', { hasText: /^Top$/ })).toHaveAttribute('aria-pressed', 'true');
  await page.getByLabel('Cut position').fill('0.3');
  await settle(page, 2500);
  await page.screenshot({ path: `${SHOTS}/08-cut-axial.png` });
  await radio(page, 'Off').click();
  await expect(page.getByLabel('Cut position')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('Digestion mode moves the food, follows its stage, and shows the juices', async ({ page }) => {
  test.slow();
  const errors = await open(page);
  await ready(page);
  await page.getByRole('button', { name: 'Digestion', exact: true }).click();
  const panel = page.locator('.digestion-panel');
  await expect(panel).toBeVisible();
  await expect(panel.locator('.phase')).toHaveAttribute('data-stage', /\w+/, { timeout: 30_000 });
  const first = await panel.locator('.phase').getAttribute('data-stage');
  await expect(panel.locator('.phase')).not.toHaveAttribute('data-stage', first!, { timeout: 120_000 });
  await expect(panel).toContainText('Bile');
  await expect(panel).toContainText('Pancreatic juice');
  await settle(page, 1500);
  await page.screenshot({ path: `${SHOTS}/09-digestion.png` });
  await page.getByRole('button', { name: 'Pause' }).click();
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
  await page.getByLabel('Food').uncheck();
  await expect(panel.locator('.phase')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('guided tour navigates forward, back, and finishes', async ({ page }) => {
  test.slow();
  await open(page);
  await ready(page);
  await page.getByRole('button', { name: 'Guided tour' }).click();
  await expect(page.getByText(/step 1 of 11/)).toBeVisible();
  await expect(page.locator('#tour-title')).toHaveText('The digestive system');
  await settle(page, 1200);
  await page.screenshot({ path: `${SHOTS}/10-tour-overview.png` });
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Next →' }).click();
  await expect(page.locator('#tour-title')).toHaveText('Duodenum: where the juices arrive');
  await settle(page, 2500);
  await page.screenshot({ path: `${SHOTS}/11-tour-duodenum-juices.png` });
  await page.getByRole('button', { name: '← Back' }).click();
  await expect(page.getByText(/step 3 of 11/)).toBeVisible();
  await page.locator('.tour-index button').last().click();
  await expect(page.getByText(/step 11 of 11/)).toBeVisible();
  await page.getByRole('button', { name: 'Finish' }).click();
  await expect(page.getByRole('button', { name: 'Anatomy' })).toHaveAttribute('aria-pressed', 'true');
});

test('phone layout: structures open from the dock and details follow a pick', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await ready(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await expect(page.locator('aside.left')).toBeHidden();
  await page.getByRole('button', { name: 'Structures' }).click();
  await listButton(page, /^Stomach$/).click();
  await expect(page.locator('aside.left')).toBeHidden();
  await expect(detailTitle(page)).toHaveText('Stomach');
  await page.screenshot({ path: `${SHOTS}/12-phone.png` });
});

test('the About sheet holds the HuBMAP and BodyParts3D credits', async ({ page }) => {
  await open(page);
  await ready(page);
  await page.getByRole('button', { name: /About this lab/ }).click();
  const dialog = page.getByRole('dialog', { name: 'About this lab' });
  await expect(dialog).toContainText('HuBMAP');
  await expect(dialog).toContainText('BodyParts3D');
  await expect(dialog).toContainText('CC Attribution 4.0');
  await page.screenshot({ path: `${SHOTS}/13-about.png` });
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});

test('without WebGL the learning content still works', async ({ page }) => {
  await open(page, '?nowebgl');
  await expect(page.getByRole('heading', { name: '3D view unavailable' })).toBeVisible();
  await listButton(page, /^Liver$/).click();
  await expect(detailTitle(page)).toHaveText('Liver');
});

test('a missing model shows an error with a working retry', async ({ page }) => {
  let fail = true;
  await page.route('**/models/digestive.glb', (route) => (fail ? route.fulfill({ status: 404, body: 'not found' }) : route.continue()));
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('The 3D model could not be loaded');
  fail = false;
  await page.getByRole('button', { name: 'Try again' }).click();
  await ready(page);
});

test('reduced motion: Digestion mode works without errors', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1366, height: 820 } });
  const page = await context.newPage();
  const errors = await open(page);
  await ready(page);
  await page.getByRole('button', { name: 'Digestion', exact: true }).click();
  await settle(page, 800);
  expect(errors).toEqual([]);
  await context.close();
});
