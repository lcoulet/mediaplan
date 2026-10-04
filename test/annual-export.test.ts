// annual-export.test.ts — Annual view slice 5: Excel export DOMAIN model.
// Pure workbook model: header rows, day rows, cell values + palette states.
// Spec: test/features/annual-view/annual-grid.feature (Export Excel
// scenarios, decisions 2026-10-03 #11 and 2026-10-04 #18-21).
import { describe, it, expect } from 'vitest';
import type { AppData, CycleWeekDay, Mediator, WorkCycle } from '../src/domain/types';
import { createDefaultCycle } from '../src/domain/cycles';
import {
  buildAnnualExportModel,
  annualExportFilename,
  type AnnualExportCell,
} from '../src/domain/annual-export';

// ---- Test data ---------------------------------------------------------

// Alice: active, cycle S1 Mon-Fri 09:30-18:00 anchored on 2026-W06
function mkCycle(mediatorId: string, weeks: { name: string; workedDays: number[] }[] = [{ name: 'S1', workedDays: [1, 2, 3, 4, 5] }]): WorkCycle {
  const cycle = createDefaultCycle(mediatorId, '2026-W06');
  cycle.id = 'cyc_alice';
  cycle.weeks = weeks.map((w, i) => ({
    id: `cweek_${i}`,
    name: w.name,
    days: ([1, 2, 3, 4, 5, 6, 7] as number[]).map((day): CycleWeekDay =>
      w.workedDays.includes(day) ? { day, startTime: '09:30', endTime: '18:00' } : { day }
    ),
  }));
  return cycle;
}

const alice: Mediator = {
  id: 'm_alice', firstName: 'Alice', lastName: 'Dupont', email: '', phone: '',
  notes: '', color: '#FF0000', active: true, competences: [],
  activeCycleId: 'cyc_alice', contractType: 'temps plein',
};
const bob: Mediator = {
  id: 'm_bob', firstName: 'Bob', lastName: 'Fontaine', email: '', phone: '',
  notes: '', color: '#00FF00', active: true, competences: [],
};
const sofia: Mediator = {
  id: 'm_sofia', firstName: 'Sofia', lastName: 'Martin', email: '', phone: '',
  notes: '', color: '#0000FF', active: false, competences: [],
};

function mkData(overrides: Partial<AppData> = {}): AppData {
  return {
    mediators: [alice, bob, sofia],
    offers: [],
    schedules: [],
    slots: [],
    absences: [],
    cycles: [mkCycle('m_alice')],
    quotas: [],
    spaces: [],
    ...overrides,
  };
}

// A worked Saturday slot for Alice (Saturday 2026-06-13)
function satSlot(date: string) {
  return {
    id: `s_${date}`, scheduleId: '', date, startTime: '10:00', endTime: '12:00',
    offerId: 'o1', mediatorIds: ['m_alice'], status: 'planned' as const,
    origin: 'manual' as const, participantCount: 0, notes: '', importSource: '',
    importedAt: '', modifiedAfterImport: false, groupName: '', guide: '',
    location: '', groupNature: '', contactName: '', contactPhone: '',
    contactEmail: '',
  };
}

// ---- Filename ----------------------------------------------------------

describe('annualExportFilename', () => {
  it('follows the generateExportFilename conventions: year then date then time', () => {
    // 2026-10-04 14:30 local
    const when = new Date(2026, 9, 4, 14, 30);
    expect(annualExportFilename(2026, when)).toBe('tableau-fonctionnement-2026-20261004-1430.xlsx');
  });

  it('pads single-digit date parts', () => {
    const when = new Date(2027, 2, 5, 9, 5);
    expect(annualExportFilename(2027, when)).toBe('tableau-fonctionnement-2027-20270305-0905.xlsx');
  });

  it('stamps the DISPLAYED year, not the current one', () => {
    const when = new Date(2026, 9, 4, 14, 30);
    expect(annualExportFilename(2027, when)).toBe('tableau-fonctionnement-2027-20261004-1430.xlsx');
  });
});

// ---- Header structure --------------------------------------------------

