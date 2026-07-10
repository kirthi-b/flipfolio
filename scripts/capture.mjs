/* Capture assets: social-preview.png (1280x640) + demo video for the GIF.
 * Uses the portfolio repo's Playwright install (not a package dependency).
 * Run: node scripts/capture.mjs  (expects a static server on :5179) */

import { chromium } from 'file:///Users/kirthi/Projects/kirthi-portfolio/node_modules/playwright/index.mjs';
import { mkdirSync } from 'node:fs';

const BASE = 'http://localhost:5179';
mkdirSync('assets', { recursive: true });
mkdirSync('assets/_video', { recursive: true });

const browser = await chromium.launch();

/* ── 1. Social preview: exact 1280x640 still ── */
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 640 }, deviceScaleFactor: 2 });
  await page.goto(`${BASE}/docs/social-preview.html`);
  await page.waitForSelector('.fg-card');
  await page.waitForTimeout(600); // fonts + first paint settle
  await page.screenshot({ path: 'assets/social-preview.png' });
  await page.close();
  console.log('social-preview.png done');
}

/* ── 2. Demo choreography: record video of the playground ── */
{
  const ctx = await browser.newContext({
    viewport: { width: 1080, height: 780 },
    recordVideo: { dir: 'assets/_video', size: { width: 1080, height: 780 } },
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/docs/index.html`);
  await page.waitForSelector('.fg-card');
  // Tighten the layout so controls + gallery both fit the frame.
  await page.evaluate(() => {
    document.querySelector('main').style.paddingTop = '1.2rem';
    document.querySelector('h1').style.display = 'none';
    document.querySelector('.tagline').style.display = 'none';
    document.querySelector('.hint').style.display = 'none';
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(900);                                  // settle on stack
  await page.evaluate(() => document.getElementById('fg').next());
  await page.waitForTimeout(950);
  await page.evaluate(() => document.getElementById('fg').next());
  await page.waitForTimeout(950);
  await page.click('button[data-mode="grid"]');                    // stack -> grid
  await page.waitForTimeout(1250);
  await page.click('button[data-mode="carousel"]');                // grid -> carousel
  await page.waitForTimeout(1150);
  await page.evaluate(() => document.getElementById('fg').next());
  await page.waitForTimeout(950);
  await page.click('button[data-mode="stack"]');                   // back to stack
  await page.waitForTimeout(1200);
  await page.close();
  await ctx.close(); // flushes the video file
  console.log('demo video recorded');
}

await browser.close();
