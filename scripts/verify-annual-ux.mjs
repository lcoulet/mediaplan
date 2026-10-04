// verify-annual-ux.mjs — Real-browser verification of the 5 annual-view UX
// fixes (2026-10-04), with latency measurements:
//   1. perf memoization — paint/menu interactions < 100ms
//   2. menu close button
//   3. cell hover highlight (computed outline style)
//   4. paint exit control (side-effect free, banner wording)
//   5. rich hover tooltip (title attribute content)
// Runs against the Vite dev server on port 5177 with SEED data injected
// through localStorage (no app state pollution beyond the browser profile).
import { chromium } from 'playwright';

const BASE = 'http://localhost:5177/';

// ---- Seed data: realistic volume (12 mediators, 80 absences, 400 slots) ----
function isoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function mkCycle(id, anchor) {
  return {
    id, mediatorId: id.split('_')[1] ? `m_${id.split('_')[1]}` : id, name: 'Cycle',
    anchorIsoWeek: anchor, weeks: [
      {
        id: `${id}_w1`, name: 'S1',
        days: [1, 2, 3, 4, 5, 6, 7].map((day) =>
          day <= 5 ? { day, startTime: '09:30', endTime: '18:00' } : { day }),
      },
    ],
  };
}

const mediators = Array.from({ length: 12 }, (_, i) => ({
  id: `m_${i}`, firstName: `Prénom${i}`, lastName: `Nom${i}`,
  email: '', phone: '', notes: '', color: '#FF0000', active: i < 10,
  competences: [], activeCycleId: `cyc_${i}`, contractType: 'temps plein',
}));
const cycles = mediators.map((_, i) => {
  const c = mkCycle(`cyc_${i}`, '2026-W06');
  c.mediatorId = `m_${i}`;
  return c;
});
const absences = [];
for (let i = 0; i < 80; i++) {
  const m = mediators[i % 10];
  const d = new Date(2026, 0, 1 + ((i * 4) % 360));
  absences.push({
    id: `a_${i}`, mediatorId: m.id, startDate: isoDate(d), endDate: isoDate(d),
    halfDay: i % 3 === 0 ? 'morning' : i % 3 === 1 ? 'afternoon' : undefined,
    type: i % 4 === 0 ? 'leave' : i % 4 === 1 ? 'sick' : i % 4 === 2 ? 'mission' : 'other',
    notes: i % 4 === 0 ? 'CA' : i % 4 === 1 ? 'AM' : i % 4 === 2 ? 'Réf. WE' : 'TELE',
  });
}
const slots = [];
for (let i = 0; i < 400; i++) {
  const d = new Date(2026, 0, 1 + (i % 365));
  slots.push({
    id: `s_${i}`, scheduleId: '', date: isoDate(d), startTime: '10:00', endTime: '12:00',
    offerId: 'o1', mediatorIds: [`m_${i % 10}`], status: 'planned', origin: 'manual',
    participantCount: 0, notes: '', importSource: '', importedAt: '', modifiedAfterImport: false,
    groupName: '', guide: '', location: '', groupNature: '', contactName: '', contactPhone: '', contactEmail: '',
  });
}
const seed = {
  mediators, offers: [], schedules: [], slots, absences, cycles, quotas: [], spaces: [],
  lastModified: new Date().toISOString(),
};

