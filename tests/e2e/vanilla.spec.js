import { test, expect } from '@playwright/test';

const LABELS = ['Tokyo', 'Nairobi', 'São Paulo', 'Copenhagen', 'Mexico City'];

test.beforeEach(async ({ page }, testInfo) => {
  const problems = [];
  page.on('console', (m) => { if (m.type() === 'error') problems.push(`console: ${m.text()}`); });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('requestfailed', (r) => problems.push(`requestfailed: ${r.url()}`));
  testInfo.problems = problems;
  await page.goto('/vanilla/');
  await page.locator('.fg-card').first().waitFor();
});

test.afterEach(async ({}, testInfo) => {
  expect(testInfo.problems, 'no console errors, page errors or failed requests').toEqual([]);
});

const cards = (page) => page.locator('.fg-card');
const root = (page) => page.locator('#gallery');

test('renders one visible folder per item', async ({ page }) => {
  await expect(cards(page)).toHaveCount(LABELS.length);
  await expect(cards(page).first()).toBeVisible();
  const box = await cards(page).first().boundingBox();
  expect(box.width).toBeGreaterThan(100);
  expect(box.height).toBeGreaterThan(60);
  for (const [i, label] of LABELS.entries()) {
    await expect(cards(page).nth(i)).toHaveAttribute('aria-label', label);
    await expect(cards(page).nth(i).locator('.fg-label')).toHaveText(label);
  }
  await expect(cards(page).first()).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.fg-dot')).toHaveCount(LABELS.length);
});

test('mode switching: stack, grid, carousel and back', async ({ page }) => {
  const tops = () => cards(page).evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
  await expect(root(page)).toHaveAttribute('data-fg-mode', 'stack');
  const stackTops = await tops();

  await page.getByRole('button', { name: 'Grid' }).click();
  await expect(root(page)).toHaveAttribute('data-fg-mode', 'grid');
  await expect(page.getByRole('button', { name: 'Grid' })).toHaveClass(/active/);
  await expect(page.getByRole('button', { name: 'Stack' })).not.toHaveClass(/active/);
  await expect.poll(async () => new Set(await tops()).size).toBeGreaterThan(1); // multiple rows
  const widths = await cards(page).evaluateAll((els) => els.map((e) => e.style.width));
  expect(widths.every((w) => w.endsWith('px'))).toBe(true);

  await page.getByRole('button', { name: 'Carousel' }).click();
  await expect(root(page)).toHaveAttribute('data-fg-mode', 'carousel');
  await expect(page.getByRole('button', { name: 'Carousel' })).toHaveClass(/active/);
  await expect(cards(page).first()).toHaveAttribute('aria-selected', 'true');

  await page.getByRole('button', { name: 'Stack' }).click();
  await expect(root(page)).toHaveAttribute('data-fg-mode', 'stack');
  await expect.poll(tops).toEqual(stackTops);
});

test('keyboard navigation moves focus and selection', async ({ page }) => {
  await cards(page).first().focus();
  await expect(cards(page).first()).toBeFocused();

  await page.keyboard.press('ArrowRight');
  await expect(cards(page).nth(1)).toBeFocused();
  await expect(cards(page).nth(1)).toHaveAttribute('aria-selected', 'true');
  await expect(cards(page).nth(1)).toHaveAttribute('tabindex', '0');
  await expect(cards(page).first()).toHaveAttribute('tabindex', '-1');

  await page.keyboard.press('End');
  await expect(cards(page).last()).toBeFocused();
  await page.keyboard.press('ArrowRight'); // wraps (loop defaults to true)
  await expect(cards(page).first()).toBeFocused();

  await page.keyboard.press('ArrowLeft');
  await expect(cards(page).last()).toBeFocused();
  await page.keyboard.press('Home');
  await expect(cards(page).first()).toBeFocused();

  await expect(page.locator('[aria-live="polite"]')).toHaveText('1 of 5: Tokyo');
});

test('keyboard navigation keeps working after a mode switch', async ({ page }) => {
  await page.getByRole('button', { name: 'Carousel' }).click();
  await cards(page).first().focus();
  await page.keyboard.press('ArrowRight');
  await expect(cards(page).nth(1)).toBeFocused();
  await page.getByRole('button', { name: 'Grid' }).click();
  await cards(page).nth(1).focus();
  await page.keyboard.press('ArrowRight');
  await expect(cards(page).nth(2)).toBeFocused();
});
