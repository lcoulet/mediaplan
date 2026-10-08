// test/annual-view.test.ts — Annual view domain slice 1: palette states,
// code catalog, worked-Saturday counters, week labels, holiday overrides.
// Spec: test/features/annual-view/annual-grid.feature (domain scenarios).
import { describe, it, expect } from 'vitest';
import { parseLocalDate } from '../src/domain/models';
import type { Absence, WorkCycle } from '../src/domain/types';
import {
  ANNUAL_PALETTE,
  annualCodeCatalog,
  codeForAbsence,
  halfDayOfAbsence,
  workedSaturdayCounter,
  annualWeekLabel,
  annualWeekLabelsForYear,
  annualHolidayState,
  deriveAnnualCell,
  isWorkedState,
} from '../src/domain/annual-view';

const d = parseLocalDate;

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

describe('ANNUAL_PALETTE', () => {
  it('defines every palette state as a semantic key with fill and text colors', () => {
    const keys = ANNUAL_PALETTE.map((s) => s.state);
    expect(keys).toContain('absence');
    expect(keys).toContain('mission');
    expect(keys).toContain('remote');
    expect(keys).toContain('arrangement');
    expect(keys).toContain('leaveRequest');
    expect(keys).toContain('jdm');
    expect(keys).toContain('workAbsence');
    expect(keys).toContain('presence');
    expect(keys).toContain('holiday');
    expect(keys).toContain('museumClosed');
  });

  it('uses the AA-adjusted Excel hues decided on 2026-10-03', () => {
    const byState = Object.fromEntries(ANNUAL_PALETTE.map((s) => [s.state, s]));
    // violet amgt #7B5AA0, blue souhait #4178AB, pink TELE #B85555, green JDM #2F7A4A
    expect(byState.arrangement.fill).toBe('#7B5AA0');
    expect(byState.leaveRequest.fill).toBe('#4178AB');
    expect(byState.remote.fill).toBe('#B85555');
    expect(byState.jdm.fill).toBe('#2F7A4A');
    // yellow absence #F9A825 + #2b2b2b, mission orange #d68c45 + #3a2408
    expect(byState.absence.fill).toBe('#F9A825');
    expect(byState.absence.text).toBe('#2b2b2b');
    expect(byState.mission.fill).toBe('#d68c45');
    expect(byState.mission.text).toBe('#3a2408');
    // red grève/syndicat #c0392b + white, presence orange #C67A33
    expect(byState.workAbsence.fill).toBe('#c0392b');
    expect(byState.workAbsence.text).toBe('#ffffff');
    expect(byState.presence.fill).toBe('#C67A33');
    // amber holiday #fef5e7 + #8a4d10 (mockup legend)
    expect(byState.holiday.fill).toBe('#fef5e7');
    expect(byState.holiday.text).toBe('#8a4d10');
  });

  it('is keyed per state for constant-time lookup', () => {
    const byState = annualPaletteByState();
    expect(byState.presence.fill).toBe('#C67A33');
    expect(byState.museumClosed).toBeDefined();
    expect(byState.museumClosed.hatch).toBe(true);
  });
});

function annualPaletteByState() {
  const map: Record<string, (typeof ANNUAL_PALETTE)[number]> = {};
  for (const s of ANNUAL_PALETTE) map[s.state] = s;
  return map;
}

