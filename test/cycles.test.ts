// test/cycles.test.ts — Work cycle domain: default cycle, structure,
// validation, rotation/anchor/forcing, ISO week arithmetic, JSON copy/paste.
// Spec: test/features/cycles/cycle-model.feature (domain scenarios only).
import { describe, it, expect } from 'vitest';
import { parseLocalDate } from '../src/domain/models';
import type { CycleWeek, CycleWeekDay, WorkCycle } from '../src/domain/types';
import {
  createDefaultCycle,
  validateCycle,
  cycleWeekForDate,
  copyCycleToJSON,
  pasteCycleFromJSON,
  getWorkedHoursForDate,
  setActiveCycle,
  isoWeekKey,
  addIsoWeeks,
  isoWeeksBetween,
} from '../src/domain/cycles';

// ---- Test helpers ----------------------------------------------------

const DEFAULT_RANGE = ['09:30', '18:00'] as [string, string];

/** Mon..Sun worked-day map: Mon-Fri 09:30-18:00, weekends off. */
const MON_FRI: Record<number, [string, string]> = {
  1: DEFAULT_RANGE,
  2: DEFAULT_RANGE,
  3: DEFAULT_RANGE,
  4: DEFAULT_RANGE,
  5: DEFAULT_RANGE,
};

/** Build one cycle week (7 days, Mon..Sun order). */
function mkWeek(
  id: string,
  name: string,
  worked: Record<number, [string, string]> = {}
): CycleWeek {
  const days: CycleWeekDay[] = [];
  for (let d = 1; d <= 7; d++) {
    const range = worked[d];
    days.push(range ? { day: d, startTime: range[0], endTime: range[1] } : { day: d });
  }
  return { id, name, days };
}

/** Build a cycle anchored by default on 2026-W40. */
function mkCycle(
  weeks: CycleWeek[],
  opts: { mediatorId?: string; anchor?: string; forced?: Record<string, string> } = {}
): WorkCycle {
  return {
    id: 'cyc_1',
    mediatorId: opts.mediatorId ?? 'med_alice',
    weeks,
    anchorIsoWeek: opts.anchor ?? '2026-W40',
    forcedWeeks: opts.forced ?? {},
  };
}

/** Monday of an ISO week from its key, as a local Date. */
function mondayOf(key: string): Date {
  const [y, w] = key.split('-W').map(Number);
  // Jan 4 is always in ISO week 1 of its year.
  const jan4 = new Date(y, 0, 4);
  const day = (jan4.getDay() + 6) % 7; // Mon=0..Sun=6
  return new Date(jan4.getFullYear(), jan4.getMonth(), jan4.getDate() - day + (w - 1) * 7);
}

// ---- Default cycle ---------------------------------------------------

describe('createDefaultCycle', () => {
  it('gives a new mediator a single-week cycle named S1', () => {
    const cycle = createDefaultCycle('med_bob', '2026-W40');
    expect(cycle.mediatorId).toBe('med_bob');
    expect(cycle.weeks).toHaveLength(1);
    expect(cycle.weeks[0].name).toBe('S1');
  });

  it('works S1 Monday to Friday, 09:30-18:00 each worked day', () => {
    const cycle = createDefaultCycle('med_bob', '2026-W40');
    const days = cycle.weeks[0].days;
    expect(days).toHaveLength(7);
    for (const d of [1, 2, 3, 4, 5]) {
      expect(days[d - 1]).toEqual({ day: d, startTime: '09:30', endTime: '18:00' });
    }
  });

  it('leaves Saturday and Sunday as non-worked days in S1', () => {
    const cycle = createDefaultCycle('med_bob', '2026-W40');
    const days = cycle.weeks[0].days;
    for (const d of [6, 7]) {
      const day = days[d - 1];
      expect(day.day).toBe(d);
      expect(day.startTime).toBeUndefined();
      expect(day.endTime).toBeUndefined();
    }
  });

  it('anchors the rotation on the current ISO week by default', () => {
    const cycle = createDefaultCycle('med_bob');
    expect(cycle.anchorIsoWeek).toBe(isoWeekKey(new Date()));
    expect(cycle.forcedWeeks).toEqual({});
  });

  it('produces a cycle that passes validation', () => {
    const cycle = createDefaultCycle('med_bob');
    expect(validateCycle(cycle).ok).toBe(true);
  });
});

