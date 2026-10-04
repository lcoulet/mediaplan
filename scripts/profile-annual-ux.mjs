// profile-annual-ux.mjs — in-page latency profile of the annual grid:
// measures the synchronous React handler cost of cell interactions
// (dispatch + re-render + DOM commit), separating it from Playwright
// roundtrip overhead, and lists long tasks.
import { chromium } from 'playwright';

const BASE = 'http://localhost:5177/';
function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const mediators = Array.from({ length: 10 }, (_, i) => ({
  id: `m_${i}`, firstName: `P${i}`, lastName: `N${i}`, email: '', phone: '', notes: '',
  color: '#FF0000', active: true, competences: [], activeCycleId: `cyc_${i}`, contractType: 'temps plein',
}));
const cycles = mediators.map((m, i) => ({
  id: `cyc_${i}`, mediatorId: m.id, name: 'Cycle', anchorIsoWeek: '2026-W06',
  weeks: [{ id: `w${i}`, name: 'S1', days: [1, 2, 3, 4, 5, 6, 7].map((day) => day <= 5 ? { day, startTime: '09:30', endTime: '18:00' } : { day }) }],
}));
const absences = [];
for (let i = 0; i < 80; i++) {
  const d = new Date(2026, 0, 1 + ((i * 4) % 360));
  absences.push({
    id: `a_${i}`, mediatorId: mediators[i % 10].id, startDate: isoDate(d), endDate: isoDate(d),
    halfDay: i % 3 === 0 ? 'morning' : i % 3 === 1 ? 'afternoon' : undefined,
    type: 'leave', notes: 'CA',
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
const seed = { mediators, offers: [], schedules: [], slots, absences, cycles, quotas: [], spaces: [] };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
await page.addInitScript((data) => {
  localStorage.setItem('mediaplan_data_v1', JSON.stringify(data));
}, seed);
await page.goto(`${BASE}?display=tableau&date=2026-06-10`);
await page.waitForSelector('#annual-row-2026-06-10');

// Enter paint mode with CA via real UI
const cell = page.locator('#annual-row-2026-06-10 td.c').first();
await cell.click();
await page.locator('.acm-chip', { hasText: 'CA' }).first().click();
await cell.click();
await page.getByRole('menuitem', { name: /Peindre ce code/ }).click();
await page.waitForSelector('.annual-paint-banner');

// In-page measurement: dispatch a real click event on N cells and time
// handler → DOM update (awaiting React's async commit), separating app
// latency from Playwright roundtrip overhead.
const timings = await page.evaluate(async () => {
  const times = [];
  const waitUpdate = (td, before) => new Promise((resolve) => {
    const t0 = performance.now();
    const check = () => {
      if (td.textContent !== before) resolve(performance.now() - t0);
      else requestAnimationFrame(check);
    };
    requestAnimationFrame(check);
  });
  for (let i = 0; i < 10; i++) {
    const rows = document.querySelectorAll('#annual-row-2026-06-15, #annual-row-2026-06-16, #annual-row-2026-06-17');
    const tds = rows[i % 3].querySelectorAll('td.c');
    const td = tds[(i * 2) % tds.length];
    const before = td.textContent;
    const t0 = performance.now();
    td.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 100, clientY: 100 }));
    await waitUpdate(td, before);
    const dt = performance.now() - t0;
    times.push({ dt: Math.round(dt * 10) / 10, changed: td.textContent !== before });
  }
  return times;
});
console.log('paint click (in-page, incl. commit):', timings);

const exitTiming = await page.evaluate(async () => {
  const t0 = performance.now();
  const banner = document.querySelector('.annual-paint-banner');
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
console.log('exit paint (in-page, incl. commit):', exitTiming, 'ms');

// Menu open timing (paint now exited)
const menuTime = await page.evaluate(async () => {
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
  const dt = Math.round((performance.now() - t0) * 10) / 10;
  document.querySelector('.acm-close')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  return dt;
});
console.log('menu open (in-page, incl. commit):', menuTime, 'ms');

// Long tasks during the whole session
const longTasks = await page.evaluate(() => new Promise((resolve) => {
  const tasks = [];
  const obs = new PerformanceObserver((list) => {
    for (const e of list.getEntries()) tasks.push({ name: e.name, dur: Math.round(e.duration) });
  });
  obs.observe({ entryTypes: ['longtask'] });
  // trigger one more paint interaction, then report
  const td = document.querySelector('#annual-row-2026-06-21 td.c');
  td.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  setTimeout(() => resolve(tasks), 300);
}));
console.log('long tasks (>50ms):', longTasks);

await browser.close();