describe('annualCodeCatalog', () => {
  it('offers the full context-menu code list with per-code palette state', () => {
    const codes = annualCodeCatalog();
    const byCode = Object.fromEntries(codes.map((c) => [c.code, c]));
    // Leave codes (yellow)
    expect(byCode.CA.state).toBe('absence');
    expect(byCode.RHS.state).toBe('absence');
    expect(byCode.RTT.state).toBe('absence');
    expect(byCode.CET.state).toBe('absence');
    expect(byCode.AM.state).toBe('absence');
    expect(byCode.CEX.state).toBe('absence');
    expect(byCode.TPT.state).toBe('absence');
    // Remote work (pink)
    expect(byCode.TELE.state).toBe('remote');
    // Arrangements (violet) — two codes since 2026-10-05: worked vs not
    expect(byCode['Amgt.T'].state).toBe('arrangement');
    expect(byCode['Amgt.NT'].state).toBe('arrangement');
    // Pending leave request (blue) — existing type leave_request
    expect(byCode['souhait CA'].state).toBe('leaveRequest');
    expect(byCode['souhait CA'].absenceType).toBe('leave_request');
    // JDM mission (green) — a mission, not an absence
    expect(byCode['JDM'].state).toBe('jdm');
    expect(byCode['JDM'].absenceType).toBe('mission');
    // Work-related absences (red)
    expect(byCode['grève'].state).toBe('workAbsence');
    expect(byCode['syndicat'].state).toBe('workAbsence');
    expect(byCode['formation'].state).toBe('workAbsence');
    expect(byCode['formation'].absenceType).toBe('training');
    // Mission free text (orange) — Réf. WE
    expect(byCode['Réf. WE'].state).toBe('mission');
  });

  it('maps every catalog code to an existing AbsenceType', () => {
    for (const c of annualCodeCatalog()) {
      if (c.absenceType) {
        expect(['leave', 'mission', 'training', 'sick', 'other', 'leave_request']).toContain(c.absenceType);
      }
    }
  });
});

describe('codeForAbsence', () => {
  it('derives the displayed code from a stored absence', () => {
    expect(codeForAbsence(mkAbsence({ type: 'leave', notes: 'CA' }))).toBe('CA');
    expect(codeForAbsence(mkAbsence({ type: 'leave_request', notes: 'CA' }))).toBe('souhait CA');
    expect(codeForAbsence(mkAbsence({ type: 'mission', notes: 'JDM' }))).toBe('JDM');
    expect(codeForAbsence(mkAbsence({ type: 'training', notes: 'formation' }))).toBe('formation');
  });

  it('falls back to a generic label when notes are empty', () => {
    expect(codeForAbsence(mkAbsence({ type: 'leave', notes: '' }))).toBe('CA');
    expect(codeForAbsence(mkAbsence({ type: 'sick', notes: '' }))).toBe('AM');
    expect(codeForAbsence(mkAbsence({ type: 'other', notes: '' }))).toBe('Autre');
  });
});

describe('halfDayOfAbsence', () => {
  it('covers morning, afternoon and full-day spans', () => {
    expect(halfDayOfAbsence(mkAbsence({ startDate: '2026-06-10', endDate: '2026-06-10', halfDay: 'morning' }), d('2026-06-10'))).toBe('morning');
    expect(halfDayOfAbsence(mkAbsence({ startDate: '2026-06-10', endDate: '2026-06-10', halfDay: 'afternoon' }), d('2026-06-10'))).toBe('afternoon');
    expect(halfDayOfAbsence(mkAbsence({ startDate: '2026-06-10', endDate: '2026-06-12', halfDay: 'none' }), d('2026-06-11'))).toBe('none');
  });

  it('returns null for a date outside the range', () => {
    expect(halfDayOfAbsence(mkAbsence({ startDate: '2026-06-10', endDate: '2026-06-11' }), d('2026-06-15'))).toBeNull();
  });
});

// ---- Worked-state classification (decision 2026-10-05) ---------------------

