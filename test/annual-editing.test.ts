// test/annual-editing.test.ts — Annual view slice 2 (persistence): half-day
// exception ops (set/clear/find), holiday dérogation ops, and preservation
// through clearPlanningData. All ops are IMMUTABLE: inputs are never mutated.
// Spec: test/features/annual-view/annual-editing.feature (edition scenarios);
// holiday dérogations per annual-grid.feature (fériés scenarios).
import { describe, it, expect } from 'vitest';
import { parseLocalDate } from '../src/domain/models';
import type { Absence, AppData, WorkCycle } from '../src/domain/types';
import type { AnnualHolidayOverrides, AnnualCellInputs } from '../src/domain/annual-view';
import { clearPlanningData } from '../src/domain/clear-data';
import {
  annualHolidayState,
  deriveAnnualCell,
  halfDayOfAbsence,
  annualCodeCatalog,
} from '../src/domain/annual-view';
import {
  setHalfDayException,
  clearHalfDayException,
  findHalfDayException,
  addHolidayDerogation,
  removeHolidayDerogation,
  resetHolidayDerogation,
  annualMenuChoice,
  annualFreeTextEntry,
} from '../src/domain/annual-editing';

// ---- Test helpers ------------------------------------------------------

function mkAbsence(opts: Partial<Absence> = {}): Absence {
  return {
    id: 'abs_1',
    mediatorId: 'med_alice',
    startDate: '2026-06-10',
    endDate: '2026-06-10',
    halfDay: 'none',
    type: 'leave',
    notes: '',
    ...opts,
  };
}

const d = parseLocalDate;

/** Alice's cycle: one week S1, Mon-Fri 09:30-18:00, anchored 2026-W01. */
function aliceCycle(): WorkCycle {
  const days = [];
  for (let day = 1; day <= 7; day++) {
    if (day <= 5) days.push({ day, startTime: '09:30', endTime: '18:00' });
    else days.push({ day });
  }
  return { id: 'cyc_a', mediatorId: 'med_alice', weeks: [{ id: 'cw1', name: 'S1', days }], anchorIsoWeek: '2026-W01', forcedWeeks: {} };
}

// ---- setHalfDayException -------------------------------------------------

describe('setHalfDayException', () => {
  const cell = { mediatorId: 'med_alice', date: '2026-06-09', halfDay: 'morning' as const };

  it('stores a new half-day absence for the cell, leaving everything else intact', () => {
    const existing = [mkAbsence({ mediatorId: 'med_bob', startDate: '2026-06-09', endDate: '2026-06-09', halfDay: 'afternoon' })];
    const before = JSON.stringify(existing);
    const next = setHalfDayException(existing, { ...cell, type: 'leave', notes: 'CA' });
    // The new entry: single-date, own half-day, stored per half-day (feature
    // decision 3: « les absences sont stockées par demi-journée »)
    expect(next).toHaveLength(2);
    const added = next.find((a) => a.mediatorId === 'med_alice')!;
    expect(added.startDate).toBe('2026-06-09');
    expect(added.endDate).toBe('2026-06-09');
    expect(added.halfDay).toBe('morning');
    expect(added.type).toBe('leave');
    expect(added.notes).toBe('CA');
    // Bob's entry untouched, Alice's cell is independent of the afternoon
    expect(next.find((a) => a.mediatorId === 'med_bob')).toEqual(existing[0]);
    // Immutability: the input list is unchanged
    expect(JSON.stringify(existing)).toBe(before);
  });

  it('replaces an existing absence on the same half-day instead of duplicating', () => {
    const existing = [mkAbsence({ id: 'abs_old', startDate: '2026-06-09', endDate: '2026-06-09', halfDay: 'morning', type: 'other', notes: 'TELE' })];
    const next = setHalfDayException(existing, { ...cell, type: 'leave', notes: 'CA' });
    expect(next).toHaveLength(1);
    expect(next[0].notes).toBe('CA');
    expect(next[0].halfDay).toBe('morning');
  });

  it('keeps the other half-day when editing a same-date full-day absence', () => {
    // A same-date full-day entry covers both cells; editing the morning cell
    // narrows it: the untouched half keeps its stored value
    const existing = [mkAbsence({ id: 'abs_full', startDate: '2026-06-09', endDate: '2026-06-09', halfDay: 'none', type: 'sick', notes: 'AM' })];
    const next = setHalfDayException(existing, { ...cell, type: 'leave', notes: 'CA' });
    expect(next).toHaveLength(2);
    const morning = next.find((a) => a.halfDay === 'morning')!;
    expect(morning.notes).toBe('CA');
    const afternoon = next.find((a) => a.halfDay === 'afternoon')!;
    expect(afternoon.notes).toBe('AM');
    expect(afternoon.type).toBe('sick');
  });

  it('leaves multi-day range absences alone (Absences-view scope, not cell scope)', () => {
    const range = [mkAbsence({ id: 'abs_range', startDate: '2026-06-08', endDate: '2026-06-12', halfDay: 'none' })];
    const next = setHalfDayException(range, { ...cell, type: 'leave', notes: 'CA' });
    expect(next).toHaveLength(2);
    expect(next.find((a) => a.id === 'abs_range')).toEqual(range[0]);
  });

  it('generates distinct ids for distinct cells', () => {
    let absences: Absence[] = [];
    absences = setHalfDayException(absences, { ...cell, type: 'leave', notes: 'CA' });
    absences = setHalfDayException(absences, { ...cell, halfDay: 'afternoon', type: 'leave', notes: 'RHS' });
    const ids = absences.map((a) => a.id);
    expect(new Set(ids).size).toBe(2);
    expect(ids.every((id) => id.startsWith('abs_'))).toBe(true);
  });

  it('never mutates the input list or its entries', () => {
    const existing = Object.freeze([Object.freeze(mkAbsence({ startDate: '2026-06-09', endDate: '2026-06-09', halfDay: 'morning' }))]);
    const before = JSON.stringify(existing);
    setHalfDayException(existing, { ...cell, type: 'leave', notes: 'CA' });
    expect(JSON.stringify(existing)).toBe(before);
  });
});

