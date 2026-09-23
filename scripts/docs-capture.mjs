#!/usr/bin/env node

/**
 * scripts/docs-capture.mjs — Generate annotated screenshots for the user guide.
 *
 * Starts the Vite dev server, seeds demo data, and captures the main views
 * (weekly dashboard, daily planning, offers, absences) into docs/captures/.
 * The user guide references these images; re-run after any UI change:
 *
 *   npm run docs:capture
 */

import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const CAPTURES_DIR = path.join(ROOT, 'docs', 'captures');
const BASE_URL = 'http://localhost:5193';

if (!fs.existsSync(CAPTURES_DIR)) {
  fs.mkdirSync(CAPTURES_DIR, { recursive: true });
}

// --- Start the Vite dev server ---
console.log('🚀 Starting Vite dev server...');
const dev = spawn('npx', ['vite', '--port', '5193', '--strictPort'], {
  cwd: ROOT,
  stdio: 'ignore',
  detached: true,
});
const pid = dev.pid;

const waitUntil = async (fn, timeoutMs = 30000, stepMs = 500) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await fn()) return true;
    await new Promise((r) => setTimeout(r, stepMs));
  }
  return false;
};

const up = await waitUntil(async () => {
  try {
    const res = await fetch(`${BASE_URL}/`);
    return res.ok;
  } catch {
    return false;
  }
});
if (!up) {
  console.error('❌ Dev server did not start');
  process.kill(-pid, 'SIGTERM');
  process.exit(1);
}
console.log('✅ Dev server up');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const shot = async (name, clip) => {
  const file = path.join(CAPTURES_DIR, `${name}.png`);
  await page.screenshot({ path: file, clip, fullPage: !clip ? true : undefined });
  console.log(`📸 ${name}.png`);
};

try {
  // Seed demo data with a fixed date so screenshots are reproducible:
  // the app seeds when localStorage is empty.
  await page.goto(`${BASE_URL}/?display=week`, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    localStorage.clear();
  });
  // Reload with a stable date deep in the seeded span
  await page.goto(`${BASE_URL}/?display=week&date=2026-10-05`, { waitUntil: 'networkidle' });
  // A Monday in the demo span, with slots in every status
  await page.waitForTimeout(1500);

  // 1. Weekly dashboard — full view (stats badge, legend, colored slots)
  await shot('weekly-dashboard');

  // 2. Weekly — zoom on the stats badge + legend area (annotated in guide)
  const legend = await page.$('.week-legend');
  if (legend) {
    const box = await legend.boundingBox();
    if (box) await page.screenshot({
      path: path.join(CAPTURES_DIR, 'weekly-legend.png'),
      clip: { x: 0, y: Math.max(0, box.y - 700), width: 1440, height: Math.min(900, box.y - Math.max(0, box.y - 700) + box.height + 40) },
    });
    console.log('📸 weekly-legend.png');
  }

  // 3. Daily view — dispatch REAL HTML5 drag events to capture the red
  // indicator. Playwright's mouse API alone does NOT trigger HTML5
  // dragstart/dragover; dispatching the events (with a pause for React to
  // flush the dragstart state) does.
  await page.goto(`${BASE_URL}/?display=day&date=2026-10-06`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const indicatorOk = await page.evaluate(async () => {
    const offer = document.querySelector('.daily-offer');
    const track = document.querySelector('.daily-mediators-section .daily-mediator-track');
    if (!offer || !track) return false;
    const dt = {
      effectAllowed: 'move', dropEffect: 'move',
      setData: () => {}, getData: () => '',
    };
    const mk = (type, x, y) => {
      const ev = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y });
      Object.defineProperty(ev, 'dataTransfer', { value: dt });
      return ev;
    };
    const ob = offer.getBoundingClientRect();
    const tb = track.getBoundingClientRect();
    offer.dispatchEvent(mk('dragstart', ob.x + 10, ob.y + 10));
    await new Promise((r) => setTimeout(r, 100));
    track.dispatchEvent(mk('dragover', tb.x + 300, tb.y + 10));
    await new Promise((r) => setTimeout(r, 100));
    return !!document.querySelector('.daily-drag-indicator');
  });
  if (indicatorOk) {
    await page.screenshot({
      path: path.join(CAPTURES_DIR, 'daily-drag-indicator.png'),
      clip: { x: 0, y: 0, width: 1440, height: 900 },
    });
    console.log('📸 daily-drag-indicator.png (red bar visible)');
  } else {
    console.log('⚠️ drag indicator not captured (fell back to plain view)');
    await shot('daily-drag-indicator');
  }
  await shot('daily-view');

  // 4. Offers view (setup/teardown fields visible in the modal)
  await page.goto(`${BASE_URL}/?display=offres`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await shot('offers-view');
  const editBtn = await page.$('.data-table .action-btn');
  if (editBtn) {
    await editBtn.click();
    await page.waitForTimeout(400);
    await shot('offer-modal');
    const close = await page.$('.modal-close, .modal .btn-secondary');
    if (close) await close.click();
  }

  // 5. Absences view
  await page.goto(`${BASE_URL}/?display=absences`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await shot('absences-view');

  // 6. Mediators view
  await page.goto(`${BASE_URL}/?display=mediators`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await shot('mediators-view');

  // 7. Import / Export view
  await page.goto(`${BASE_URL}/?display=import-export`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await shot('import-export-view');

  console.log('✅ All captures done');
} catch (e) {
  console.error('❌ Capture failed:', e.message);
  process.exitCode = 1;
} finally {
  await browser.close();
  process.kill(-pid, 'SIGTERM');
}