describe('isWorkedState', () => {
  // Classification congés/travail, decided with Loic 2026-10-05:
  //  - presence, mission (Réf. WE, free text), remote (TELE), jdm,
  //    arrangement Amgt.T, workAbsence training (formation) => WORKED
  //  - absence (CA/CEX/AM/RHS/TPT), leaveRequest, arrangement Amgt.NT,
  //    workAbsence other (grève, syndicat, TPT is 'absence' state though)
  //    => NOT worked
  it('counts work: presence, mission, remote, jdm, Amgt.T, formation', () => {
    expect(isWorkedState('presence')).toBe(true);
    expect(isWorkedState('mission')).toBe(true);
    expect(isWorkedState('remote')).toBe(true);
    expect(isWorkedState('jdm')).toBe(true);
    expect(isWorkedState('arrangement', 'Amgt.T')).toBe(true);
    // Formation is a workAbsence with absenceType training — WORKED
    expect(isWorkedState('workAbsence', 'formation')).toBe(true);
  });

  it('does not count: leave, sick, leave_request, Amgt.NT, grève/syndicat', () => {
    expect(isWorkedState('absence')).toBe(false);
    expect(isWorkedState('leaveRequest')).toBe(false);
    expect(isWorkedState('arrangement', 'Amgt.NT')).toBe(false);
    expect(isWorkedState('arrangement', 'amgt 21/06')).toBe(false);
    // Legacy bare 'amgt' without T/NT marker: NOT worked (safe default)
    expect(isWorkedState('arrangement', 'amgt')).toBe(false);
    // grève/syndicat are workAbsence with absenceType 'other'
    expect(isWorkedState('workAbsence', 'grève')).toBe(false);
    expect(isWorkedState('workAbsence', 'syndicat')).toBe(false);
    // Neutral / closed / holiday cells are not worked either
    expect(isWorkedState(undefined)).toBe(false);
    expect(isWorkedState('holiday')).toBe(false);
    expect(isWorkedState('museumClosed')).toBe(false);
  });
});

// ---- Worked-Saturday counter ---------------------------------------------
// Spec fix (2026-10-04): the counter counts WORKED Saturdays as displayed
// in the annual grid — NOT slot-based. A Saturday is worked when the grid
// shows presence for the mediator (cycle-derived or worked half-day).
// Strategy is pluggable (SaturdayCountStrategy): ANY_HALF_DAY (default,
// per Loic's decision 2026-10-04: a half-day OR a full day counts for one),
// FULL_DAY (both halves), MORNING (morning half only).

function mkCycleWorksSaturdays(): WorkCycle {
  return {
    id: 'cyc_sat',
    mediatorId: 'med_alice',
    anchorIsoWeek: '2026-W01',
    forcedWeeks: {},
    weeks: [{
      id: 'w1', name: 'S1',
      days: [
        { day: 1, startTime: '09:00', endTime: '18:00' },
        { day: 2, startTime: '09:00', endTime: '18:00' },
        { day: 3, startTime: '09:00', endTime: '18:00' },
        { day: 4, startTime: '09:00', endTime: '18:00' },
        { day: 5, startTime: '09:00', endTime: '18:00' },
        { day: 6, startTime: '09:00', endTime: '18:00' }, // Saturday worked
        { day: 7 },
      ],
    }],
  };
}