// ---- clearHalfDayException ------------------------------------------------

describe('clearHalfDayException', () => {
  it('removes the absence covering the cell — « retour au dérivé »', () => {
    const existing = [
      mkAbsence({ id: 'abs_m', startDate: '2026-06-09', endDate: '2026-06-09', halfDay: 'morning' }),
      mkAbsence({ id: 'abs_a', startDate: '2026-06-09', endDate: '2026-06-09', halfDay: 'afternoon', mediatorId: 'med_bob' }),
    ];
    const before = JSON.stringify(existing);
    const next = clearHalfDayException(existing, 'med_alice', '2026-06-09', 'morning');
    expect(next.map((a) => a.id)).toEqual(['abs_a']);
    expect(JSON.stringify(existing)).toBe(before);
  });

  it('narrows a same-date full-day absence to the surviving half-day', () => {
    const existing = [mkAbsence({ id: 'abs_full', startDate: '2026-06-09', endDate: '2026-06-09', halfDay: 'none', type: 'sick', notes: 'AM' })];
    const next = clearHalfDayException(existing, 'med_alice', '2026-06-09', 'morning');
    expect(next).toHaveLength(1);
    expect(next[0].id).toBe('abs_full'); // same record, narrowed
    expect(next[0].halfDay).toBe('afternoon');
    expect(next[0].type).toBe('sick');
    expect(next[0].notes).toBe('AM');
  });

  it('returns an equal new list when nothing covers the cell', () => {
    const existing = [mkAbsence({ id: 'abs_other', startDate: '2026-06-09', endDate: '2026-06-09', halfDay: 'afternoon' })];
    const next = clearHalfDayException(existing, 'med_alice', '2026-06-09', 'morning');
    expect(next).toHaveLength(1);
    expect(next[0].id).toBe('abs_other');
  });

  it('leaves multi-day range absences untouched', () => {
    const range = [mkAbsence({ id: 'abs_range', startDate: '2026-06-08', endDate: '2026-06-10', halfDay: 'none' })];
    const next = clearHalfDayException(range, 'med_alice', '2026-06-09', 'morning');
    expect(next).toEqual(range);
  });

  it('never mutates the input list', () => {
    const existing = Object.freeze([Object.freeze(mkAbsence({ startDate: '2026-06-09', endDate: '2026-06-09', halfDay: 'morning' }))]);
    const before = JSON.stringify(existing);
    clearHalfDayException(existing, 'med_alice', '2026-06-09', 'morning');
    expect(JSON.stringify(existing)).toBe(before);
  });
});