// ---- Cycle structure & validation ------------------------------------

describe('cycle structure', () => {
  it('keeps multiple weeks in order with per-day ranges', () => {
    const cycle = mkCycle([
      mkWeek('w1', 'S1', { 1: ['09:30', '18:00'], 2: ['10:00', '18:30'] }),
      mkWeek('w2', 'S2', MON_FRI),
      mkWeek('w3', 'S3'),
    ]);
    expect(cycle.weeks.map((w) => w.name)).toEqual(['S1', 'S2', 'S3']);
    expect(cycle.weeks[0].days[0]).toEqual({ day: 1, startTime: '09:30', endTime: '18:00' });
    expect(cycle.weeks[0].days[1]).toEqual({ day: 2, startTime: '10:00', endTime: '18:30' });
  });

  it('defines no range for a non-worked day', () => {
    const cycle = mkCycle([mkWeek('w1', 'S1', { 1: DEFAULT_RANGE })]);
    const wednesday = cycle.weeks[0].days[2];
    expect(wednesday).toEqual({ day: 3 });
    expect(wednesday.startTime).toBeUndefined();
  });

  it('allows worked weekends', () => {
    const cycle = mkCycle([mkWeek('w1', 'S1', { 6: ['10:00', '17:00'] })]);
    const saturday = cycle.weeks[0].days[5];
    expect(saturday).toEqual({ day: 6, startTime: '10:00', endTime: '17:00' });
  });

  it('allows renaming a week while keeping one week', () => {
    const cycle = mkCycle([mkWeek('w1', 'S1')]);
    cycle.weeks[0].name = 'Semaine matin';
    expect(cycle.weeks).toHaveLength(1);
    expect(cycle.weeks[0].name).toBe('Semaine matin');
    expect(validateCycle(cycle).ok).toBe(true);
  });
});

describe('validateCycle', () => {
  it('accepts a valid cycle', () => {
    const v = validateCycle(mkCycle([mkWeek('w1', 'S1', MON_FRI)]));
    expect(v.ok).toBe(true);
    expect(v.errors).toEqual([]);
  });

  it('rejects a 0-week cycle with the exact spec message', () => {
    const v = validateCycle(mkCycle([]));
    expect(v.ok).toBe(false);
    expect(v.errors).toContain('Le cycle doit comporter au moins une semaine');
  });

  it('rejects a reversed time range with the exact spec message', () => {
    const cycle = mkCycle([mkWeek('w1', 'S1', { 1: ['18:00', '09:30'] })]);
    const v = validateCycle(cycle);
    expect(v.ok).toBe(false);
    expect(v.errors).toContain("L'heure de début doit précéder l'heure de fin");
  });

  it('rejects a zero-length time range with the same message', () => {
    const cycle = mkCycle([mkWeek('w1', 'S1', { 1: ['09:30', '09:30'] })]);
    const v = validateCycle(cycle);
    expect(v.ok).toBe(false);
    expect(v.errors).toContain("L'heure de début doit précéder l'heure de fin");
  });

  it('rejects an empty week name', () => {
    const v = validateCycle(mkCycle([mkWeek('w1', '')]));
    expect(v.ok).toBe(false);
    expect(v.errors.some((e) => e.includes('nom'))).toBe(true);
  });

  it('rejects duplicate week names', () => {
    const v = validateCycle(mkCycle([mkWeek('w1', 'S1'), mkWeek('w2', 'S1')]));
    expect(v.ok).toBe(false);
    expect(v.errors.some((e) => e.includes('S1'))).toBe(true);
  });
});

// ---- ISO week helpers -------------------------------------------------

