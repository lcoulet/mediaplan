// Print verification — headless Playwright against the built app.
// Scenarios from test/features/spaces/day-view-print.feature.
//
// For each scenario we seed localStorage with crafted AppData, open the
// daily view on the spec date (mardi 29 septembre 2026), click the print
// button with window.print stubbed (the class toggle is what drives the
// print axis), then measure the emulated print layout and generate a real
// A4-landscape PDF whose page count/size we parse from the buffer.
//
// Run: node scripts/verify-print.mjs (expects dist/ served on :4199)

import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync } from 'node:fs';

const BASE = 'http://localhost:4199';
const DATE = '2026-09-29'; // mardi 29 septembre 2026 (spec date, ISO week 2026-W40)

// ---- Crafted AppData ----------------------------------------------------

const offer = (id, name, extra = {}) => ({
  id, name, description: '', duration: 60, capacity: 30, location: 'Salle Bronze',
  color: '#E65100', welcomeType: 'Réservable encadrée par médiateur',
  ...extra,
});

const slot = (id, offerId, startTime, endTime, extra = {}) => ({
  id, scheduleId: '', offerId, mediatorIds: ['med_1'], date: DATE,
  startTime, endTime, participantCount: 0, status: 'planned', notes: '',
  origin: 'manual', importSource: '', importedAt: '', modifiedAfterImport: false,
  groupName: '', guide: '', location: '', groupNature: '',
  contactName: '', contactPhone: '', contactEmail: '',
  ...extra,
});

const mediator = () => ({
  id: 'med_1', lastName: 'Dupont', firstName: 'Alice', email: '', phone: '06 11 22 33 44',
  competences: [{ offerId: 'off_1', status: 'confirmed' }], active: true,
  color: '#2c6e49', notes: '', contractType: 'CDI', activeCycleId: 'cyc_1',
});

// Cycle: weeks S1 (Tue 09:30-18:00) and S2 (Tue 10:00-18:30), anchored 2026-W40.
// The spec date 2026-09-29 is in ISO week 2026-W40 -> S1 active; one week
// later (2026-10-06, W41) -> S2. The pills scenario uses W41.
const days = (tue) => [
  { day: 1 }, { day: 2, ...tue }, { day: 3 }, { day: 4 }, { day: 5 }, { day: 6 }, { day: 7 },
];
const cycle = {
  id: 'cyc_1', mediatorId: 'med_1',
  weeks: [
    { id: 'w1', name: 'S1', days: days({ startTime: '09:30', endTime: '18:00' }) },
    { id: 'w2', name: 'S2', days: days({ startTime: '10:00', endTime: '18:30' }) },
  ],
  anchorIsoWeek: '2026-W40', forcedWeeks: {},
};

const spaces = [{ id: 'spc_1', name: 'Salle Bronze', color: '#4A90D9' }];

function appData({ slots = [], useCycle = false } = {}) {
  return {
    mediators: [mediator()],
    offers: [
      offer('off_1', 'Visite guidée', { shortLabel: 'VG', setupTime: 0, teardownTime: 0 }),
      offer('off_2', 'Visite guidée des collections'),
    ],
    schedules: [], slots, absences: [],
    cycles: useCycle ? [cycle] : [], quotas: [], spaces,
  };
}

// ---- Measurement helpers (run in the page) ------------------------------

// Emulate print media + the print-mode class, then measure the layout.
async function measurePrint(page, { pdf = false, out = null } = {}) {
  await page.emulateMedia({ media: 'print' });
  await page.evaluate(() => {
    window.__printCalled = false;
    window.print = () => { window.__printCalled = true; };
    document.getElementById('btn-print-daily').click();
  });
  // The class is added synchronously; the React axis re-render follows
  await page.waitForFunction(() => document.body.classList.contains('print-mode'));
  await page.waitForTimeout(250); // MutationObserver -> setState -> re-render

  const m = await page.evaluate(() => {
    const labels = [...document.querySelectorAll('.daily-hour-label')].map((el) => el.textContent.trim());
    const grid = document.querySelector('.daily-grid');
    const gridRect = grid.getBoundingClientRect();
    const axis = document.querySelector('.daily-time-axis');
    const axisRect = axis.getBoundingClientRect();
    const view = document.querySelector('.view.daily-view');
    const viewStyle = view ? getComputedStyle(view) : null;
    const gridStyle = getComputedStyle(grid);
    const hatches = document.querySelectorAll('.daily-work-hatch').length;
    const pills = [...document.querySelectorAll('.daily-mediator-row .pill')].map((p) => p.textContent.trim());
    const slotBlocks = [...document.querySelectorAll('.daily-mediator-track .daily-slot')].map((el) => {
      const r = el.getBoundingClientRect();
      const label = el.querySelector('.slot-label')?.textContent.trim();
      const time = el.querySelector('.slot-time')?.textContent.trim();
      const dot = !!el.querySelector('.offer-dot');
      const dotColor = el.querySelector('.offer-dot') ? getComputedStyle(el.querySelector('.offer-dot')).backgroundColor : null;
      const bg = getComputedStyle(el).backgroundColor;
      return { left: r.left, width: r.width, label, time, dot, dotColor, bg };
    });
    const printHeader = document.querySelector('.print-header');
    const toolbarVisible = !!document.querySelector('.toolbar') && getComputedStyle(document.querySelector('.toolbar')).display !== 'none';
    const headerVisible = !!document.querySelector('.app-header') && getComputedStyle(document.querySelector('.app-header')).display !== 'none';
    return {
      labels, gridWidth: gridRect.width, axisWidth: axisRect.width,
      zoom: viewStyle ? viewStyle.zoom : null, overflow: gridStyle.overflow,
      hatches, pills, slotBlocks,
      printHeaderVisible: printHeader ? getComputedStyle(printHeader).display !== 'none' : false,
      printHeaderText: printHeader ? printHeader.textContent.replace(/\s+/g, ' ').trim() : '',
      toolbarVisible, headerVisible,
      trackWidths: [...document.querySelectorAll('.daily-mediator-track')].map((t) => t.getBoundingClientRect().width),
    };
  });
  m.printCalled = await page.evaluate(() => window.__printCalled);

  let pdfInfo = null;
  if (pdf) {
    const buf = await page.pdf({
      path: out,
      format: 'A4', landscape: true,
      printBackground: true,
      margin: { top: '8mm', bottom: '8mm', left: '8mm', right: '8mm' },
    });
    const raw = buf.toString('latin1');
    const pages = (raw.match(/\/Type\s*\/Page[^s]/g) || []).length;
    // MediaBox in PDF units (72/inch): A4 landscape = 842 x 595
    const boxes = [...raw.matchAll(/\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\]/g)];
    const w = boxes.map((b) => Number(b[3]));
    const h = boxes.map((b) => Number(b[4]));
    pdfInfo = { pages, mediaBox: boxes.length ? [w[0], h[0]] : null, bytes: buf.length };
  }

  await page.emulateMedia({ media: 'screen' });
  await page.evaluate(() => document.body.classList.remove('print-mode'));
  return { ...m, pdf: pdfInfo };
}