// ---- findHalfDayException ---------------------------------------------------

describe('findHalfDayException', () => {
  it('finds the stored absence covering the half-day', () => {
    const abs = mkAbsence({ id: 'abs_m', startDate: '2026-06-09', endDate: '2026-06-09', halfDay: 'morning' });
    expect(findHalfDayException([abs], 'med_alice', '2026-06-09', 'morning')).toBe(abs);
    expect(findHalfDayException([abs], 'med_alice', '2026-06-09', 'afternoon')).toBeNull();
  });

  it('finds a full-day absence from either half-day', () => {
    const abs = mkAbsence({ startDate: '2026-06-09', endDate: '2026-06-09', halfDay: 'none' });
    expect(findHalfDayException([abs], 'med_alice', '2026-06-09', 'morning')).toBe(abs);
    expect(findHalfDayException([abs], 'med_alice', '2026-06-09', 'afternoon')).toBe(abs);
  });

  it('finds a multi-day range absence covering the date (display coverage)', () => {
    const abs = mkAbsence({ startDate: '2026-06-08', endDate: '2026-06-12', halfDay: 'morning' });
    expect(findHalfDayException([abs], 'med_alice', '2026-06-10', 'morning')).toBe(abs);
    expect(findHalfDayException([abs], 'med_alice', '2026-06-10', 'afternoon')).toBeNull();
  });

  it('returns null for another mediator or an uncovered date', () => {
    const abs = mkAbsence({ mediatorId: 'med_bob', startDate: '2026-06-09', endDate: '2026-06-09', halfDay: 'morning' });
    expect(findHalfDayException([abs], 'med_alice', '2026-06-09', 'morning')).toBeNull();
    expect(findHalfDayException([], 'med_alice', '2026-06-09', 'morning')).toBeNull();
  });
});

// ---- Holiday dérogations -----------------------------------------------------

describe('holiday dérogation ops', () => {
  it('addHolidayDerogation creates the year entry on demand and marks the date', () => {
    const next = addHolidayDerogation({}, '2026', '2026-08-10');
    expect(next).toEqual({ '2026': { added: ['2026-08-10'], removed: [] } });
    // Feeds the slice-1 read logic: 10 août is NOT a default holiday
    expect(annualHolidayState(d('2026-08-10'), next)).toBe('holiday');
  });

  it('addHolidayDerogation is idempotent and keeps other dates intact', () => {
    let o: AnnualHolidayOverrides = { '2026': { added: ['2026-02-01'], removed: ['2026-07-14'] } };
    o = addHolidayDerogation(o, '2026', '2026-08-10');
    o = addHolidayDerogation(o, '2026', '2026-08-10');
    expect(o['2026']!.added).toEqual(['2026-02-01', '2026-08-10']);
    expect(o['2026']!.removed).toEqual(['2026-07-14']);
    // Canonical: re-adding a REMOVED date un-removes it instead of stacking
    const canonical = addHolidayDerogation(o, '2026', '2026-07-14');
    expect(canonical['2026']!.removed).toEqual([]);
    expect(canonical['2026']!.added).toEqual(['2026-02-01', '2026-08-10', '2026-07-14']);
  });

  it('addHolidayDerogation never mutates its input', () => {
    const o = {
      '2026': Object.freeze({ added: Object.freeze(['2026-02-01']), removed: Object.freeze([] as string[]) }),
    };
    const before = JSON.stringify(o);
    const next = addHolidayDerogation(o as unknown as AnnualHolidayOverrides, '2026', '2026-08-10');
    expect(JSON.stringify(o)).toBe(before);
    expect(next['2026']!.added).toEqual(['2026-02-01', '2026-08-10']);
  });

  it('removeHolidayDerogation unmarks only the removed day', () => {
    let o: AnnualHolidayOverrides = { '2026': { added: [], removed: [] } };
    o = removeHolidayDerogation(o, '2026', '2026-07-14');
    expect(annualHolidayState(d('2026-07-14'), o)).toBeNull();
    // Other default holidays remain marked
    expect(annualHolidayState(d('2026-08-15'), o)).toBe('holiday');
    expect(o['2026']!.removed).toEqual(['2026-07-14']);
  });

  it('removeHolidayDerogation removes the date from added (back to no marking)', () => {
    let o: AnnualHolidayOverrides = addHolidayDerogation({}, '2026', '2026-08-10');
    o = removeHolidayDerogation(o, '2026', '2026-08-10');
    expect(o['2026']!.added).toEqual([]);
    expect(o['2026']!.removed).toEqual(['2026-08-10']);
    expect(annualHolidayState(d('2026-08-10'), o)).toBeNull();
  });

  it('removeHolidayDerogation never mutates its input', () => {
    const o = {
      '2026': Object.freeze({ added: Object.freeze([] as string[]), removed: Object.freeze([] as string[]) }),
    };
    const before = JSON.stringify(o);
    removeHolidayDerogation(o as unknown as AnnualHolidayOverrides, '2026', '2026-07-14');
    expect(JSON.stringify(o)).toBe(before);
  });

  it('resetHolidayDerogation returns the date to its default marking', () => {
    let o: AnnualHolidayOverrides = addHolidayDerogation({}, '2026', '2026-08-10');
    o = removeHolidayDerogation(o, '2026', '2026-07-14');
    o = resetHolidayDerogation(o, '2026', '2026-07-14');
    expect(annualHolidayState(d('2026-07-14'), o)).toBe('holiday');
    expect(annualHolidayState(d('2026-08-10'), o)).toBe('holiday');
  });

  it('resetHolidayDerogation prunes the year entry when nothing remains', () => {
    let o: AnnualHolidayOverrides = addHolidayDerogation({}, '2026', '2026-08-10');
    o = resetHolidayDerogation(o, '2026', '2026-08-10');
    expect(o).toEqual({});
  });

  it('resetHolidayDerogation is a no-op (same reference) for an untouched year', () => {
    const o: AnnualHolidayOverrides = { '2027': { added: [], removed: [] } };
    expect(resetHolidayDerogation(o, '2026', '2026-08-10')).toBe(o);
  });

  it('keeps dérogations scoped to their own year', () => {
    let o: AnnualHolidayOverrides = addHolidayDerogation({}, '2026', '2026-08-10');
    // 10 Aug 2027 is not a holiday and has no 2026 dérogation applied
    expect(annualHolidayState(d('2027-08-10'), o)).toBeNull();
  });
});