describe('ISO week helpers', () => {
  it('computes ISO week keys with week-year (week 1 may start in December)', () => {
    expect(isoWeekKey(parseLocalDate('2026-09-28'))).toBe('2026-W40');
    expect(isoWeekKey(parseLocalDate('2026-10-06'))).toBe('2026-W41');
    expect(isoWeekKey(parseLocalDate('2025-12-29'))).toBe('2026-W01');
    expect(isoWeekKey(parseLocalDate('2027-01-03'))).toBe('2026-W53');
    expect(isoWeekKey(parseLocalDate('2027-01-04'))).toBe('2027-W01');
    expect(isoWeekKey(parseLocalDate('2020-12-28'))).toBe('2020-W53');
    expect(isoWeekKey(parseLocalDate('2021-01-04'))).toBe('2021-W01');
  });

  it('addIsoWeeks crosses year boundaries and week 53', () => {
    expect(addIsoWeeks('2025-W52', 1)).toBe('2026-W01');
    expect(addIsoWeeks('2020-W53', 1)).toBe('2021-W01');
    expect(addIsoWeeks('2026-W40', 3)).toBe('2026-W43');
    expect(addIsoWeeks('2026-W40', -1)).toBe('2026-W39');
    expect(addIsoWeeks('2026-W53', 1)).toBe('2027-W01');
  });

  it('isoWeeksBetween counts signed week differences across boundaries', () => {
    expect(isoWeeksBetween('2026-W40', '2026-W43')).toBe(3);
    expect(isoWeeksBetween('2026-W43', '2026-W40')).toBe(-3);
    expect(isoWeeksBetween('2025-W52', '2026-W01')).toBe(1);
    expect(isoWeeksBetween('2020-W53', '2021-W01')).toBe(1);
    expect(isoWeeksBetween('2026-W40', '2026-W40')).toBe(0);
  });
});

// ---- Rotation, anchor, forcing ----------------------------------------

describe('cycleWeekForDate — rotation', () => {
  const s123 = () => [
    mkWeek('w1', 'S1', MON_FRI),
    mkWeek('w2', 'S2', MON_FRI),
    mkWeek('w3', 'S3', MON_FRI),
  ];

  it('rotates S1 → S2 → S3 → S1 from the anchor', () => {
    const cycle = mkCycle(s123(), { anchor: '2026-W40' });
    expect(cycleWeekForDate(cycle, mondayOf('2026-W40'))!.name).toBe('S1');
    expect(cycleWeekForDate(cycle, parseLocalDate('2026-10-06'))!.name).toBe('S2'); // Tue of W41
    expect(cycleWeekForDate(cycle, mondayOf('2026-W42'))!.name).toBe('S3');
    expect(cycleWeekForDate(cycle, mondayOf('2026-W43'))!.name).toBe('S1');
  });

  it('returns S1 for every ISO week on a single-week cycle', () => {
    const cycle = mkCycle([mkWeek('w1', 'S1')], { anchor: '2026-W40' });
    for (const key of ['2026-W40', '2026-W41', '2026-W42']) {
      expect(cycleWeekForDate(cycle, mondayOf(key))!.name).toBe('S1');
    }
  });

  it('follows the rotation backwards for ISO weeks before the anchor', () => {
    const cycle = mkCycle(s123(), { anchor: '2026-W41' }); // re-anchor: S1 at W41 → S2 at W42
    expect(cycleWeekForDate(cycle, mondayOf('2026-W42'))!.name).toBe('S2');
    expect(cycleWeekForDate(cycle, mondayOf('2026-W43'))!.name).toBe('S3');
    expect(cycleWeekForDate(cycle, mondayOf('2026-W44'))!.name).toBe('S1');
    // Weeks before the anchor follow the rotation backwards (unbounded)
    expect(cycleWeekForDate(cycle, mondayOf('2026-W40'))!.name).toBe('S3');
    expect(cycleWeekForDate(cycle, mondayOf('2026-W39'))!.name).toBe('S2');
  });

  it('rotates across the year boundary (2025-W52 → 2026-W01 → ...)', () => {
    const cycle = mkCycle([mkWeek('w1', 'S1'), mkWeek('w2', 'S2')], { anchor: '2025-W52' });
    expect(cycleWeekForDate(cycle, mondayOf('2025-W52'))!.name).toBe('S1');
    expect(cycleWeekForDate(cycle, parseLocalDate('2025-12-29'))!.name).toBe('S2'); // 2026-W01
    expect(cycleWeekForDate(cycle, mondayOf('2026-W02'))!.name).toBe('S1');
    expect(cycleWeekForDate(cycle, mondayOf('2025-W51'))!.name).toBe('S2'); // backwards
  });

  it('handles ISO week 53 correctly', () => {
    const cycle = mkCycle([mkWeek('w1', 'S1'), mkWeek('w2', 'S2')], { anchor: '2026-W52' });
    expect(cycleWeekForDate(cycle, mondayOf('2026-W52'))!.name).toBe('S1');
    expect(cycleWeekForDate(cycle, parseLocalDate('2026-12-29'))!.name).toBe('S2'); // 2026-W53
    expect(cycleWeekForDate(cycle, mondayOf('2027-W01'))!.name).toBe('S1');
  });

  it('handles the 53-week year 2020 → 2021', () => {
    const cycle = mkCycle([mkWeek('w1', 'S1'), mkWeek('w2', 'S2')], { anchor: '2020-W53' });
    expect(cycleWeekForDate(cycle, mondayOf('2020-W53'))!.name).toBe('S1');
    expect(cycleWeekForDate(cycle, mondayOf('2021-W01'))!.name).toBe('S2');
  });

  it('extends the rotation when a week is added at the end', () => {
    const cycle = mkCycle([mkWeek('w1', 'S1'), mkWeek('w2', 'S2')], { anchor: '2026-W40' });
    cycle.weeks.push(mkWeek('w3', 'S3', MON_FRI));
    expect(cycleWeekForDate(cycle, mondayOf('2026-W42'))!.name).toBe('S3');
    expect(cycleWeekForDate(cycle, mondayOf('2026-W43'))!.name).toBe('S1');
  });

  it('returns undefined for a 0-week cycle', () => {
    const cycle = mkCycle([]);
    expect(cycleWeekForDate(cycle, mondayOf('2026-W40'))).toBeUndefined();
  });
});