describe('buildAnnualExportModel — header', () => {
  it('row 1 = merged 2-column header per mediator, name + contract-type pill text', () => {
    const model = buildAnnualExportModel(mkData(), 2026);
    const row1 = model.headerRows[0];
    // Sem. + Date + one merged 2-col group per mediator
    expect(row1[0].value).toBe('Sem.');
    expect(row1[1].value).toBe('Date');
    // Alice group at columns C-D, merged
    expect(row1[2].value).toBe('Alice Dupont temps plein');
    expect(model.merges).toContainEqual({ from: { r: 0, c: 2 }, to: { r: 0, c: 3 } });
    // Bob has no contract type: name only
    expect(row1[4].value).toBe('Bob Fontaine');
    expect(model.merges).toContainEqual({ from: { r: 0, c: 4 }, to: { r: 0, c: 5 } });
  });

  it('row 2 = Matin / Après-midi sub-headers for each mediator', () => {
    const model = buildAnnualExportModel(mkData(), 2026);
    const row2 = model.headerRows[1];
    expect(row2[0].value).toBe('');
    expect(row2[1].value).toBe('');
    expect(row2[2].value).toBe('Matin');
    expect(row2[3].value).toBe('Après-midi');
    expect(row2[4].value).toBe('Matin');
    expect(row2[5].value).toBe('Après-midi');
  });

  it('hidden inactive mediators are NOT exported (toggle state is law)', () => {
    const model = buildAnnualExportModel(mkData(), 2026);
    // Sofia is inactive and hidden by default: no group, no merges
    const names = model.headerRows[0].map((c) => c.value).join('|');
    expect(names).not.toContain('Sofia');
    expect(model.merges.length).toBe(2); // Alice + Bob only
  });

  it('shown inactive mediators ARE exported when included', () => {
    const model = buildAnnualExportModel(mkData(), 2026, { includeInactive: true });
    const names = model.headerRows[0].map((c) => c.value).join('|');
    expect(names).toContain('Sofia Martin');
    expect(model.merges.length).toBe(3);
    // Inactive cells are neutral: no derived presence
    const row = model.dayRows.find((r) => r.iso === '2026-06-08')!;
    const sofiaCells = row.cells.filter((c) => c.mediatorId === 'm_sofia');
    expect(sofiaCells.every((c) => c.state === null)).toBe(true);
  });

  it('no counting columns (ratio, presence totals) anywhere', () => {
    const model = buildAnnualExportModel(mkData(), 2026);
    // 2 fixed columns + 2 per mediator — no extra columns
    expect(model.headerRows[0].length).toBe(2 + 2 * 2);
    expect(model.headerRows[1].length).toBe(2 + 2 * 2);
    for (const row of model.dayRows) {
      expect(row.cells.length).toBe(2 * 2);
    }
  });
});

// ---- Day rows ----------------------------------------------------------