// ---- clearPlanningData preservation ---------------------------------------

describe('clearPlanningData — annual holiday overrides survive', () => {
  it('preserves annualHolidayOverrides while clearing absences (config, not planning data)', () => {
    const data: AppData = {
      mediators: [],
      offers: [],
      schedules: [],
      slots: [],
      absences: [mkAbsence({ startDate: '2026-06-09', endDate: '2026-06-09', halfDay: 'morning' })],
      cycles: [],
      quotas: [],
      spaces: [],
      annualHolidayOverrides: { '2026': { added: ['2026-08-10'], removed: ['2026-07-14'] } },
    };
    const result = clearPlanningData(data);
    expect(result.absences).toEqual([]);
    expect(result.annualHolidayOverrides).toEqual({ '2026': { added: ['2026-08-10'], removed: ['2026-07-14'] } });
  });

  it('keeps the field absent when the input has none (legacy-shaped data)', () => {
    const result = clearPlanningData({
      mediators: [], offers: [], schedules: [], slots: [], absences: [], cycles: [], quotas: [], spaces: [],
    });
    expect('annualHolidayOverrides' in result).toBe(false);
  });
});

// ---- Ops + slice-1 read logic integration ---------------------------------

describe('half-day ops integrate with the slice-1 cell derivation', () => {
  const inputs = (absences: Absence[]): AnnualCellInputs => ({ cycle: aliceCycle(), absences });

  it('set then derive shows the stored code; clear reverts to derived presence', () => {
    let absences: Absence[] = [];
    absences = setHalfDayException(absences, { mediatorId: 'med_alice', date: '2026-06-09', halfDay: 'morning', type: 'leave', notes: 'CA' });
    const morning = deriveAnnualCell('med_alice', d('2026-06-09'), 'morning', inputs(absences));
    expect(morning?.state).toBe('absence');
    expect(morning?.code).toBe('CA');
    // The afternoon stays derived
    expect(deriveAnnualCell('med_alice', d('2026-06-09'), 'afternoon', inputs(absences))).toEqual({ state: 'presence' });
    absences = clearHalfDayException(absences, 'med_alice', '2026-06-09', 'morning');
    expect(deriveAnnualCell('med_alice', d('2026-06-09'), 'morning', inputs(absences))).toEqual({ state: 'presence' });
  });

  it('findHalfDayException returns the entry set by setHalfDayException', () => {
    let absences: Absence[] = [];
    absences = setHalfDayException(absences, { mediatorId: 'med_alice', date: '2026-06-09', halfDay: 'morning', type: 'leave', notes: 'CA' });
    const found = findHalfDayException(absences, 'med_alice', '2026-06-09', 'morning');
    expect(found).not.toBeNull();
    expect(found!.notes).toBe('CA');
    expect(halfDayOfAbsence(found!, d('2026-06-09'))).toBe('morning');
  });

  it('clearing a cell of a cycle-less mediator leaves it neutral (Bob, feature scenario)', () => {
    let absences: Absence[] = [];
    absences = setHalfDayException(absences, { mediatorId: 'med_bob', date: '2026-06-09', halfDay: 'morning', type: 'leave', notes: 'CA' });
    expect(deriveAnnualCell('med_bob', d('2026-06-09'), 'morning', { absences })?.state).toBe('absence');
    absences = clearHalfDayException(absences, 'med_bob', '2026-06-09', 'morning');
    expect(deriveAnnualCell('med_bob', d('2026-06-09'), 'morning', { absences })).toBeNull();
  });
});