describe('cycleWeekForDate — forced weeks', () => {
  const s123 = () => [
    mkWeek('w1', 'S1', MON_FRI),
    mkWeek('w2', 'S2', MON_FRI),
    mkWeek('w3', 'S3', MON_FRI),
  ];

  it('a forced ISO week takes absolute precedence over rotation', () => {
    const cycle = mkCycle(s123(), { anchor: '2026-W40', forced: { '2026-W41': 'S3' } });
    expect(cycleWeekForDate(cycle, mondayOf('2026-W41'))!.name).toBe('S3');
    // Neighbouring weeks keep following the pure rotation (W42 → S3) as if
    // the force didn't exist. NOTE: the feature file line « ... pour 2026-W42
    // suit la rotation « S2 » » contradicts its own default-rotation scenario
    // (W42 → S3 from anchor W40); the task spec resolves rotation as the
    // pure anchor difference mod N, so S3 is the expected value.
    expect(cycleWeekForDate(cycle, mondayOf('2026-W42'))!.name).toBe('S3');
  });

  it('several ISO weeks can be forced independently', () => {
    const cycle = mkCycle([mkWeek('w1', 'S1'), mkWeek('w2', 'S2')], {
      anchor: '2026-W40',
      forced: { '2026-W41': 'S2', '2026-W52': 'S1' },
    });
    expect(cycleWeekForDate(cycle, mondayOf('2026-W41'))!.name).toBe('S2');
    expect(cycleWeekForDate(cycle, mondayOf('2026-W52'))!.name).toBe('S1');
    // Unforced weeks follow the rotation S1 → S2 → S1
    expect(cycleWeekForDate(cycle, mondayOf('2026-W42'))!.name).toBe('S1');
    expect(cycleWeekForDate(cycle, mondayOf('2026-W43'))!.name).toBe('S2');
  });

  it('cancelling a force resumes the rotation', () => {
    const cycle = mkCycle([mkWeek('w1', 'S1'), mkWeek('w2', 'S2')], {
      anchor: '2026-W40',
      forced: { '2026-W41': 'S2' },
    });
    expect(cycleWeekForDate(cycle, mondayOf('2026-W41'))!.name).toBe('S2');
    delete cycle.forcedWeeks['2026-W41'];
    expect(cycleWeekForDate(cycle, mondayOf('2026-W41'))!.name).toBe('S2'); // rotation also gives S2 here
    // Distinguish from rotation with a force that differs from it
    cycle.forcedWeeks['2026-W42'] = 'S2';
    expect(cycleWeekForDate(cycle, mondayOf('2026-W42'))!.name).toBe('S2'); // forced (rotation says S1)
    delete cycle.forcedWeeks['2026-W42'];
    expect(cycleWeekForDate(cycle, mondayOf('2026-W42'))!.name).toBe('S1'); // rotation resumed
  });

  it('falls back to rotation when a forced name matches no week', () => {
    const cycle = mkCycle(s123(), { anchor: '2026-W40', forced: { '2026-W41': 'S9' } });
    expect(cycleWeekForDate(cycle, mondayOf('2026-W41'))!.name).toBe('S2');
  });
});