describe('buildAnnualExportModel — day rows', () => {
  it('one row per day of the displayed year, weekends included, ISO week in the leftmost column', () => {
    const model = buildAnnualExportModel(mkData(), 2026);
    expect(model.dayRows.length).toBe(365);
    expect(model.dayRows[0].iso).toBe('2026-01-01');
    expect(model.dayRows[364].iso).toBe('2026-12-31');
    // Week label on the Monday of each ISO week group, '' between
    expect(model.dayRows.find((r) => r.iso === '2026-09-28')!.weekLabel).toBe('S 40');
    // Sunday of that week: the week cell is empty (the merged label spans)
    expect(model.dayRows.find((r) => r.iso === '2026-10-04')!.weekLabel).toBe('');
    // 2026 has 53 ISO weeks
    expect(model.dayRows.find((r) => r.iso === '2026-12-28')!.weekLabel).toBe('S 53');
  });

  it('exports ONLY the displayed year', () => {
    const data = mkData({
      absences: [
        // CA in 2027 must not leak into the 2026 export
        { id: 'a_2027', mediatorId: 'm_alice', startDate: '2027-06-10', endDate: '2027-06-10', halfDay: 'none', type: 'leave', notes: 'CA' },
      ],
    });
    const model = buildAnnualExportModel(data, 2026);
    expect(model.dayRows.every((r) => r.iso.startsWith('2026-'))).toBe(true);
    const june10 = model.dayRows.find((r) => r.iso === '2026-06-10')!;
    expect(june10.cells.find((c) => c.mediatorId === 'm_alice')!.value).toBe('');
  });

  it('date label = weekday + date, Férié and Fermé appended on their rows', () => {
    const model = buildAnnualExportModel(mkData(), 2026);
    const monday = model.dayRows.find((r) => r.iso === '2026-09-28')!;
    expect(monday.dateLabel).toBe('lun. 28/09');
    // 14 juillet: férié — amber fill + « Férié » text
    const bastille = model.dayRows.find((r) => r.iso === '2026-07-14')!;
    expect(bastille.dateLabel).toContain('Férié');
    expect(bastille.rowState).toBe('holiday');
    // 25 décembre: museum closed — gray fill + « Fermé »
    const christmas = model.dayRows.find((r) => r.iso === '2026-12-25')!;
    expect(christmas.dateLabel).toContain('Fermé');
    expect(christmas.rowState).toBe('museumClosed');
    // 1er janvier: closed AND holiday — closure takes precedence
    const newYear = model.dayRows.find((r) => r.iso === '2026-01-01')!;
    expect(newYear.rowState).toBe('museumClosed');
  });

  it('date cell of a férié/closed row carries the holiday/closed palette state', () => {
    const model = buildAnnualExportModel(mkData(), 2026);
    const bastille = model.dayRows.find((r) => r.iso === '2026-07-14')!;
    expect(bastille.dateCell.state).toBe('holiday');
    const christmas = model.dayRows.find((r) => r.iso === '2026-12-25')!;
    expect(christmas.dateCell.state).toBe('museumClosed');
    const ordinary = model.dayRows.find((r) => r.iso === '2026-09-28')!;
    expect(ordinary.dateCell.state).toBeNull();
  });

  it('honors per-year férié dérogations', () => {
    const data = mkData({ annualHolidayOverrides: { 2026: { added: ['2026-08-10'], removed: ['2026-07-14'] } } });
    const model = buildAnnualExportModel(data, 2026);
    expect(model.dayRows.find((r) => r.iso === '2026-07-14')!.rowState).toBeNull();
    expect(model.dayRows.find((r) => r.iso === '2026-08-10')!.rowState).toBe('holiday');
  });
});

// ---- Cells: presence, absences, counters, cycle pills ------------------