describe('workedSaturdayCounter', () => {
  // 2026: Jan 1 is a Thursday — the year's Saturdays run Jan 3 → Dec 26 (52)
  it('counts worked Saturdays of the year cumulatively (grid presence)', () => {
    const inputs = { cycle: mkCycleWorksSaturdays(), absences: [] };
    expect(workedSaturdayCounter('med_alice', inputs, d('2026-01-03'))).toBe(1);
    expect(workedSaturdayCounter('med_alice', inputs, d('2026-01-10'))).toBe(2);
    expect(workedSaturdayCounter('med_alice', inputs, d('2026-12-26'))).toBe(52); // all 52 Saturdays of 2026
  });

  it('shows 0 on a non-worked Saturday, and null on any non-Saturday', () => {
    // Cycle without Saturday work
    const cycle: WorkCycle = {
      ...mkCycleWorksSaturdays(),
      weeks: [{
        id: 'w1', name: 'S1',
        days: [
          { day: 1, startTime: '09:00', endTime: '18:00' }, { day: 2, startTime: '09:00', endTime: '18:00' },
          { day: 3, startTime: '09:00', endTime: '18:00' }, { day: 4, startTime: '09:00', endTime: '18:00' },
          { day: 5, startTime: '09:00', endTime: '18:00' }, { day: 6 }, { day: 7 },
        ],
      }],
    };
    expect(workedSaturdayCounter('med_alice', { cycle, absences: [] }, d('2026-01-03'))).toBe(0);
    expect(workedSaturdayCounter('med_alice', { cycle, absences: [] }, d('2026-06-09'))).toBeNull();
  });

  it('a Saturday fully covered by an absence does NOT count; a half-day absence still counts (ANY_HALF_DAY)', () => {
    const absences = [
      // Full-day leave on 2026-01-03 (first Saturday) -> not worked
      mkAbsence({ mediatorId: 'med_alice', startDate: '2026-01-03', endDate: '2026-01-03', type: 'leave' }),
      // Morning-only leave on 2026-01-10 (second Saturday) -> afternoon worked -> counts
      mkAbsence({ mediatorId: 'med_alice', startDate: '2026-01-10', endDate: '2026-01-10', type: 'leave', halfDay: 'morning' }),
    ];
    const inputs = { cycle: mkCycleWorksSaturdays(), absences };
    expect(workedSaturdayCounter('med_alice', inputs, d('2026-01-03'))).toBe(0);
    expect(workedSaturdayCounter('med_alice', inputs, d('2026-01-10'))).toBe(1);
  });

  it('a wish (leave_request) covering a Saturday does not count as worked', () => {
    const absences = [
      mkAbsence({ mediatorId: 'med_alice', startDate: '2026-01-03', endDate: '2026-01-03', type: 'leave_request' }),
    ];
    const inputs = { cycle: mkCycleWorksSaturdays(), absences };
    expect(workedSaturdayCounter('med_alice', inputs, d('2026-01-03'))).toBe(0);
  });

  // ---- Worked states count even WITHOUT cycle presence (decision 2026-10-05)
  it('mission / TELE / JDM / Amgt.T / formation entries on a Saturday count as worked', () => {
    // Cycle does NOT work Saturdays — only stored entries make the work
    const cycleNoSat: WorkCycle = {
      ...mkCycleWorksSaturdays(),
      weeks: [{
        id: 'w1', name: 'S1',
        days: [
          { day: 1, startTime: '09:00', endTime: '18:00' }, { day: 2, startTime: '09:00', endTime: '18:00' },
          { day: 3, startTime: '09:00', endTime: '18:00' }, { day: 4, startTime: '09:00', endTime: '18:00' },
          { day: 5, startTime: '09:00', endTime: '18:00' }, { day: 6 }, { day: 7 },
        ],
      }],
    };
    const absences = [
      // Réf. WE mission on 2026-01-03 (first Saturday)
      mkAbsence({ mediatorId: 'med_alice', startDate: '2026-01-03', endDate: '2026-01-03', type: 'mission', notes: 'Réf. WE' }),
      // TELE remote on 2026-01-10
      mkAbsence({ mediatorId: 'med_alice', startDate: '2026-01-10', endDate: '2026-01-10', type: 'other', notes: 'TELE' }),
      // JDM on 2026-01-17
      mkAbsence({ mediatorId: 'med_alice', startDate: '2026-01-17', endDate: '2026-01-17', type: 'mission', notes: 'JDM' }),
      // Amgt.T on 2026-01-24
      mkAbsence({ mediatorId: 'med_alice', startDate: '2026-01-24', endDate: '2026-01-24', type: 'other', notes: 'Amgt.T' }),
      // formation on 2026-01-31
      mkAbsence({ mediatorId: 'med_alice', startDate: '2026-01-31', endDate: '2026-01-31', type: 'training', notes: 'formation' }),
    ];
    const inputs = { cycle: cycleNoSat, absences };
    expect(workedSaturdayCounter('med_alice', inputs, d('2026-01-03'))).toBe(1);
    expect(workedSaturdayCounter('med_alice', inputs, d('2026-01-10'))).toBe(2);
    expect(workedSaturdayCounter('med_alice', inputs, d('2026-01-17'))).toBe(3);
    expect(workedSaturdayCounter('med_alice', inputs, d('2026-01-24'))).toBe(4);
    expect(workedSaturdayCounter('med_alice', inputs, d('2026-01-31'))).toBe(5);
  });

  it('Amgt.NT, grève, syndicat, TPT entries on a Saturday do NOT count', () => {
    const cycleNoSat: WorkCycle = {
      ...mkCycleWorksSaturdays(),
      weeks: [{
        id: 'w1', name: 'S1',
        days: [
          { day: 1, startTime: '09:00', endTime: '18:00' }, { day: 2, startTime: '09:00', endTime: '18:00' },
          { day: 3, startTime: '09:00', endTime: '18:00' }, { day: 4, startTime: '09:00', endTime: '18:00' },
          { day: 5, startTime: '09:00', endTime: '18:00' }, { day: 6 }, { day: 7 },
        ],
      }],
    };
    const absences = [
      mkAbsence({ mediatorId: 'med_alice', startDate: '2026-01-03', endDate: '2026-01-03', type: 'other', notes: 'Amgt.NT' }),
      mkAbsence({ mediatorId: 'med_alice', startDate: '2026-01-10', endDate: '2026-01-10', type: 'other', notes: 'grève' }),
      mkAbsence({ mediatorId: 'med_alice', startDate: '2026-01-17', endDate: '2026-01-17', type: 'other', notes: 'syndicat' }),
      mkAbsence({ mediatorId: 'med_alice', startDate: '2026-01-24', endDate: '2026-01-24', type: 'other', notes: 'TPT' }),
    ];
    const inputs = { cycle: cycleNoSat, absences };
    expect(workedSaturdayCounter('med_alice', inputs, d('2026-01-03'))).toBe(0);
    expect(workedSaturdayCounter('med_alice', inputs, d('2026-01-24'))).toBe(0);
  });

  // ---- Holidays are WORKED, museum-closure days are NOT (decision 2026-10-05)
  it('a public-holiday Saturday counts as worked; a museum-closure Saturday never does', () => {
    // 2026-08-15 (Assomption) is a public holiday AND a Saturday — the
    // holiday does NOT block counting (only museum closure does).
    // 2028-01-01 is a museum-closure day (01/01) AND a Saturday — never
    // counted, whatever the cycle says.
    const inputs = { cycle: mkCycleWorksSaturdays(), absences: [] };
    // Ordinary Saturday 2026-12-26: the 52nd counted Saturday of 2026
    expect(workedSaturdayCounter('med_alice', inputs, d('2026-12-26'))).toBe(52);
    // 2027-01-02: first Saturday of 2027 (2027-01-01 is a Friday)
    expect(workedSaturdayCounter('med_alice', inputs, d('2027-01-02'))).toBe(1);
    // 2028-01-01: museum closure day on a Saturday — NOT counted
    expect(workedSaturdayCounter('med_alice', inputs, d('2028-01-01'))).toBe(0);
    expect(workedSaturdayCounter('med_alice', inputs, d('2028-01-08'))).toBe(1);
  });

  it('resets per calendar year', () => {
    const inputs = { cycle: mkCycleWorksSaturdays(), absences: [] };
    expect(workedSaturdayCounter('med_alice', inputs, d('2026-12-26'))).toBe(52);
    expect(workedSaturdayCounter('med_alice', inputs, d('2027-01-02'))).toBe(1); // first Saturday of 2027
  });

  it('FULL_DAY strategy requires both halves presence', () => {
    // First Saturday of 2026, morning on leave
    const absences = [
      mkAbsence({ mediatorId: 'med_alice', startDate: '2026-01-03', endDate: '2026-01-03', type: 'leave', halfDay: 'morning' }),
    ];
    const inputs = { cycle: mkCycleWorksSaturdays(), absences };
    expect(workedSaturdayCounter('med_alice', inputs, d('2026-01-03'), 'any_half_day')).toBe(1);
    expect(workedSaturdayCounter('med_alice', inputs, d('2026-01-03'), 'full_day')).toBe(0);
  });

  it('MORNING strategy counts only when the morning half is presence', () => {
    const absences = [
      mkAbsence({ mediatorId: 'med_alice', startDate: '2026-01-03', endDate: '2026-01-03', type: 'leave', halfDay: 'morning' }),
    ];
    const inputs = { cycle: mkCycleWorksSaturdays(), absences };
    expect(workedSaturdayCounter('med_alice', inputs, d('2026-01-03'), 'any_half_day')).toBe(1);
    expect(workedSaturdayCounter('med_alice', inputs, d('2026-01-03'), 'morning')).toBe(0);
  });

  it('ignores other mediators\' absences (their Saturdays don\'t block mine)', () => {
    const absences = [
      mkAbsence({ mediatorId: 'med_bob', startDate: '2026-01-03', endDate: '2026-01-03', type: 'leave' }),
    ];
    const inputs = { cycle: mkCycleWorksSaturdays(), absences };
    expect(workedSaturdayCounter('med_alice', inputs, d('2026-01-03'))).toBe(1);
  });
});