// ---- One active cycle per mediator ------------------------------------

describe('setActiveCycle', () => {
  it('replaces the previous cycle of the same mediator', () => {
    const old = mkCycle([mkWeek('w1', 'S1')], { mediatorId: 'med_alice' });
    const fresh = mkCycle([mkWeek('w2', 'S2')], { mediatorId: 'med_alice' });
    const cycles = setActiveCycle([old], fresh);
    expect(cycles).toHaveLength(1);
    expect(cycles[0]).toBe(fresh);
  });

  it('leaves other mediators cycles untouched', () => {
    const bob = mkCycle([mkWeek('w1', 'S1')], { mediatorId: 'med_bob' });
    const aliceNew = mkCycle([mkWeek('w2', 'S2')], { mediatorId: 'med_alice' });
    const cycles = setActiveCycle([bob], aliceNew);
    expect(cycles).toHaveLength(2);
    expect(cycles).toContain(bob);
  });
});

// ---- Worked hours for a date -------------------------------------------

describe('getWorkedHoursForDate', () => {
  it('returns the range of the active week for a worked day', () => {
    const cycle = mkCycle([mkWeek('w1', 'S1', { 2: ['09:30', '18:00'] })], { anchor: '2026-W40' });
    const tuesday = parseLocalDate('2026-10-06'); // Tuesday of 2026-W41 → S1
    expect(getWorkedHoursForDate(cycle, tuesday)).toEqual({
      worked: true,
      startTime: '09:30',
      endTime: '18:00',
    });
  });

  it('returns worked:false on a non-worked day', () => {
    const cycle = mkCycle([mkWeek('w1', 'S1', { 1: DEFAULT_RANGE })], { anchor: '2026-W40' });
    const wednesday = parseLocalDate('2026-10-07'); // Wednesday of W41
    expect(getWorkedHoursForDate(cycle, wednesday)).toEqual({ worked: false });
  });

  it('reflects the active (rotated) week, not always weeks[0]', () => {
    const cycle = mkCycle(
      [mkWeek('w1', 'S1', { 2: ['09:30', '18:00'] }), mkWeek('w2', 'S2', { 2: ['10:00', '18:30'] })],
      { anchor: '2026-W40' }
    );
    const tueOfS1 = parseLocalDate('2026-09-29'); // W40 → S1 (anchor)
    const tueOfS2 = parseLocalDate('2026-10-06'); // W41 → S2
    expect(getWorkedHoursForDate(cycle, tueOfS1)).toEqual({ worked: true, startTime: '09:30', endTime: '18:00' });
    expect(getWorkedHoursForDate(cycle, tueOfS2)).toEqual({ worked: true, startTime: '10:00', endTime: '18:30' });
  });

  it('honors a forced week for the displayed date', () => {
    const cycle = mkCycle(
      [mkWeek('w1', 'S1', { 2: ['09:30', '18:00'] }), mkWeek('w2', 'S2', { 2: ['10:00', '18:30'] })],
      { anchor: '2026-W40', forced: { '2026-W41': 'S2' } }
    );
    const tuesday = parseLocalDate('2026-10-06'); // W41 forced to S2
    expect(getWorkedHoursForDate(cycle, tuesday)).toEqual({ worked: true, startTime: '10:00', endTime: '18:30' });
  });

  it('returns worked:false for a 0-week cycle', () => {
    const cycle = mkCycle([]);
    expect(getWorkedHoursForDate(cycle, parseLocalDate('2026-10-06'))).toEqual({ worked: false });
  });
});

