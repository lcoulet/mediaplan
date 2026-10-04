// verify-indisponible.mjs — real-browser verification of the « Indisponible »
// worked-period conflict in the DAY and WEEKLY views (decision 2026-10-04).
// Seeds localStorage with: 1 mediator with a Tuesday-only cycle
// (09:00-18:00) + 3 slots on Tue 2026-10-06 (in ISO week 2026-W41):
//   A) 10:00-12:00 inside the worked range          -> OK (no conflict)
//   B) 07:30-08:30 before the worked range          -> Indisponible
//   C) same on Thursday (non-worked day)            -> Indisponible
import { chromium } from 'playwright';

const BASE = 'http://localhost:5177/';
const LS_KEY = 'mediaplan_data_v1';

function seed() {
  const mk = (id, h0, h1, date) => ({
    id, date, startTime: h0, endTime: h1, offerId: 'o1', mediatorIds: ['m1'],
    status: 'planned', origin: 'manual', scheduleId: '', participantCount: 0,
    notes: '', importSource: '', importedAt: '', modifiedAfterImport: false,
    groupName: '', guide: '', location: '', groupNature: '',
    contactName: '', contactPhone: '', contactEmail: '',
  });
  return {
    mediators: [{
      id: 'm1', firstName: 'Alice', lastName: 'Dupont', email: '', phone: '',
      notes: '', color: '#e91e63', active: true, activeCycleId: 'cyc1',
      competences: [{ offerId: 'o1', status: 'confirmed' }],
    }],
    offers: [{
      id: 'o1', name: 'Visite guidée', description: '', duration: 90,
      capacity: 20, location: 'Salle 1', setupTime: 0, teardownTime: 0,
      welcomeType: 'Réservable encadrée par médiateur',
    }],
    schedules: [], quotas: [], spaces: [],
    absences: [],
    cycles: [{
      id: 'cyc1', mediatorId: 'm1', anchorIsoWeek: '2026-W40', forcedWeeks: {},
      weeks: [{
        id: 'w1', name: 'S1',
        days: [
          { day: 1 }, { day: 2, startTime: '09:00', endTime: '18:00' }, { day: 3 },
          { day: 4 }, { day: 5 }, { day: 6 }, { day: 7 },
        ],
      }],
    }],
    slots: [
      mk('sA', '10:00', '12:00', '2026-10-06'), // Tue inside  → OK
      mk('sB', '07:30', '08:30', '2026-10-06'), // Tue outside → Indisponible
      mk('sC', '10:00', '12:00', '2026-10-08'), // Thu non-worked → Indisponible
    ],
  };
}

const checks = [];
const check = (name, ok, detail = '') => {
  checks.push({ name, ok });
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`);
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
await page.addInitScript(([key, data]) => { localStorage.setItem(key, JSON.stringify(data)); }, [LS_KEY, seed()]);

// ---------- DAY VIEW: Tue 2026-10-06 (sA inside + sB outside) ----------
await page.goto(`${BASE}?display=day&date=2026-10-06`);
await page.waitForSelector('.daily-slot');

const daySlots = await page.evaluate(() =>
  [...document.querySelectorAll('.daily-slot.assigned')].map((el) => ({
    text: el.textContent, conflict: el.classList.contains('slot-conflict'),
    title: el.getAttribute('title') || '',
  }))
);
const dayA = daySlots.find((s) => s.text.includes('10:00'));
const dayB = daySlots.find((s) => s.text.includes('07:30'));
check('day: slot inside worked range has NO conflict class', dayA && !dayA.conflict);
check('day: slot inside worked range has no Indisponible badge', dayA && !dayA.text.includes('Indisponible'));
check('day: slot outside worked range HAS slot-conflict class', dayB && dayB.conflict);
check('day: slot outside worked range shows « Indisponible » badge', dayB && dayB.text.includes('Indisponible'));
check('day: tooltip names the cause (hors période)', dayB && dayB.title.includes('hors période travaillée'));

await page.screenshot({ path: 'scripts/indisponible-day.png', fullPage: false });

// ---------- DAY VIEW: Thu 2026-10-08 (non-worked day) ----------
await page.goto(`${BASE}?display=day&date=2026-10-08`);
await page.waitForSelector('.daily-slot');
const dayC = await page.evaluate(() => {
  const el = document.querySelector('.daily-slot.assigned');
  return { text: el?.textContent || '', conflict: el?.classList.contains('slot-conflict') || false };
});
check('day: slot on NON-WORKED day shows « Indisponible »', dayC.conflict && dayC.text.includes('Indisponible'));

// ---------- WEEKLY VIEW: week of 2026-10-05 (W41) ----------
await page.goto(`${BASE}?display=week&date=2026-10-06`);
await page.waitForSelector('.cal-slot');
const week = await page.evaluate(() =>
  [...document.querySelectorAll('.cal-slot')].map((el) => ({
    text: el.textContent, cls: el.className, title: el.getAttribute('title') || '',
  }))
);
const wA = week.find((s) => s.text.includes('10:00') && s.title.includes('2026-10-06') === false && !s.text.includes('07:30'));
// Slots are not easily distinguishable by text alone; classify by status
const okSlots = week.filter((s) => s.cls.includes('pstatus-ok'));
const dispoSlots = week.filter((s) => s.cls.includes('pstatus-dispo_issue'));
check('week: exactly 1 slot is OK (inside worked range)', okSlots.length === 1, `got ${okSlots.length}`);
check('week: exactly 2 slots are Indisponible (dispo_issue)', dispoSlots.length === 2, `got ${dispoSlots.length}`);
const withCause = dispoSlots.filter((s) => s.title.includes('hors période travaillée'));
check('week: Indisponible tooltips name the cause', withCause.length === 2, `got ${withCause.length}`);
check('week: Indisponible slots show the « Indispo. » badge', dispoSlots.every((s) => s.text.includes('Indispo.')));

// Weekly stats badge counts the dispo_issue slots
const statsOk = await page.evaluate(() => {
  const el = document.querySelector('#week-stats .week-stat-dispo_issue');
  return el ? el.textContent : null;
});
check('week: stats badge counts 2 Indisponibilité', statsOk === '2', `got ${statsOk}`);

await page.screenshot({ path: 'scripts/indisponible-week.png', fullPage: false });

// ---------- SLOT MODAL: mediator list labels the cause ----------
await page.goto(`${BASE}?display=day&date=2026-10-06`);
await page.waitForSelector('.daily-slot');
// Click the OUTSIDE-range slot (07:30-08:30), not the first one
const outsideSlot = page.locator('.daily-slot.assigned', { hasText: '07:30' });
await outsideSlot.click();
await page.waitForSelector('#form-slot', { timeout: 5000 });
// react-select: open the mediator combobox (only one react-select in the form)
const aliceOff = await page.evaluate(() => {
  // The mediator is ALREADY assigned → react-select hides the selected
  // option from the dropdown; the conflict label shows on the pill instead.
  const pills = [...document.querySelectorAll('#form-slot .mp-multiselect__multi-value__label')];
  return pills.some((p) => (p.textContent || '').includes('Indisponible (hors période travaillée)'));
});
check('modal: mediator pill labels « Indisponible (hors période travaillée) »', aliceOff);

await browser.close();
const failed = checks.filter((c) => !c.ok).length;
console.log(`\n${checks.length - failed}/${checks.length} checks passed${failed ? ' — FAILED: ' + checks.filter((c) => !c.ok).map((c) => c.name).join('; ') : ''}`);
process.exit(failed ? 1 : 0);
