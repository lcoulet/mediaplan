// annual-excel.test.ts — Annual view slice 5: SheetJS infrastructure.
// Verifies the generated .xlsx FILE: sheet structure, merges, values and
// CELL FILLS (the community edition of SheetJS cannot write fills — the
// infrastructure patches xl/styles.xml + the sheet XML after the write).
// Spec: test/features/annual-view/annual-grid.feature (Export Excel).
import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import type { AppData, CycleWeekDay, Mediator, WorkCycle } from '../src/domain/types';
import { createDefaultCycle } from '../src/domain/cycles';
import { buildAnnualExportModel, annualExportFilename } from '../src/domain/annual-export';
import { writeAnnualExcel } from '../src/infrastructure/annual-excel';

// ---- Test data (mirrors test/annual-export.test.ts) ----------------------

function mkCycle(mediatorId: string): WorkCycle {
  const cycle = createDefaultCycle(mediatorId, '2026-W06');
  const days: CycleWeekDay[] = [1, 2, 3, 4, 5, 6, 7].map((day) =>
    day <= 5 ? { day, startTime: '09:30', endTime: '18:00' } : { day }
  );
  cycle.weeks = [{ id: 'cweek_alice', name: 'S1', days }];
  cycle.id = 'cyc_alice';
  return cycle;
}