describe('buildAnnualExportModel — cells', () => {
  it('derived presence = EMPTY value + presence fill (the fill carries the semantic)', () => {
    const model = buildAnnualExportModel(mkData(), 2026);
    const tuesday = model.dayRows.find((r) => r.iso === '2026-06-09')!; // Alice works Tue
    const alice = tuesday.cells.find((c) => c.mediatorId === 'm_alice' && c.halfDay === 'morning')!;
    expect(alice.value).toBe('');
    expect(alice.state).toBe('presence');
    // Weekend: no derived presence
    const sunday = model.dayRows.find((r) => r.iso === '2026-06-07')!;
    const aliceSun = sunday.cells.find((c) => c.mediatorId === 'm_alice' && c.halfDay === 'morning')!;
    expect(aliceSun.state).toBeNull();
  });

  it('absences and missions export their code with the legend fill', () => {
    const data = mkData({
      absences: [
        // CA on Alice's morning of June 10 (Wednesday)
        { id: 'a1', mediatorId: 'm_alice', startDate: '2026-06-10', endDate: '2026-06-10', halfDay: 'morning', type: 'leave', notes: 'CA' },
        // « Réf. WE » mission on Saturday June 13 (morning)
        { id: 'a2', mediatorId: 'm_alice', startDate: '2026-06-13', endDate: '2026-06-13', halfDay: 'morning', type: 'mission', notes: 'Réf. WE' },
      ],
    });
    const model = buildAnnualExportModel(data, 2026);
    const june10 = model.dayRows.find((r) => r.iso === '2026-06-10')!;
    const ca = june10.cells.find((c) => c.mediatorId === 'm_alice' && c.halfDay === 'morning')!;
    expect(ca.value).toBe('CA');
    expect(ca.state).toBe('absence');
    // Afternoon keeps the derived presence
    const pm = june10.cells.find((c) => c.mediatorId === 'm_alice' && c.halfDay === 'afternoon')!;
    expect(pm.state).toBe('presence');
    // Mission orange
    const june13 = model.dayRows.find((r) => r.iso === '2026-06-13')!;
    const mission = june13.cells.find((c) => c.mediatorId === 'm_alice' && c.halfDay === 'morning')!;
    expect(mission.value).toBe('Réf. WE');
    expect(mission.state).toBe('mission');
  });

  it('free-text missions export as FULL text, never abbreviated (decision 18)', () => {
    const data = mkData({
      absences: [
        { id: 'a3', mediatorId: 'm_alice', startDate: '2026-06-17', endDate: '2026-06-17', halfDay: 'morning', type: 'mission', notes: 'Stop Motion' },
      ],
    });
    const model = buildAnnualExportModel(data, 2026);
    const cell = model.dayRows.find((r) => r.iso === '2026-06-17')!.cells.find((c) => c.mediatorId === 'm_alice')!;
    expect(cell.value).toBe('Stop Motion');
    expect(cell.state).toBe('mission');
  });

  it('worked-Saturday counters are exported IN the Saturday cells (decision 19)', () => {
    const data = mkData({
      slots: [satSlot('2026-01-10'), satSlot('2026-02-14'), satSlot('2026-06-13')],
    });
    const model = buildAnnualExportModel(data, 2026);
    const first = model.dayRows.find((r) => r.iso === '2026-01-10')!;
    expect(first.cells.find((c) => c.mediatorId === 'm_alice' && c.halfDay === 'morning')!.value).toBe('1');
    const second = model.dayRows.find((r) => r.iso === '2026-02-14')!;
    expect(second.cells.find((c) => c.mediatorId === 'm_alice' && c.halfDay === 'morning')!.value).toBe('2');
    const third = model.dayRows.find((r) => r.iso === '2026-06-13')!;
    expect(third.cells.find((c) => c.mediatorId === 'm_alice' && c.halfDay === 'morning')!.value).toBe('3');
    // The Saturday afternoon cell carries no counter
    expect(third.cells.find((c) => c.mediatorId === 'm_alice' && c.halfDay === 'afternoon')!.value).toBe('');
    // Non-Saturday rows never carry a counter
    const wednesday = model.dayRows.find((r) => r.iso === '2026-06-10')!;
    expect(wednesday.cells.every((c) => c.value === '' || c.state !== null)).toBe(true);
    // Mediator without Saturday slots: counter 0 on Saturday rows
    const bobSat = third.cells.find((c) => c.mediatorId === 'm_bob' && c.halfDay === 'morning')!;
    expect(bobSat.value).toBe('0');
  });

  it('cycle week pills export on Monday rows only, like the reference Excel', () => {
    const model = buildAnnualExportModel(mkData(), 2026);
    const monday = model.dayRows.find((r) => r.iso === '2026-06-08')!;
    const aliceMon = monday.cells.find((c) => c.mediatorId === 'm_alice' && c.halfDay === 'morning')!;
    expect(aliceMon.value).toContain('S1');
    // Tuesday rows do not repeat the pill
    const tuesday = model.dayRows.find((r) => r.iso === '2026-06-09')!;
    const aliceTue = tuesday.cells.find((c) => c.mediatorId === 'm_alice' && c.halfDay === 'morning')!;
    expect(aliceTue.value).not.toContain('S1');
    // A mediator without a cycle has no pill
    const bobMon = monday.cells.find((c) => c.mediatorId === 'm_bob' && c.halfDay === 'morning')!;
    expect(bobMon.value).not.toContain('S1');
  });

  it('multi-week cycles export the active cycle week per ISO week (rotation)', () => {
    const data = mkData({
      cycles: [mkCycle('m_alice', [
        { name: 'S1', workedDays: [1, 2, 3, 4, 5] },
        { name: 'S2', workedDays: [1, 2, 3, 4, 5] },
      ])],
    });
    const model = buildAnnualExportModel(data, 2026);
    // Anchor 2026-W06 => S1; W07 => S2; W08 => S1 again. Mondays of those weeks.
    const w07 = model.dayRows.find((r) => r.iso === '2026-02-09')!; // Monday of 2026-W07
    const w08 = model.dayRows.find((r) => r.iso === '2026-02-16')!; // Monday of 2026-W08
    expect(w07.cells.find((c) => c.mediatorId === 'm_alice' && c.halfDay === 'morning')!.value).toContain('S2');
    expect(w08.cells.find((c) => c.mediatorId === 'm_alice' && c.halfDay === 'morning')!.value).toContain('S1');
  });

  it('an empty year exports the headers and day rows with no fills and no derived states', () => {
    // A year with NO entered data: no cycles, no absences, no slots —
    // nothing to derive. Cells carry no FILL (decision 2026-10-04, export
    // of an empty year); the ×0 Saturday counters remain (decision 19:
    // counters export in Saturday cells like the reference Excel).
    const empty = mkData({ cycles: [] });
    const model = buildAnnualExportModel(empty, 2027);
    expect(model.dayRows.length).toBe(365);
    for (const row of model.dayRows) {
      const isSaturday = new Date(row.iso).getDay() === 6;
      for (const c of row.cells) {
        // No palette state anywhere: nothing derives without entered data
        expect(c.state).toBeNull();
        // Saturday morning cells carry the computed counter (0), every
        // other cell is strictly empty
        if (c.halfDay === 'morning' && isSaturday) {
          expect(c.value).toBe('0');
        } else {
          expect(c.value).toBe('');
        }
      }
    }
    // Headers still present
    expect(model.headerRows[0][2].value).toBe('Alice Dupont temps plein');
  });
});