async function openSeeded(context, data, url = `${BASE}/?view=day&date=${DATE}`) {
  const page = await context.newPage();
  await page.addInitScript((d) => {
    localStorage.setItem('mediaplan_data_v1', JSON.stringify(d));
  }, data);
  await page.goto(url);
  await page.waitForSelector('.daily-view');
  await page.waitForTimeout(150);
  return page;
}

// ---- Scenarios ----------------------------------------------------------

const browser = await chromium.launch();
const results = {};

// 1. Normal day (slot inside 08:30-19:00): axis stays 8:30..19:00
{
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await openSeeded(ctx, appData({ slots: [slot('s1', 'off_1', '10:00', '11:00')] }));
  results.normalDay = await measurePrint(page, { pdf: true, out: '/tmp/print-normal.pdf' });
  await ctx.close();
}

// 2. 06:00 slot: axis extends left to 6:00
{
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await openSeeded(ctx, appData({ slots: [slot('s1', 'off_1', '06:00', '07:30')] }));
  results.earlySlot = await measurePrint(page, { pdf: true, out: '/tmp/print-early.pdf' });
  await ctx.close();
}

// 3. Slot ending 21:00 (teardown 30 on a 20:30 booking): extends right past 19:00
{
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await openSeeded(ctx, appData({
    slots: [slot('s1', 'off_1', '19:30', '21:00', {})],
  }));
  results.lateSlot = await measurePrint(page, { pdf: true, out: '/tmp/print-late.pdf' });
  await ctx.close();
}

// 3b. Teardown extension: booking 18:45-19:00 with teardown 45 -> axis to 19:50
{
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await openSeeded(ctx, appData({
    slots: [slot('s1', 'off_1', '18:45', '19:00', { teardownTime: 45 })],
  }));
  results.teardownExt = await measurePrint(page, {});
  await ctx.close();
}

// 4. Zero-slot day: defaults, prints without error
{
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await openSeeded(ctx, appData({}));
  results.emptyDay = await measurePrint(page, { pdf: true, out: '/tmp/print-empty.pdf' });
  await ctx.close();
}

// 5. Hatching + pills (cycle S1 active on W40; contract CDI), worked 09:30-18:00
{
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await openSeeded(ctx, appData({ slots: [slot('s1', 'off_1', '10:00', '11:00')], useCycle: true }));
  results.hatching = await measurePrint(page, {});
  await ctx.close();
}

// 6. Pills scenario W41 (S2): one week later
{
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await openSeeded(
    ctx,
    appData({ slots: [slot('s1', 'off_1', '10:00', '11:00')], useCycle: true }),
    `${BASE}/?view=day&date=2026-10-06`
  );
  const m = await measurePrint(page, {});
  results.pillsW41 = { labels: m.labels, pills: m.pills, hatches: m.hatches, printHeaderVisible: m.printHeaderVisible, printHeaderText: m.printHeaderText };
  await ctx.close();
}

// 7. Screen behavior unchanged: same page, no print mode -> axis 8:00..19:00
{
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await openSeeded(ctx, appData({ slots: [slot('s1', 'off_1', '06:00', '07:30')] }));
  const screenLabels = await page.evaluate(() =>
    [...document.querySelectorAll('.daily-hour-label')].map((el) => el.textContent.trim())
  );
  results.screenUnchanged = { screenLabels, printModeClass: await page.evaluate(() => document.body.classList.contains('print-mode')) };
  await ctx.close();
}

await browser.close();
writeFileSync('/tmp/print-results.json', JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
