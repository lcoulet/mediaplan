// cycle-edit.test.ts — Cycle editing helpers for the cycle-chain modal:
// week add/remove/rename/reorder, per-day range edits, week summary,
// anchor + forced weeks, quota helpers (parse/format/summary). Pure domain
// logic extracted from the modal UI (project convention: UI glue is not
// unit-tested; all testable logic lives here). Spec: cycle-model.feature
// (modal scenarios) + hourly-management.feature (quota display).
import { describe, it, expect } from 'vitest';
import type { CycleWeek, CycleWeekDay, Mediator, WorkCycle } from '../src/domain/types';
import { cycleWeekForIsoWeek, validateCycle } from '../src/domain/cycles';
import {
  addCycleWeek,
  removeCycleWeek,
  renameCycleWeek,
  moveCycleWeek,
  setDayWorked,
  setDayRange,
  summarizeCycleWeek,
  validateIsoWeekKey,
  cycleQuotaSummary,
  quotaNumberFromInput,
} from '../src/domain/cycle-edit';

// ---- Test helpers ----------------------------------------------------

const DEFAULT_RANGE = ['09:30', '18:00'] as [string, string];
const MON_FRI: Record<number, [string, string]> = {
  1: DEFAULT_RANGE,
  2: DEFAULT_RANGE,
  3: DEFAULT_RANGE,
  4: DEFAULT_RANGE,
  5: DEFAULT_RANGE,
};

function mkWeek(id: string, name: string, worked: Record<number, [string, string]> = {}): CycleWeek {
  const days: CycleWeekDay[] = [];
  for (let d = 1; d <= 7; d++) {
    const range = worked[d];
    days.push(range ? { day: d, startTime: range[0], endTime: range[1] } : { day: d });
  }
  return { id, name, days };
}

function mkCycle(weeks: CycleWeek[], anchor = '2026-W40'): WorkCycle {
  return {
    id: 'cyc_1',
    mediatorId: 'med_alice',
    weeks,
    anchorIsoWeek: anchor,
    forcedWeeks: {},
  };
}

// ---- addCycleWeek ----------------------------------------------------

describe('addCycleWeek', () => {
  it('appends a new week auto-named S{n+1} at the end of the rotation', () => {
    const cycle = mkCycle([mkWeek('w1', 'S1', MON_FRI), mkWeek('w2', 'S2', MON_FRI)]);
    const next = addCycleWeek(cycle);
    expect(next.weeks).toHaveLength(3);
    const added = next.weeks[2];
    expect(added.name).toBe('S3');
    // Not worked by default: every day entry exists, no times set
    expect(added.days).toHaveLength(7);
    for (const d of added.days) {
      expect(d.startTime).toBeUndefined();
      expect(d.endTime).toBeUndefined();
    }
    // New week extends the rotation: W42 → S3 from anchor W40
    expect(cycleWeekForIsoWeek(next, '2026-W42')!.name).toBe('S3');
  });

  it('names the week S1 on a 0-week cycle', () => {
    const next = addCycleWeek(mkCycle([]));
    expect(next.weeks).toHaveLength(1);
    expect(next.weeks[0].name).toBe('S1');
  });

  it('falls back to a non-conflicting name when S{n+1} is taken', () => {
    const cycle = mkCycle([mkWeek('w1', 'S1'), mkWeek('w2', 'S3')]);
    const next = addCycleWeek(cycle);
    expect(next.weeks[2].name).toBe('S4');
  });

  it('does not mutate the input cycle', () => {
    const cycle = mkCycle([mkWeek('w1', 'S1')]);
    addCycleWeek(cycle);
    expect(cycle.weeks).toHaveLength(1);
  });
});

// ---- removeCycleWeek ---------------------------------------------------

describe('removeCycleWeek', () => {
  it('removes the week with the given id', () => {
    const cycle = mkCycle([mkWeek('w1', 'S1'), mkWeek('w2', 'S2')]);
    const next = removeCycleWeek(cycle, 'w1');
    expect(next.weeks.map((w) => w.name)).toEqual(['S2']);
  });

  it('drops forced entries that pointed at the removed week', () => {
    const cycle = mkCycle([mkWeek('w1', 'S1'), mkWeek('w2', 'S2')]);
    cycle.forcedWeeks['2026-W41'] = 'S1';
    cycle.forcedWeeks['2026-W42'] = 'S2';
    const next = removeCycleWeek(cycle, 'w1');
    expect(next.forcedWeeks).toEqual({ '2026-W42': 'S2' });
  });

  it('returns the SAME 0-week cycle on last-week removal (0 weeks is invalid)', () => {
    const cycle = mkCycle([mkWeek('w1', 'S1')]);
    const next = removeCycleWeek(cycle, 'w1');
    // The modal REJECTS the removal: a cycle must have at least one week
    // (spec: « le cycle doit comporter au moins une semaine »). removeCycleWeek
    // refuses to produce an invalid cycle.
    expect(next.weeks).toHaveLength(1);
    expect(next).toBe(cycle);
  });
});