// ---- Week labels ---------------------------------------------------------

describe('annualWeekLabel', () => {
  it('labels a Monday row with its ISO week number', () => {
    expect(annualWeekLabel(d('2026-09-07'))).toBe('S 37');
    expect(annualWeekLabel(d('2026-09-14'))).toBe('S 38');
  });

  it('returns null on any other weekday — the label spans the week in its own column', () => {
    expect(annualWeekLabel(d('2026-09-08'))).toBeNull();
    expect(annualWeekLabel(d('2026-09-13'))).toBeNull(); // Sunday
  });

  it('follows the ISO week-year, not the calendar year (Mon 2025-12-29 is S 1 of 2026)', () => {
    expect(annualWeekLabel(d('2025-12-29'))).toBe('S 1');
    expect(annualWeekLabel(d('2026-12-28'))).toBe('S 53'); // 2026 has 53 ISO weeks
  });
});

describe('annualWeekLabelsForYear', () => {
  it('derives the week labels of a year from its day rows: one per ISO week, Monday-anchored', () => {
    const rows = yearDays(2026);
    const labels = annualWeekLabelsForYear(2026);
    // 2026: 53 ISO weeks; the grid shows the calendar year
    expect(labels.length).toBe(53);
    expect(labels[0]).toEqual({ weekKey: '2026-W01', label: 'S 1', monday: '2025-12-29' });
    expect(labels[36]).toEqual({ weekKey: '2026-W37', label: 'S 37', monday: '2026-09-07' });
    expect(labels[52]).toEqual({ weekKey: '2026-W53', label: 'S 53', monday: '2026-12-28' });
    // every label lands on a Monday of the grid rows
    for (const l of labels) {
      const dow = new Date(`${l.monday}T00:00:00`).getDay();
      expect(dow).toBe(1);
    }
    expect(rows.length).toBe(365);
  });

  it('follows the ISO week-year at year boundaries (2027: partial S 53 then S 1..S 52)', () => {
    const labels = annualWeekLabelsForYear(2027);
    // Jan 1-3 2027 belong to ISO week 2026-W53 — the mockup labels the
    // 2027-01-01 row « S 53 (2026) » — then the year runs S 1..S 52.
    expect(labels.length).toBe(53);
    expect(labels[0]).toEqual({ weekKey: '2026-W53', label: 'S 53', monday: '2026-12-28' });
    expect(labels[1]).toEqual({ weekKey: '2027-W01', label: 'S 1', monday: '2027-01-04' });
    expect(labels[52]).toEqual({ weekKey: '2027-W52', label: 'S 52', monday: '2027-12-27' });
  });
});