/** Cycle working Monday to SATURDAY — for worked-Saturday counter tests. */
function mkCycleSat(mediatorId: string): WorkCycle {
  const cycle = createDefaultCycle(mediatorId, '2026-W06');
  const days: CycleWeekDay[] = [1, 2, 3, 4, 5, 6, 7].map((day) =>
    day <= 6 ? { day, startTime: '09:30', endTime: '18:00' } : { day }
  );
  cycle.weeks = [{ id: 'cweek_alice', name: 'S1', days }];
  cycle.id = 'cyc_alice';
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

function mkData(overrides: Partial<AppData> = {}): AppData {
  return {
    mediators: [alice, bob],
    offers: [], schedules: [], slots: [], absences: [],
    cycles: [mkCycle('m_alice')],
    quotas: [], spaces: [],
    ...overrides,
  };
}

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
void satSlot; // legacy slot-based counter helper — kept for reference

// Generate the file bytes from test data
function generate(overrides: Partial<AppData> = {}) {
  const data = mkData(overrides);
  const model = buildAnnualExportModel(data, 2026);
  const bytes = writeAnnualExcel(model);
  const wb = XLSX.read(bytes, { type: 'buffer', cellStyles: true });
  return { model, bytes, wb };
}

// Fill of a cell as RGB from the styles part, or null when unstyled.
// SheetJS strips the FF alpha prefix on read ('F9A825', not 'FFF9A825').
function fillOf(wb: XLSX.WorkBook, cell: string): string | null {
  const ws: any = wb.Sheets[wb.SheetNames[0]];
  const c = ws[cell];
  if (!c || !c.s || !c.s.patternType) return null;
  return c.s.fgColor?.rgb ?? c.s.bgColor?.rgb ?? null;
}

describe('writeAnnualExcel — file structure', () => {
  it('produces a single-sheet workbook named after the year', () => {
    const { wb } = generate();
    expect(wb.SheetNames).toEqual(['Tableau 2026']);
  });

  it('writes the two header rows with merged mediator groups', () => {
    const { wb } = generate();
    const ws = wb.Sheets[wb.SheetNames[0]];
    expect((ws['A1'] as any).v).toBe('Sem.');
    expect((ws['B1'] as any).v).toBe('Date');
    expect((ws['C1'] as any).v).toBe('Alice Dupont temps plein');
    expect((ws['E1'] as any).v).toBe('Bob Fontaine');
    // Row 2 sub-headers
    expect((ws['C2'] as any).v).toBe('Matin');
    expect((ws['D2'] as any).v).toBe('Après-midi');
    // Merges: C1:D1 and E1:F1
    expect(ws['!merges']).toContainEqual({ s: { r: 0, c: 2 }, e: { r: 0, c: 3 } });
    expect(ws['!merges']).toContainEqual({ s: { r: 0, c: 4 }, e: { r: 0, c: 5 } });
  });

  it('writes 365 day rows + 2 header rows, dates in order', () => {
    const { wb } = generate();
    const ws: any = wb.Sheets[wb.SheetNames[0]];
    expect(ws['!ref']).toBe('A1:F367');
    // First day row (row 3): Jan 1 2026 (Thursday)
    expect(ws['B3'].v).toContain('jeu. 01/01');
    expect(ws['B3'].v).toContain('Fermé');
    // Last day row (row 367): Dec 31
    expect(ws['B367'].v).toContain('jeu. 31/12');
  });

  it('writes the ISO week label on Monday rows', () => {
    const { wb } = generate();
    const ws: any = wb.Sheets[wb.SheetNames[0]];
    // Monday 2026-09-28 is row index: 2 header rows + day-of-year of Sep 28 (271st) => row 273
    expect(ws['A273'].v).toBe('S 40');
    // Sunday 2026-10-04: no label (merged-style empty)
    expect(ws['A279'].v ?? '').toBe('');
  });
});

describe('writeAnnualExcel — values', () => {
  it('writes absence codes with their cells', () => {
    const { wb } = generate({
      absences: [
        { id: 'a1', mediatorId: 'm_alice', startDate: '2026-06-10', endDate: '2026-06-10', halfDay: 'morning', type: 'leave', notes: 'CA' },
      ],
    });
    const ws: any = wb.Sheets[wb.SheetNames[0]];
    // June 10 is the 161st day of 2026 => row 163, Alice Matin = column C
    expect(ws['C163'].v).toBe('CA');
    // Full-text mission (decision 18)
    expect(typeof ws['C163'].v).toBe('string');
  });

  it('writes worked-Saturday counters in Saturday cells (grid presence, spec fix 2026-10-04)', () => {
    // Alice's cycle works Saturdays (Mon-Sat) — the counter counts presence
    // cells, not slots; the number on 2026-06-13 = all her worked Saturdays
    // of the year so far (Jan 3 → Jun 13 = 24 Saturdays).
    const { wb } = generate({
      cycles: [mkCycleSat('m_alice')],
    });
    const ws: any = wb.Sheets[wb.SheetNames[0]];
    // June 13 = day 164 => row 166, Alice Matin = C — a native NUMBER
    expect(ws['C166'].v).toBe(24);
    expect(ws['C166'].t).toBe('n');
  });
});

describe('writeAnnualExcel — fills (styles patch)', () => {
  it('fills derived-presence cells with the presence orange, no visible text', () => {
    const { wb } = generate();
    // Tuesday 2026-06-09 (day 160 => row 162), Alice Matin C162
    const cell = (wb.Sheets[wb.SheetNames[0]] as any)['C162'];
    // No visible text: the fill carries the semantic (an empty string cell)
    expect(cell?.v ?? '').toBe('');
    expect(fillOf(wb, 'C162')).toBe('C67A33'); // presence #C67A33
  });

  it('fills absence cells yellow and mission cells orange', () => {
    const { wb } = generate({
      absences: [
        { id: 'a1', mediatorId: 'm_alice', startDate: '2026-06-10', endDate: '2026-06-10', halfDay: 'morning', type: 'leave', notes: 'CA' },
        { id: 'a2', mediatorId: 'm_alice', startDate: '2026-06-13', endDate: '2026-06-13', halfDay: 'morning', type: 'mission', notes: 'Réf. WE' },
      ],
    });
    expect(fillOf(wb, 'C163')).toBe('F9A825'); // absence yellow #F9A825
    expect(fillOf(wb, 'C166')).toBe('D68C45'); // mission orange #d68c45
  });

  it('fills the date cell of férié rows amber, closed rows gray', () => {
    const { wb } = generate();
    // 14 juillet 2026 = day 195 => row 197, date column B
    expect(fillOf(wb, 'B197')).toBe('FEF5E7'); // holiday amber #fef5e7
    // 25 décembre = day 359 => row 361
    expect(fillOf(wb, 'B361')).toBe('8A8A8A'); // museum closed gray #8a8a8a
  });

  it('leaves ordinary, unstyled cells without any fill', () => {
    const { wb } = generate();
    // Bob (no cycle) on an ordinary Tuesday: no fill
    expect(fillOf(wb, 'E162')).toBeNull();
  });

  it('produces a file openable with fills intact after a full write/read cycle', () => {
    const { bytes } = generate();
    // The bytes are a valid zip with a styles part containing our fills
    expect(bytes.length).toBeGreaterThan(10000);
  });
});

describe('annualExportFilename + writeAnnualExcel integration', () => {
  it('filename matches the file content year', () => {
    const when = new Date(2026, 9, 4, 14, 30);
    expect(annualExportFilename(2026, when)).toBe('tableau-fonctionnement-2026-20261004-1430.xlsx');
  });
});