// ---- renameCycleWeek ---------------------------------------------------

describe('renameCycleWeek', () => {
  it('renames the week with the given id', () => {
    const cycle = mkCycle([mkWeek('w1', 'S1')]);
    const next = renameCycleWeek(cycle, 'w1', 'Semaine matin');
    expect(next.weeks[0].name).toBe('Semaine matin');
    expect(next.weeks).toHaveLength(1);
  });

  it('keeps forced entries in sync with the renamed week', () => {
    const cycle = mkCycle([mkWeek('w1', 'S1')]);
    cycle.forcedWeeks['2026-W41'] = 'S1';
    const next = renameCycleWeek(cycle, 'w1', 'Matin');
    expect(next.forcedWeeks['2026-W41']).toBe('Matin');
  });

  it('trims the name', () => {
    const cycle = mkCycle([mkWeek('w1', 'S1')]);
    const next = renameCycleWeek(cycle, 'w1', '  S1 bis  ');
    expect(next.weeks[0].name).toBe('S1 bis');
  });
});

// ---- moveCycleWeek -----------------------------------------------------

describe('moveCycleWeek', () => {
  const s123 = () => mkCycle([mkWeek('w1', 'S1'), mkWeek('w2', 'S2'), mkWeek('w3', 'S3')]);

  it('moves a week up in the rotation', () => {
    const next = moveCycleWeek(s123(), 'w2', -1);
    expect(next.weeks.map((w) => w.name)).toEqual(['S2', 'S1', 'S3']);
  });

  it('moves a week down in the rotation', () => {
    const next = moveCycleWeek(s123(), 'w2', 1);
    expect(next.weeks.map((w) => w.name)).toEqual(['S1', 'S3', 'S2']);
  });

  it('is a no-op at the boundaries (first up / last down)', () => {
    expect(moveCycleWeek(s123(), 'w1', -1).weeks.map((w) => w.name)).toEqual(['S1', 'S2', 'S3']);
    expect(moveCycleWeek(s123(), 'w3', 1).weeks.map((w) => w.name)).toEqual(['S1', 'S2', 'S3']);
  });
});

// ---- setDayWorked / setDayRange -----------------------------------------

describe('setDayWorked', () => {
  it('unchecking a worked day removes its range entirely (spec: non-worked day has none)', () => {
    const cycle = mkCycle([mkWeek('w1', 'S1', MON_FRI)]);
    const next = setDayWorked(cycle, 'w1', 3, false);
    const wed = next.weeks[0].days.find((d) => d.day === 3)!;
    expect(wed.startTime).toBeUndefined();
    expect(wed.endTime).toBeUndefined();
    expect(validateCycle(next).ok).toBe(true);
  });

  it('checking a non-worked day gives it the default 09:30-18:00 range', () => {
    const cycle = mkCycle([mkWeek('w1', 'S1', MON_FRI)]);
    const next = setDayWorked(cycle, 'w1', 6, true);
    const sat = next.weeks[0].days.find((d) => d.day === 6)!;
    expect(sat).toEqual({ day: 6, startTime: '09:30', endTime: '18:00' });
  });
});

describe('setDayRange', () => {
  it('sets start and end of a day range', () => {
    const cycle = mkCycle([mkWeek('w1', 'S1', MON_FRI)]);
    const next = setDayRange(cycle, 'w1', 2, '10:00', '18:30');
    expect(next.weeks[0].days.find((d) => d.day === 2)).toEqual({
      day: 2,
      startTime: '10:00',
      endTime: '18:30',
    });
  });

  it('setting only the start keeps the existing end', () => {
    const cycle = mkCycle([mkWeek('w1', 'S1', MON_FRI)]);
    const next = setDayRange(cycle, 'w1', 1, '08:00', undefined);
    expect(next.weeks[0].days.find((d) => d.day === 1)).toEqual({
      day: 1,
      startTime: '08:00',
      endTime: '18:00',
    });
  });
});

// ---- summarizeCycleWeek ---------------------------------------------------

describe('summarizeCycleWeek', () => {
  it('summarizes a Mon-Fri week as lun-ven 09:30-18:00', () => {
    expect(summarizeCycleWeek(mkWeek('w1', 'S1', MON_FRI))).toBe('lun-ven 09:30-18:00');
  });

  it('summarizes scattered days with · separators', () => {
    const week = mkWeek('w1', 'S1', { 1: ['09:30', '18:00'], 6: ['10:00', '17:00'] });
    expect(summarizeCycleWeek(week)).toBe('lun 09:30-18:00 · sam 10:00-17:00');
  });

  it('shows aucun jour travaillé for a week with no worked day', () => {
    expect(summarizeCycleWeek(mkWeek('w1', 'S1'))).toBe('aucun jour travaillé');
  });

  it('uses dim for Sunday', () => {
    const week = mkWeek('w1', 'S1', { 7: ['10:00', '17:00'] });
    expect(summarizeCycleWeek(week)).toBe('dim 10:00-17:00');
  });
});