// ---- Context menu choice mapping (slice 4: cell editing UI) -----------------
//
// The context menu picks a code chip or free text; the domain maps that
// choice onto the stored absence fields (type + notes) so the write op and
// the paint value share ONE mapping (spec: annual-editing.feature, menu
// contextuel + mode peinture scenarios).

describe('annualMenuChoice', () => {
  it('maps every catalog code onto its absence type and code notes', () => {
    const catalog = annualCodeCatalog();
    for (const entry of catalog) {
      const choice = annualMenuChoice(entry.code);
      expect(choice, entry.code).not.toBeNull();
      expect(choice!.type, entry.code).toBe(entry.absenceType);
      expect(choice!.notes, entry.code).toBe(entry.code);
    }
  });

  it('maps the « Souhait » chip onto the pending leave_request type (distinct from confirmed leave)', () => {
    const choice = annualMenuChoice('Souhait');
    expect(choice).toEqual({ type: 'leave_request', notes: 'souhait CA' });
  });

  it('returns null for an unknown code — the UI must not invent a mapping', () => {
    expect(annualMenuChoice('INCONNU')).toBeNull();
  });
});

describe('annualFreeTextEntry', () => {
  it('stores known codes as themselves (decoded suggestion picked as free text)', () => {
    expect(annualFreeTextEntry('CA')).toEqual({ type: 'leave', notes: 'CA' });
    expect(annualFreeTextEntry('JDM')).toEqual({ type: 'mission', notes: 'JDM' });
  });

  it('stores arbitrary text as a mission with the text as notes', () => {
    expect(annualFreeTextEntry('Stop Motion')).toEqual({ type: 'mission', notes: 'Stop Motion' });
  });

  it('trims the text and refuses empty input (null)', () => {
    expect(annualFreeTextEntry('  ')).toBeNull();
    expect(annualFreeTextEntry(' CA ')).toEqual({ type: 'leave', notes: 'CA' });
  });
});

// Same-day cell exceptions must visually shadow a covering multi-day range:
// the cell write op never touches ranges, so the READ side must prefer the
// exception (spec: presence model — cell edits REPLACE the derived display).
describe('deriveAnnualCell prefers the same-day cell exception over a covering range', () => {
  it('shows the cell exception (CA) even when a multi-day range covers the date', () => {
    const range = mkAbsence({ startDate: '2026-06-08', endDate: '2026-06-12', type: 'sick', notes: 'AM' });
    const cellEntry = mkAbsence({ id: 'abs_cell', startDate: '2026-06-10', endDate: '2026-06-10', halfDay: 'morning', type: 'leave', notes: 'CA' });
    const cell = deriveAnnualCell('med_alice', d('2026-06-10'), 'morning', { cycle: aliceCycle(), absences: [range, cellEntry] });
    expect(cell?.state).toBe('absence');
    expect(cell?.code).toBe('CA');
    // The afternoon still shows the range
    const pm = deriveAnnualCell('med_alice', d('2026-06-10'), 'afternoon', { cycle: aliceCycle(), absences: [range, cellEntry] });
    expect(pm?.code).toBe('AM');
  });
});
