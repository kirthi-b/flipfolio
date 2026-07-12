/* Capture the launch clip on the mockup stage (docs/mockup.html): the
 * gallery floats in a paper window on a blurred wallpaper, with a fake
 * cursor so recordings show the hand. Borrows Playwright from the
 * portfolio repo (not a package dependency).
 * Run: node scripts/capture-mockup.mjs   (expects a static server on :5179)
 * Then: ffmpeg the webm in assets/_video to gif/mp4 (see README of scripts). */

import { chromium } from 'file:///Users/kirthi/Projects/kirthi-portfolio/node_modules/playwright/index.mjs';
import { mkdirSync } from 'node:fs';

const BASE = 'http://localhost:5179';
mkdirSync('assets/_video', { recursive: true });

const browser = await chromium.launch();

/* Hero still, 2x */
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
  await page.goto(`${BASE}/docs/mockup.html`);
  await page.waitForSelector('.fg-card');
  await page.waitForTimeout(800);
  await page.mouse.move(640, 430);
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'assets/mockup-hero.png' });
  await page.close();
  console.log('mockup-hero.png done');
}

/* Choreography: three throws, a grid trip, photo decals */
{
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    recordVideo: { dir: 'assets/_video', size: { width: 1280, height: 800 } },
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/docs/mockup.html`);
  await page.waitForSelector('.fg-card');
  await page.waitForTimeout(1000);

  async function fling(dx, dy) {
    const b = await (await page.$('.fg-card.is-active')).boundingBox();
    const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
    await page.mouse.move(cx, cy, { steps: 8 });
    await page.waitForTimeout(180);
    await page.mouse.down();
    await page.mouse.move(cx + dx, cy + dy, { steps: 12 });
    await page.mouse.up();
  }

  await fling(-240, -50);
  await page.waitForTimeout(1500);
  await fling(-240, -40);
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.fg.setMode('grid'));
  await page.waitForTimeout(1600);
  await page.evaluate(() => window.fg.setMode('stack'));
  await page.waitForTimeout(1300);
  await page.evaluate(() => window.setPhotos(true));
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1300);
  await fling(-240, -50);
  await page.waitForTimeout(1700);
  await page.close();
  await ctx.close();
  console.log('mockup video recorded');
}

await browser.close();