// ---- Palette mapping ---------------------------------------------------

describe('buildAnnualExportModel — palette states come from ANNUAL_PALETTE', () => {
  it('every non-null cell state is a key of ANNUAL_PALETTE', async () => {
    const { ANNUAL_PALETTE } = await import('../src/domain/annual-view');
    const states = new Set(ANNUAL_PALETTE.map((s) => s.state));
    const data = mkData({
      absences: [
        { id: 'a1', mediatorId: 'm_alice', startDate: '2026-06-10', endDate: '2026-06-10', halfDay: 'morning', type: 'leave', notes: 'CA' },
        { id: 'a2', mediatorId: 'm_alice', startDate: '2026-06-11', endDate: '2026-06-11', halfDay: 'morning', type: 'other', notes: 'TELE' },
        { id: 'a3', mediatorId: 'm_alice', startDate: '2026-06-12', endDate: '2026-06-12', halfDay: 'morning', type: 'other', notes: 'amgt 12/06' },
        { id: 'a4', mediatorId: 'm_alice', startDate: '2026-06-15', endDate: '2026-06-15', halfDay: 'morning', type: 'leave_request', notes: 'CA' },
        { id: 'a5', mediatorId: 'm_alice', startDate: '2026-06-16', endDate: '2026-06-16', halfDay: 'morning', type: 'mission', notes: 'JDM' },
        { id: 'a6', mediatorId: 'm_alice', startDate: '2026-06-17', endDate: '2026-06-17', halfDay: 'morning', type: 'training', notes: 'formation' },
      ],
    });
    const model = buildAnnualExportModel(data, 2026);
    const seen = new Set<string>();
    for (const row of model.dayRows) {
      seen.add(row.dateCell.state ?? '__null__');
      for (const c of row.cells) seen.add(c.state ?? '__null__');
    }
    for (const s of seen) {
      if (s === '__null__') continue;
      expect(states.has(s)).toBe(true);
    }
    // Spot-check the semantics of each stored entry
    const at = (iso: string) =>
      model.dayRows.find((r) => r.iso === iso)!.cells.find((c) => c.mediatorId === 'm_alice' && c.halfDay === 'morning')!;
    expect(at('2026-06-10').state).toBe('absence');
    expect(at('2026-06-11').state).toBe('remote');
    expect(at('2026-06-12').state).toBe('arrangement');
    expect(at('2026-06-15').state).toBe('leaveRequest');
    expect(at('2026-06-16').state).toBe('jdm');
    expect(at('2026-06-17').state).toBe('workAbsence');
  });
});

// ---- Cell type sanity ----------------------------------------------------

describe('AnnualExportCell shape', () => {
  it('cells carry mediator + half-day coordinates for style mapping', () => {
    const model = buildAnnualExportModel(mkData(), 2026);
    const row = model.dayRows[0];
    const first: AnnualExportCell = row.cells[0];
    expect(first.mediatorId).toBe('m_alice');
    expect(first.halfDay).toBe('morning');
  });
});
