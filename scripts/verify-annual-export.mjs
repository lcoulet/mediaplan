// E2E verification of the annual-view Excel export (slice 5).
// Drives a real browser against the running Vite dev server, clicks the
// Exporter Excel button, saves the downloaded .xlsx, then hands over to
// the Python/openpyxl verification step.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const OUT_DIR = '/home/loic/.hermes/profiles/dev/cache/scratch/annual-export-e2e';
fs.mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ acceptDownloads: true });
const page = await context.newPage();

// Listen to console errors to catch client-side failures
const consoleErrors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('pageerror', (err) => consoleErrors.push(String(err)));

// Open the annual view on a fixed 2026 date (fresh localStorage -> demo data)
const url = 'http://localhost:5178/?display=tableau&date=2026-09-30';
console.log('navigating:', url);
await page.goto(url, { waitUntil: 'networkidle' });

// Wait for the grid to render
await page.waitForSelector('.agrid', { timeout: 30000 });
console.log('grid rendered');

// Sanity: the export button exists
const btn = page.locator('.annual-export-btn');
await btn.waitFor({ state: 'visible', timeout: 10000 });
console.log('export button visible:', await btn.count() === 1);

// Click and capture the download
const [download] = await Promise.all([
  page.waitForEvent('download', { timeout: 30000 }),
  btn.click(),
]);
const suggested = download.suggestedFilename();
const target = path.join(OUT_DIR, suggested);
await download.saveAs(target);
console.log('DOWNLOADED:', suggested, '->', target);
console.log('SIZE:', fs.statSync(target).size);

// Console errors?
console.log('CONSOLE_ERRORS:', JSON.stringify(consoleErrors));

await browser.close();
console.log('E2E_OK');