// ---- Copy / paste JSON -------------------------------------------------

describe('copyCycleToJSON / pasteCycleFromJSON', () => {
  const aliceCycle = () =>
    mkCycle(
      [
        mkWeek('w1', 'S1', { 1: ['09:30', '18:00'], 2: ['10:00', '18:30'], 6: ['10:00', '17:00'] }),
        mkWeek('w2', 'S2', MON_FRI),
      ],
      { mediatorId: 'med_alice', anchor: '2026-W40', forced: { '2026-W42': 'S2' } }
    );

  it('copies a cycle as valid JSON including week names and per-day ranges', () => {
    const json = copyCycleToJSON(aliceCycle());
    const parsed = JSON.parse(json); // throws if not valid JSON
    expect(Array.isArray(parsed.weeks)).toBe(true);
    expect(parsed.weeks.map((w: { name: string }) => w.name)).toEqual(['S1', 'S2']);
    const s1Days = parsed.weeks[0].days;
    expect(s1Days).toEqual([
      { day: 1, startTime: '09:30', endTime: '18:00' },
      { day: 2, startTime: '10:00', endTime: '18:30' },
      { day: 3 },
      { day: 4 },
      { day: 5 },
      { day: 6, startTime: '10:00', endTime: '17:00' },
      { day: 7 },
    ]);
  });

  it('round-trips a full definition onto another mediator', () => {
    const alice = aliceCycle();
    const result = pasteCycleFromJSON(copyCycleToJSON(alice), 'med_bob', () => 'cyc_bob');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { cycle } = result;
    expect(cycle.id).toBe('cyc_bob');
    expect(cycle.mediatorId).toBe('med_bob');
    expect(cycle.anchorIsoWeek).toBe('2026-W40');
    expect(cycle.forcedWeeks).toEqual({ '2026-W42': 'S2' });
    // Definition identical (week ids are regenerated, content is not)
    expect(cycle.weeks.map((w) => ({ name: w.name, days: w.days }))).toEqual(
      alice.weeks.map((w) => ({ name: w.name, days: w.days }))
    );
    expect(validateCycle(cycle).ok).toBe(true);
  });

  it('pasting onto the same mediator succeeds without error', () => {
    const alice = aliceCycle();
    const result = pasteCycleFromJSON(copyCycleToJSON(alice), 'med_alice', () => 'cyc_new');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cycle.mediatorId).toBe('med_alice');
    expect(result.cycle.weeks.map((w) => w.name)).toEqual(['S1', 'S2']);
  });

  it('rejects corrupt JSON with « JSON invalide »', () => {
    const result = pasteCycleFromJSON('{pas du tout du json', 'med_bob', () => 'c1');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('JSON invalide');
  });

  it('rejects valid JSON missing required fields, listing them', () => {
    const result = pasteCycleFromJSON('{"something": "else"}', 'med_bob', () => 'c1');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('Champs requis manquants');
    expect(result.error).toContain('weeks');
  });

  it('rejects a week entry missing its name', () => {
    const result = pasteCycleFromJSON('{"weeks": [{"days": []}]}', 'med_bob', () => 'c1');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('name');
  });

  it('rejects a pasted 0-week cycle with the exact spec message', () => {
    const result = pasteCycleFromJSON('{"weeks": []}', 'med_bob', () => 'c1');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('Le cycle doit comporter au moins une semaine');
  });

  it('rejects a pasted cycle with an invalid time range', () => {
    const result = pasteCycleFromJSON(
      '{"weeks": [{"name": "S1", "days": [{"day": 1, "startTime": "18:00", "endTime": "09:30"}]}]}',
      'med_bob',
      () => 'c1'
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("L'heure de début doit précéder l'heure de fin");
  });

  it('defaults the anchor to the current ISO week when absent from the JSON', () => {
    const result = pasteCycleFromJSON('{"weeks": [{"name": "S1", "days": []}]}', 'med_bob', () => 'c1');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cycle.anchorIsoWeek).toBe(isoWeekKey(new Date()));
  });
});
