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
  // The sandbox layout already fits the viewport; nothing to hide.
  await page.waitForTimeout(900);                                  // settle on light manila stack
  await page.evaluate(() => document.getElementById('fg').next());
  await page.waitForTimeout(950);
  await page.evaluate(() => document.getElementById('fg').next());
  await page.waitForTimeout(950);
  await page.click('button[data-mode="grid"]');                    // stack -> grid
  await page.waitForTimeout(1250);
  await page.click('button[data-mode="carousel"]');                // grid -> carousel
  await page.waitForTimeout(1150);
  await page.click('button[data-mode="stack"]');                   // back to stack
  await page.waitForTimeout(1100);
  await page.click('button[data-content="photos"]');               // photo decals
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1200);
  await page.click('#peekBtn');                                    // peek toggled on ('hover' on desktop)
  // Peek is hover-gated: nothing slides out until the pointer is over the
  // scene. Hover it so the contents actually pull out on camera, then
  // navigate while hovering to show the retract / cycle / re-peek cadence.
  const scene = await page.$('.fg-scene');
  const sb = await scene.boundingBox();
  await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2, { steps: 12 });
  await page.waitForTimeout(1400);                                 // slide-out (180ms delay + transition) + hold
  await page.evaluate(() => document.getElementById('fg').next()); // retract -> cycle -> re-peek
  await page.waitForTimeout(1500);
  await page.mouse.move(sb.x + sb.width / 2, sb.y - 60, { steps: 8 }); // leave: contents tuck back in
  await page.waitForTimeout(700);
  await page.click('button[data-theme-pick="dark"]');              // dark studio to close
  await page.waitForTimeout(1100);
  await page.close();
  await ctx.close(); // flushes the video file
  console.log('demo video recorded');
}

await browser.close();