const results = [];
const report = (name, ok, detail) => {
  results.push({ name, ok, detail });
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
await page.addInitScript((data) => {
  localStorage.setItem('mediaplan_data_v1', JSON.stringify(data));
}, seed);

try {
  // ---- Navigate to the annual view ----
  const t0 = Date.now();
  await page.goto(`${BASE}?display=tableau&date=2026-06-10`);
  await page.waitForSelector('#annual-row-2026-06-10', { timeout: 30000 });
  const loadMs = Date.now() - t0;
  report('annual view renders (365 rows)', true, `${loadMs}ms to interactive row visible`);

  const rowCount = await page.locator('tbody tr[id^="annual-row-"]').count();
  report('365 day rows rendered', rowCount === 365, `${rowCount} rows`);
  const cellCount = await page.locator('td.c').count();
  report('cells rendered', true, `${cellCount} cells (365×10×2 = ${365 * 10 * 2})`);

  // ---- Fix 3: hover highlight ----
  const cell = page.locator('#annual-row-2026-06-10 td.c').first();
  await cell.hover();
  const hoverOutline = await cell.evaluate((el) => getComputedStyle(el).outlineStyle);
  const hoverOutlineWidth = await cell.evaluate((el) => getComputedStyle(el).outlineWidth);
  report('fix 3: cell hover highlight', hoverOutline === 'solid',
    `outline ${hoverOutline} ${hoverOutlineWidth}`);

  // ---- Fix 5: rich hover tooltip ----
  const title = await cell.getAttribute('title');
  const rich = title && /Prénom0 Nom0/.test(title) && /2026-06-10/.test(title);
  report('fix 5: rich tooltip on cell', !!rich, JSON.stringify(title));

  // ---- Fix 2 + 1: menu open + close button ----
  // In-page latency: dispatch → menu visible on the next frame (no
  // Playwright roundtrip inside the measurement).
  const menuMs = await page.evaluate(async () => {
    const td = document.querySelector('#annual-row-2026-06-10 td.c');
    const t0 = performance.now();
    td.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 300, clientY: 300 }));
    await new Promise((resolve) => {
      const check = () => {
        if (document.querySelector('.acm')) resolve(null);
        else requestAnimationFrame(check);
      };
      requestAnimationFrame(check);
    });
    return Math.round((performance.now() - t0) * 10) / 10;
  });
  report('fix 1: menu opens fast', menuMs < 100, `${menuMs}ms in-page (target <100ms)`);
  const closeBtn = page.locator('.acm-close');
  report('fix 2: menu close button present', await closeBtn.count() === 1);
  await closeBtn.click();
  report('fix 2: close button dismisses the menu', (await page.locator('.acm').count()) === 0);

  // ---- Fix 1: paint-mode click latency (< 100ms per cell) ----
  // Enter paint: pick CA then activate paint
  await cell.click();
  await page.locator('.acm-chip', { hasText: 'CA' }).first().click();
  await page.waitForSelector('.acm', { state: 'detached' });
  await cell.click();
  await page.getByRole('menuitem', { name: /Peindre ce code/ }).click();
  await page.waitForSelector('.annual-paint-banner', { timeout: 5000 });
  report('fix 4: paint banner visible', true);

  // Paint 10 cells, measuring IN-PAGE latency: dispatch → next paint frame
  // that shows the change (rAF polling inside the page — no Playwright
  // roundtrip in the measurement, only app handler + React commit + paint).
  const paintLatencies = await page.evaluate(async () => {
    const times = [];
    const waitUpdate = (td, before) => new Promise((resolve) => {
      const check = () => {
        if (td.textContent !== before) resolve(null);
        else requestAnimationFrame(check);
      };
      requestAnimationFrame(check);
    });
    const dates = ['2026-06-15', '2026-06-16', '2026-06-17', '2026-06-18', '2026-06-19'];
    for (let i = 0; i < 10; i++) {
      // Distinct cell each time: repainting an identical cell would not
      // change textContent and never resolve the wait.
      const row = document.querySelectorAll(`#annual-row-${dates[i % 5]} td.c`);
      const td = row[Math.floor(i / 5) * 5 + (i % 5)] ?? row[0];
      const before = td.textContent;
      const t0 = performance.now();
      td.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 10, clientY: 10 }));
      await waitUpdate(td, before);
      times.push(Math.round((performance.now() - t0) * 10) / 10);
    }
    return times;
  });
  const maxLat = Math.max(...paintLatencies);
  const avgLat = Math.round(paintLatencies.reduce((a, b) => a + b, 0) / paintLatencies.length * 10) / 10;
  report('fix 1: paint click latency', maxLat < 100,
    `max ${maxLat}ms, avg ${avgLat}ms over 10 in-page clicks (target <100ms)`);

  // Menu open latency, same in-page methodology
  const menuLat = await page.evaluate(async () => {
    document.querySelector('.btn-exit-paint')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => {
      const check = () => {
        if (!document.querySelector('.annual-paint-banner')) resolve(null);
        else requestAnimationFrame(check);
      };
      requestAnimationFrame(check);
    });
    const td = document.querySelector('#annual-row-2026-06-20 td.c');
    const t0 = performance.now();
    td.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 200, clientY: 200 }));
    await new Promise((resolve) => {
      const check = () => {
        if (document.querySelector('.acm')) resolve(null);
        else requestAnimationFrame(check);
      };
      requestAnimationFrame(check);
    });
    return Math.round((performance.now() - t0) * 10) / 10;
  });
  report('fix 1: menu opens fast', menuLat < 100, `${menuLat}ms in-page (target <100ms)`);

  // ---- Fix 4: paint exit control ----
  // NOTE: the menuLat measure above exited paint in-page; re-enter paint
  // to check the banner wording and the exit behavior.
  const cell220 = page.locator('#annual-row-2026-06-21 td.c').first();
  await cell220.click();
  await page.getByRole('menuitem', { name: /Peindre ce code/ }).click();
  await page.waitForSelector('.annual-paint-banner', { timeout: 5000 });
  const bannerText = await page.locator('.annual-paint-banner').textContent();
  report('fix 4: banner names the exit action',
    /Quitter la peinture/.test(bannerText), `"${(bannerText || '').trim().slice(0, 80)}…"`);

  // Exit via the banner button — in-page latency measure (no roundtrip)
  const exitMs = await page.evaluate(async () => {
    const t0 = performance.now();
    document.querySelector('.btn-exit-paint')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => {
      const check = () => {
        if (!document.querySelector('.annual-paint-banner')) resolve(null);
        else requestAnimationFrame(check);
      };
      requestAnimationFrame(check);
    });
    return Math.round((performance.now() - t0) * 10) / 10;
  });
  report('fix 4: exit is instant', exitMs < 100, `${exitMs}ms in-page`);

  // Side-effect-free exit: the NEXT click on a NEVER-painted cell opens the
  // menu, and that cell is NOT painted by the stale paint value
  const freshCheck = await page.evaluate(async () => {
    const td = document.querySelector('#annual-row-2026-06-22 td.c');
    const before = td.textContent;
    td.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 50, clientY: 50 }));
    await new Promise((resolve) => {
      const check = () => {
        if (document.querySelector('.acm')) resolve(null);
        else requestAnimationFrame(check);
      };
      requestAnimationFrame(check);
    });
    return { menu: !!document.querySelector('.acm'), painted: td.textContent !== before, after: td.textContent };
  });
  report('fix 4: exit is side-effect free (next click opens menu, no paint)',
    freshCheck.menu && !freshCheck.painted,
    `menu=${freshCheck.menu}, cell content after exit-click: "${freshCheck.after}"`);
  // Close the menu
  await page.locator('.acm-close').click();

  // ---- Year switch (full grid construction of the new year) ----
  // Informational: switching years builds a whole new grid (365 rows +
  // 7300 cells) — unlike paint/menu interactions, nothing is reusable. The
  // <100ms target applies to cell interactions, not this navigation.
  const yearMs = await page.evaluate(async () => {
    const btn = [...document.querySelectorAll('.year-seg button')].find((b) => b.textContent === '2027');
    const t0 = performance.now();
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => {
      const check = () => {
        if (document.querySelector('#annual-row-2027-12-31')) resolve(null);
        else requestAnimationFrame(check);
      };
      requestAnimationFrame(check);
    });
    return Math.round((performance.now() - t0) * 10) / 10;
  });
  report('fix 1: year switch (full rebuild, informational)', yearMs < 1500, `${yearMs}ms in-page for 365 new rows`);

  // ---- Memory: no runaway leaks from the memo caches ----
  const heap = await page.evaluate(() => performance.memory?.usedJSHeapSize);
  if (heap) report('heap after interactions', true, `${Math.round(heap / 1e6)}MB`);

  // ---- Screenshot for the record ----
  await page.goto(`${BASE}?display=tableau&date=2026-06-10`);
  await page.waitForSelector('#annual-row-2026-06-10');
  await cell.hover();
  await page.screenshot({ path: 'scripts/annual-ux-hover.png', clip: { x: 0, y: 0, width: 1600, height: 600 } });
} catch (err) {
  report('browser verification', false, String(err).slice(0, 300));
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length} checks, ${failed.length} failed`);
process.exit(failed.length ? 1 : 0);