// ---- validateIsoWeekKey -----------------------------------------------------

describe('validateIsoWeekKey', () => {
  it('accepts a well-formed ISO week key', () => {
    expect(validateIsoWeekKey('2026-W40')).toBe(true);
    expect(validateIsoWeekKey('2026-W01')).toBe(true);
    expect(validateIsoWeekKey('2026-W53')).toBe(true);
  });

  it('rejects malformed keys', () => {
    expect(validateIsoWeekKey('2026-W')).toBe(false);
    expect(validateIsoWeekKey('2026')).toBe(false);
    expect(validateIsoWeekKey('2026-W00')).toBe(false);
    expect(validateIsoWeekKey('2026-W54')).toBe(false);
    expect(validateIsoWeekKey('26-W40')).toBe(false);
    expect(validateIsoWeekKey('')).toBe(false);
  });
});

// ---- quotaNumberFromInput ------------------------------------------------------

describe('quotaNumberFromInput', () => {
  it('parses a French or plain decimal input', () => {
    expect(quotaNumberFromInput('120')).toBe(120);
    expect(quotaNumberFromInput('120,5')).toBe(120.5);
    expect(quotaNumberFromInput('120.5')).toBe(120.5);
    expect(quotaNumberFromInput(' 120 ')).toBe(120);
  });

  it('returns null for empty or invalid input', () => {
    expect(quotaNumberFromInput('')).toBeNull();
    expect(quotaNumberFromInput('abc')).toBeNull();
    expect(quotaNumberFromInput('-5')).toBeNull(); // negative refused by validateQuota
  });
});

// ---- cycleQuotaSummary -----------------------------------------------------------

describe('cycleQuotaSummary', () => {
  const mediator = (arrangement?: string): Mediator => ({
    id: 'med_alice',
    lastName: 'Dupont',
    firstName: 'Alice',
    email: '',
    phone: '',
    competences: [],
    active: true,
    color: '#123456',
    notes: '',
    arrangement,
  });

  it('formats the counter « T3 2026 : 112h / 120h » with the balance', () => {
    const summary = cycleQuotaSummary(
      mediator('temps partiel'),
      { quota: 120, trackedHours: 112, carriedOver: 0, balance: 8 },
      3,
      2026
    );
    expect(summary.counter).toBe('T3 2026 : 112h / 120h');
    expect(summary.balance).toBe('Solde : 8h');
    expect(summary.overrun).toBe(false);
    expect(summary.carriedLabel).toBeUndefined();
  });

  it('marks the overrun and formats the dépassement message', () => {
    const summary = cycleQuotaSummary(
      mediator('temps partiel'),
      { quota: 120, trackedHours: 130, carriedOver: 0, balance: -10 },
      1,
      2026
    );
    expect(summary.overrun).toBe(true);
    expect(summary.balance).toBe('Dépassement de 10h');
  });

  it('mentions the carried-over reliquat when non-zero', () => {
    const summary = cycleQuotaSummary(
      mediator('temps partiel'),
      { quota: 100, trackedHours: 20, carriedOver: 5, balance: 85 },
      2,
      2026
    );
    expect(summary.carriedLabel).toBe('dont 5h reportés du trimestre précédent');
  });

  it('mentions a carried-over déficit', () => {
    const summary = cycleQuotaSummary(
      mediator('temps partiel'),
      { quota: 100, trackedHours: 20, carriedOver: -5, balance: 85 },
      2,
      2026
    );
    expect(summary.carriedLabel).toBe('dont 5h de déficit reportés du trimestre précédent');
  });

  it('formats fractional hours with a comma (French)', () => {
    const summary = cycleQuotaSummary(
      mediator('temps partiel'),
      { quota: 120.5, trackedHours: 112.25, carriedOver: 0, balance: 8.25 },
      3,
      2026
    );
    expect(summary.counter).toBe('T3 2026 : 112,25h / 120,5h');
  });

  it('returns null-balances as no-overrun with a plain solde line', () => {
    const summary = cycleQuotaSummary(
      mediator('mi-temps thérapeutique'),
      { quota: 100, trackedHours: 100, carriedOver: 0, balance: 0 },
      4,
      2026
    );
    expect(summary.overrun).toBe(false);
    expect(summary.balance).toBe('Solde : 0h');
  });
});