/** All calendar days of a year as ISO dates (Jan 1 to Dec 31). */
function yearDays(year: number): string[] {
  const days: string[] = [];
  const cursor = new Date(year, 0, 1);
  while (cursor.getFullYear() === year) {
    days.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`);
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

// ---- Holiday overrides -----------------------------------------------------

describe('annualHolidayState', () => {
  it('marks the auto-computed French holidays of the year by default', () => {
    expect(annualHolidayState(d('2026-07-14'))).toBe('holiday');
    expect(annualHolidayState(d('2026-08-15'))).toBe('holiday');
    expect(annualHolidayState(d('2026-07-13'))).toBeNull();
  });

  it('marks museum-closed days (25/12, 01/01, 01/05) with precedence over holiday', () => {
    expect(annualHolidayState(d('2026-01-01'))).toBe('museumClosed');
    expect(annualHolidayState(d('2026-05-01'))).toBe('museumClosed');
    expect(annualHolidayState(d('2026-12-25'))).toBe('museumClosed');
    expect(annualHolidayState(d('2027-01-01'))).toBe('museumClosed');
  });

  it('applies an ADD dérogation without touching the default markings', () => {
    const overrides = { '2026': { added: ['2026-08-10'], removed: [] } };
    expect(annualHolidayState(d('2026-08-10'), overrides)).toBe('holiday');
    // other defaults unchanged (feature: « le marquage par défaut des
    // autres jours fériés est inchangé »)
    expect(annualHolidayState(d('2026-07-14'), overrides)).toBe('holiday');
  });

  it('applies a REMOVE dérogation that unmarks only the removed day', () => {
    const overrides = { '2026': { added: [], removed: ['2026-07-14'] } };
    expect(annualHolidayState(d('2026-07-14'), overrides)).toBeNull();
    // other holidays of 2026 remain marked (feature: « les autres jours
    // fériés de 2026 restent marqués »)
    expect(annualHolidayState(d('2026-08-15'), overrides)).toBe('holiday');
  });

  it('keeps dérogations scoped to their own year', () => {
    const overrides = { '2026': { added: ['2026-08-10'], removed: [] } };
    expect(annualHolidayState(d('2027-08-10'), overrides)).toBeNull();
    expect(annualHolidayState(d('2027-07-14'), overrides)).toBe('holiday');
  });
});

// ---- Cell derivation --------------------------------------------------------

/** Alice's cycle: one week S1, Mon-Fri 09:30-18:00, anchored 2026-W01. */
function aliceCycle(): WorkCycle {
  const days = [];
  for (let day = 1; day <= 7; day++) {
    if (day <= 5) days.push({ day, startTime: '09:30', endTime: '18:00' });
    else days.push({ day });
  }
  return { id: 'cyc_a', mediatorId: 'med_alice', weeks: [{ id: 'cw1', name: 'S1', days }], anchorIsoWeek: '2026-W01', forcedWeeks: {} };
}

describe('deriveAnnualCell', () => {
  // Tue 9 June 2026 is a worked day of S1
  it('derives orange presence on both half-days of a worked cycle day', () => {
    expect(deriveAnnualCell('med_alice', d('2026-06-09'), 'morning', { cycle: aliceCycle(), absences: [] })).toEqual({ state: 'presence' });
    expect(deriveAnnualCell('med_alice', d('2026-06-09'), 'afternoon', { cycle: aliceCycle(), absences: [] })).toEqual({ state: 'presence' });
  });

  it('derives null (neutral) on non-worked days and without a cycle', () => {
    // Saturday 13 June 2026: not worked in S1
    expect(deriveAnnualCell('med_alice', d('2026-06-13'), 'morning', { cycle: aliceCycle(), absences: [] })).toBeNull();
    // Bob has no cycle
    expect(deriveAnnualCell('med_bob', d('2026-06-09'), 'morning', { absences: [] })).toBeNull();
  });

  it('overlays a stored absence over the derived presence, with its palette state and code', () => {
    const absences = [mkAbsence({ mediatorId: 'med_alice', startDate: '2026-06-09', endDate: '2026-06-09', halfDay: 'morning', type: 'leave', notes: 'CA' })];
    const cell = deriveAnnualCell('med_alice', d('2026-06-09'), 'morning', { cycle: aliceCycle(), absences });
    expect(cell?.state).toBe('absence');
    expect(cell?.code).toBe('CA');
    expect(cell?.absence).toBe(absences[0]);
    // the other half-day stays derived
    expect(deriveAnnualCell('med_alice', d('2026-06-09'), 'afternoon', { cycle: aliceCycle(), absences })).toEqual({ state: 'presence' });
  });

  it('shows an absence even on a non-worked day (overlay wins over the cycle)', () => {
    const absences = [mkAbsence({ mediatorId: 'med_alice', startDate: '2026-06-13', endDate: '2026-06-13', halfDay: 'morning', type: 'leave', notes: 'CA' })];
    const cell = deriveAnnualCell('med_alice', d('2026-06-13'), 'morning', { cycle: aliceCycle(), absences });
    expect(cell?.state).toBe('absence');
    expect(cell?.code).toBe('CA');
  });

  it('covers both half-days with a full-day absence', () => {
    const absences = [mkAbsence({ mediatorId: 'med_alice', startDate: '2026-06-09', endDate: '2026-06-10', halfDay: 'none', type: 'leave', notes: 'CA' })];
    for (const half of ['morning', 'afternoon'] as const) {
      const cell = deriveAnnualCell('med_alice', d('2026-06-10'), half, { cycle: aliceCycle(), absences });
      expect(cell?.state).toBe('absence');
      expect(cell?.code).toBe('CA');
    }
  });

  it('maps each stored entry onto its palette state via the code catalog', () => {
    const cases: { abs: Absence; state: string; code: string }[] = [
      { abs: mkAbsence({ type: 'leave_request', notes: 'CA' }), state: 'leaveRequest', code: 'souhait CA' },
      { abs: mkAbsence({ type: 'other', notes: 'TELE' }), state: 'remote', code: 'TELE' },
      { abs: mkAbsence({ type: 'other', notes: 'amgt 21/06' }), state: 'arrangement', code: 'amgt 21/06' },
      { abs: mkAbsence({ type: 'mission', notes: 'JDM' }), state: 'jdm', code: 'JDM' },
      { abs: mkAbsence({ type: 'mission', notes: 'Stop Motion' }), state: 'mission', code: 'Stop Motion' },
      { abs: mkAbsence({ type: 'training', notes: 'formation' }), state: 'workAbsence', code: 'formation' },
      { abs: mkAbsence({ type: 'sick', notes: '' }), state: 'absence', code: 'AM' },
    ];
    for (const c of cases) {
      const absences = [mkAbsence({ ...c.abs, mediatorId: 'med_alice', startDate: '2026-06-09', endDate: '2026-06-09', halfDay: 'morning' })];
      const cell = deriveAnnualCell('med_alice', d('2026-06-09'), 'morning', { cycle: aliceCycle(), absences });
      expect(cell?.state).toBe(c.state);
      expect(cell?.code).toBe(c.code);
    }
  });

  it('ignores other mediators\' absences', () => {
    const absences = [mkAbsence({ mediatorId: 'med_bob', startDate: '2026-06-09', endDate: '2026-06-09', type: 'leave', notes: 'CA' })];
    expect(deriveAnnualCell('med_alice', d('2026-06-09'), 'morning', { cycle: aliceCycle(), absences })).toEqual({ state: 'presence' });
  });

  it('falls back to the absence type palette when the code is not in the catalog', () => {
    const absences = [mkAbsence({ mediatorId: 'med_alice', startDate: '2026-06-09', endDate: '2026-06-09', halfDay: 'morning', type: 'leave', notes: 'congé parental' })];
    const cell = deriveAnnualCell('med_alice', d('2026-06-09'), 'morning', { cycle: aliceCycle(), absences });
    expect(cell?.state).toBe('absence');
    expect(cell?.code).toBe('congé parental');
  });
});
