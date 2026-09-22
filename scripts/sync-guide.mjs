#!/usr/bin/env node

/**
 * scripts/sync-guide.mjs — Copy the user guide into public/ so the app's
 * "?" button can serve it (dev and production build).
 *
 * Run as part of the build (see package.json: build runs this first).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const SRC_GUIDE = path.join(ROOT, 'docs', 'user-guide.md');
const SRC_CAPTURES = path.join(ROOT, 'docs', 'captures');
const SRC_PAGE = path.join(ROOT, 'docs', 'guide'); // standalone guide page assets
const DST_DIR = path.join(ROOT, 'public', 'guide');
const DST_CAPTURES = path.join(DST_DIR, 'captures');

fs.mkdirSync(DST_CAPTURES, { recursive: true });
fs.copyFileSync(SRC_GUIDE, path.join(DST_DIR, 'user-guide.md'));

// Standalone guide page (? button opens it in a new tab)
for (const f of fs.readdirSync(SRC_PAGE)) {
  fs.copyFileSync(path.join(SRC_PAGE, f), path.join(DST_DIR, f));
}

let count = 0;
for (const f of fs.readdirSync(SRC_CAPTURES)) {
  if (f.endsWith('.png')) {
    fs.copyFileSync(path.join(SRC_CAPTURES, f), path.join(DST_CAPTURES, f));
    count++;
  }
}
console.log(`✅ Guide synced: user-guide.md + ${count} captures → public/guide/`);
