// verify-guide.mjs — verify the BUILT standalone guide page (dist/guide/)
// served by vite preview. Throws on failure.
import { spawn, execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const BASE = 'http://localhost:4193';

const preview = spawn('npx', ['vite', 'preview', '--port', '4193', '--strictPort'], {
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
  try { return (await fetch(`${BASE}/guide/index.html`)).ok; } catch { return false; }
});
if (!up) { console.error('❌ preview server did not start'); process.kill(-preview.pid, 'SIGTERM'); process.exit(1); }

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const failures = [];
try {
  const mdRes = await page.goto(`${BASE}/guide/index.html`, { waitUntil: 'networkidle' });
  if (!mdRes.ok()) failures.push(`page HTTP ${mdRes.status()}`);

  // 1. markdown fetched and rendered
  const md = await page.evaluate(() => fetch('user-guide.md').then((r) => r.ok ? r.text() : null));
  if (!md) failures.push('user-guide.md not fetchable');
  const sections = await page.$$eval('#guide h2', (hs) => hs.length);
  if (sections !== 9) failures.push(`expected 9 H2 chapters, got ${sections}`);

  // 2. TOC built from H2s, same count, all links resolve
  const tocLinks = await page.$$eval('#toc a', (as) => as.map((a) => a.textContent.trim()));
  if (tocLinks.length !== sections) failures.push(`TOC has ${tocLinks.length} links, ${sections} H2s`);
  const anchorOk = await page.evaluate(() => {
    const ids = new Set(Array.from(document.querySelectorAll('#guide h2')).map((h) => h.id));
    return Array.from(document.querySelectorAll('#toc a')).every((a) => ids.has(a.getAttribute('href').slice(1)));
  });
  if (!anchorOk) failures.push('TOC link without matching anchor');

  // 3. every chapter title present in TOC
  const expected = ['Concepts clés', 'Prise en main', 'Gérer les médiateurs',
    'Affecter les offres', 'Imports & sauvegardes', 'Les autres vues', 'Lexique',
    'Raccourcis clavier & URLs', 'Repères visuels'];
  for (const t of expected) {
    if (!tocLinks.some((l) => l.includes(t))) failures.push(`TOC missing chapter: ${t}`);
  }

  // 4. images all loaded
  const imgs = await page.$$eval('img', (is) => is.map((i) => ({ src: i.getAttribute('src'), ok: i.naturalWidth > 0 })));
  const broken = imgs.filter((i) => !i.ok);
  if (broken.length) failures.push(`broken images: ${broken.map((i) => i.src).join(', ')}`);
  if (imgs.length !== 8) failures.push(`expected 8 images, got ${imgs.length}`);

  // 5. click first TOC link → anchor navigates
  await page.click('#toc a');
  const hash = await page.evaluate(() => location.hash);
  if (!hash || hash === '#') failures.push('TOC click did not set location.hash');

  // 6. active-highlight updates on scroll
  await page.evaluate(() => document.querySelectorAll('#guide h2')[5].scrollIntoView());
  await page.waitForTimeout(800);
  const active = await page.evaluate(() => {
    const a = document.querySelector('#toc a.active');
    return a ? a.textContent.trim() : null;
  });
  if (!active) failures.push('no active TOC link after scroll');
  if (active && !active.includes('Les autres vues')) failures.push(`active link is "${active}", expected "Les autres vues"`);

  // 7. offline/local-data chapter and sharing instructions present
  const hasOffline = await page.evaluate(() =>
    document.body.textContent.includes('ne sort jamais') ||
    document.body.textContent.includes('stockées') && document.body.textContent.includes('navigateur'));
  if (!hasOffline) failures.push('offline-data concept text missing');

  console.log(`H2 chapters: ${sections}, TOC links: ${tocLinks.length}, images: ${imgs.length}, active after scroll: ${active}`);
} catch (e) {
  failures.push('exception: ' + e.message);
} finally {
  await browser.close();
  process.kill(-preview.pid, 'SIGTERM');
}

if (failures.length) {
  console.error('❌ FAILURES:\n - ' + failures.join('\n - '));
  process.exit(1);
}
console.log('✅ Guide page verified: TOC, anchors, images, offline-data chapter all OK');
