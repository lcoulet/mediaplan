#!/usr/bin/env node
// Verify the "?" button opens the guide modal with rendered markdown + images
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
// Serve the production build
const server = spawn('npx', ['vite', 'preview', '--port', '5195', '--strictPort'], {
  cwd: ROOT, stdio: 'ignore', detached: true,
});

const waitUntil = async (fn, timeoutMs = 30000) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await fn()) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
};

const up = await waitUntil(async () => {
  try { return (await fetch('http://localhost:5195/')).ok; } catch { return false; }
});
console.log('preview server up:', up);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

try {
  await page.goto('http://localhost:5195/', { waitUntil: 'networkidle' });
  const guideBtn = await page.$('#btn-user-guide');
  if (!guideBtn) throw new Error('? button not found');
  await guideBtn.click();
  await page.waitForTimeout(800);

  // Guide modal visible with rendered content
  const body = await page.$('.user-guide-body');
  console.log('modal body present:', !!body);
  const headings = await page.$$eval('.user-guide-body h2', (els) => els.map((e) => e.textContent));
  console.log('h2 sections:', headings.slice(0, 6));
  const imgs = await page.$$eval('.user-guide-body img', (els) =>
    els.map((e) => ({ src: e.getAttribute('src'), ok: e.naturalWidth > 0 }))
  );
  console.log(`images: ${imgs.length}, loaded: ${imgs.filter((i) => i.ok).length}`);
  await page.screenshot({ path: path.join(ROOT, 'docs/captures/guide-modal.png'), clip: { x: 0, y: 0, width: 1440, height: 900 } });
  console.log('📸 guide-modal.png');
} catch (e) {
  console.error('FAIL:', e.message);
  process.exitCode = 1;
} finally {
  await browser.close();
  process.kill(-server.pid, 'SIGTERM');
}
