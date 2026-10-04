// test/annual-view.test.ts — Annual view domain slice 1: palette states,
// code catalog, worked-Saturday counters, week labels, holiday overrides.
// Spec: test/features/annual-view/annual-grid.feature (domain scenarios).
import { describe, it, expect } from 'vitest';
import { parseLocalDate } from '../src/domain/models';
import type { Absence, Slot } from '../src/domain/types';
import {
  ANNUAL_PALETTE,
  annualCodeCatalog,
  codeForAbsence,
  halfDayOfAbsence,
  workedSaturdayCounter,
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
    // Arrangement (violet)
    expect(byCode['amgt'].state).toBe('arrangement');
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

// ---- Worked-Saturday counter ---------------------------------------------

function mkSlot(mediatorId: string, date: string, status: Slot['status'] = 'confirmed'): Slot {
  return {
    id: `slot_${mediatorId}_${date}`,
    scheduleId: 'sch_1',
    offerId: 'off_1',
    mediatorIds: [mediatorId],
    date,
    startTime: '10:00',
    endTime: '12:00',
    participantCount: 10,
    status,
    notes: '',
    origin: 'manual',
    importSource: '',
    importedAt: '',
    modifiedAfterImport: false,
    groupName: '',
    guide: '',
    location: '',
    groupNature: '',
    contactName: '',
    contactPhone: '',
    contactEmail: '',
  };
}

describe('workedSaturdayCounter', () => {
  it('counts 1, 2, 3 on the mediator Saturdays WITH slots as the year goes', () => {
    const slots = [
      mkSlot('med_alice', '2026-01-10'),
      mkSlot('med_alice', '2026-02-14'),
      mkSlot('med_alice', '2026-03-14'),
    ];
    expect(workedSaturdayCounter('med_alice', slots, d('2026-02-14'))).toBe(2);
    expect(workedSaturdayCounter('med_alice', slots, d('2026-03-14'))).toBe(3);
    expect(workedSaturdayCounter('med_alice', slots, d('2026-12-26'))).toBe(3);
  });

  it('shows 0 on a Saturday before the first worked Saturday, and null on any non-Saturday', () => {
    const slots = [mkSlot('med_alice', '2026-02-14')];
    expect(workedSaturdayCounter('med_alice', slots, d('2026-01-10'))).toBe(0);
    expect(workedSaturdayCounter('med_alice', slots, d('2026-06-09'))).toBeNull();
  });

  it('ignores cancelled slots and other mediators\' slots', () => {
    // Alice: her cancelled slot is ignored, Bob's slot is not hers -> 0
    expect(workedSaturdayCounter('med_alice', [mkSlot('med_alice', '2026-01-10', 'cancelled'), mkSlot('med_bob', '2026-01-10')], d('2026-01-10'))).toBe(0);
    // Alice: her own confirmed slot counts; Bob's does not inflate it
    expect(workedSaturdayCounter('med_alice', [mkSlot('med_alice', '2026-01-10'), mkSlot('med_bob', '2026-01-10')], d('2026-01-10'))).toBe(1);
    // Bob: his own slot counts for his counter
    expect(workedSaturdayCounter('med_bob', [mkSlot('med_bob', '2026-01-10')], d('2026-01-10'))).toBe(1);
  });

  it('resets to 0 when the year changes', () => {
    const slots = [
      mkSlot('med_alice', '2026-02-14'),
      mkSlot('med_alice', '2027-01-09'),
    ];
    expect(workedSaturdayCounter('med_alice', slots, d('2027-01-09'))).toBe(1);
    expect(workedSaturdayCounter('med_alice', slots, d('2027-12-25'))).toBe(1);
  });

  it('counts several slots on the same Saturday once', () => {
    const slots = [
      mkSlot('med_alice', '2026-01-10'),
      mkSlot('med_alice', '2026-01-10'),
    ];
    expect(workedSaturdayCounter('med_alice', slots, d('2026-01-10'))).toBe(1);
  });
});
