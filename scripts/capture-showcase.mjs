/* Render the docs/showcase/*.html compositions to HD PNGs (2x device scale).
 * Run: node scripts/capture-showcase.mjs  (expects a static server on :5179) */

import { chromium } from 'file:///Users/kirthi/Projects/kirthi-portfolio/node_modules/playwright/index.mjs';
import { mkdirSync } from 'node:fs';

const BASE = 'http://localhost:5179/docs/showcase';
const SHOTS = [
  { file: 'real-content.html', out: 'real-content.png', w: 1600, h: 900 },
  { file: 'modes.html', out: 'modes.png', w: 2100, h: 860 },
  { file: 'any-content.html', out: 'any-content.png', w: 1760, h: 820 },
  { file: 'customize.html', out: 'customize.png', w: 1760, h: 820 },
];

mkdirSync('assets/showcase', { recursive: true });
const browser = await chromium.launch();

for (const s of SHOTS) {
  const page = await browser.newPage({ viewport: { width: s.w, height: s.h }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${BASE}/${s.file}`);
  await page.waitForSelector('.fg-card');
  await page.waitForLoadState('networkidle'); // remote images settle
  await page.waitForTimeout(700);
  await page.screenshot({ path: `assets/showcase/${s.out}` });
  console.log(`${s.out} done${errors.length ? '  ERRORS: ' + errors.join(' | ') : ''}`);
  await page.close();
}

await browser.close();
