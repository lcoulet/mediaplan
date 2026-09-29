// test/cycle-display.test.ts — Daily-view cycle display helpers: lane pills,
// working-hours hatching segments, light assignment warning.
// Spec: test/features/cycles/cycle-model.feature (display + warning scenarios)
// and test/features/cycles/contract-type.feature (pill scenarios).
import { describe, it, expect } from 'vitest';
import { getPillsForMediator, hatchingForDate, slotCycleWarning } from '../src/domain/cycle-display';
import { parseLocalDate } from '../src/domain/models';
import type { CycleWeek, CycleWeekDay, Mediator, WorkCycle } from '../src/domain/types';

// ---- Helpers ------------------------------------------------------------

function mkMediator(over: Partial<Mediator> = {}): Mediator {
  return {
    id: 'med_1',
    lastName: 'Dupont',
    firstName: 'Alice',
    email: '',
    phone: '',
    competences: [],
    active: true,
    color: '#ccc',
    notes: '',
    ...over,
  };
}

function mkWeek(id: string, name: string, worked: Record<number, [string, string]> = {}): CycleWeek {
  const days: CycleWeekDay[] = [];
  for (let d = 1; d <= 7; d++) {
    const range = worked[d];
    days.push(range ? { day: d, startTime: range[0], endTime: range[1] } : { day: d });
  }
  return { id, name, days };
}

function mkCycle(weeks: CycleWeek[], opts: { mediatorId?: string; anchor?: string } = {}): WorkCycle {
  return {
    id: 'cyc_1',
    mediatorId: opts.mediatorId ?? 'med_1',
    weeks,
    anchorIsoWeek: opts.anchor ?? '2026-W40',
    forcedWeeks: {},
  };
}

const MON_FRI: Record<number, [string, string]> = {
  1: ['09:30', '18:00'],
  2: ['09:30', '18:00'],
  3: ['09:30', '18:00'],
  4: ['09:30', '18:00'],
  5: ['09:30', '18:00'],
};

// Tuesday of ISO week 2026-W41 (rotation slot 1 from anchor 2026-W40)
const TUE_W41 = parseLocalDate('2026-10-06');
// Wednesday of ISO week 2026-W41
const WED_W41 = parseLocalDate('2026-10-07');

const AXIS = { start: 8 * 60, end: 19 * 60 }; // daily view 08:00-19:00

// ---- getPillsForMediator --------------------------------------------------

describe('getPillsForMediator', () => {
  it('returns no cycle-week pill for a mediator without an active cycle', () => {
    const m = mkMediator(); // no activeCycleId
    const pills = getPillsForMediator(m, [mkCycle([mkWeek('w1', 'S1', MON_FRI)])], TUE_W41);
    expect(pills.cycleWeek).toBeUndefined();
  });

  it('resolves the active cycle week for the displayed date', () => {
    // Two-week cycle anchored 2026-W40: W41 (2026-10-06) rotates to S2
    const cycle = mkCycle([
      mkWeek('w1', 'S1', MON_FRI),
      mkWeek('w2', 'S2', MON_FRI),
    ]);
    const m = mkMediator({ activeCycleId: 'cyc_1' });
    const pills = getPillsForMediator(m, [cycle], TUE_W41);
    expect(pills.cycleWeek).toBe('S2');
  });

  it('passes contract type and arrangement through when set', () => {
    const m = mkMediator({ contractType: 'temps plein', arrangement: 'mi-temps thérapeutique' });
    const pills = getPillsForMediator(m, [], TUE_W41);
    expect(pills).toEqual({ contractType: 'temps plein', arrangement: 'mi-temps thérapeutique' });
  });

  it('omits contract type and arrangement when undefined', () => {
    const pills = getPillsForMediator(mkMediator(), [], TUE_W41);
    expect(pills.contractType).toBeUndefined();
    expect(pills.arrangement).toBeUndefined();
  });

  it('shows the cycle-week pill alongside the contract pill when both exist', () => {
    const cycle = mkCycle([mkWeek('w1', 'S1', MON_FRI), mkWeek('w2', 'S2', MON_FRI)]);
    const m = mkMediator({ activeCycleId: 'cyc_1', contractType: 'temps plein' });
    const pills = getPillsForMediator(m, [cycle], TUE_W41);
    expect(pills.cycleWeek).toBe('S2');
    expect(pills.contractType).toBe('temps plein');
  });

  it('ignores a cycle whose id does not match activeCycleId', () => {
    const other = mkCycle([mkWeek('w1', 'S1', MON_FRI)], { mediatorId: 'med_2' });
    other.id = 'cyc_other';
    const m = mkMediator({ activeCycleId: 'cyc_missing' });
    expect(getPillsForMediator(m, [other], TUE_W41).cycleWeek).toBeUndefined();
  });
});

// ---- hatchingForDate -------------------------------------------------------

describe('hatchingForDate', () => {
  it('returns none for a mediator without a cycle', () => {
    expect(hatchingForDate(undefined, TUE_W41, AXIS.start, AXIS.end)).toEqual({ kind: 'none' });
  });

  it('hatches outside the worked range on a worked day', () => {
    // Tuesday 09:30-18:00 on the 08:00-19:00 axis:
    // before = [480, 570], after = [1080, 1140]
    const cycle = mkCycle([mkWeek('w1', 'S1', { 2: ['09:30', '18:00'] })]);
    expect(hatchingForDate(cycle, TUE_W41, AXIS.start, AXIS.end)).toEqual({
      kind: 'segments',
      segments: [
        { startMin: 480, endMin: 570 },
        { startMin: 1080, endMin: 1140 },
      ],
    });
  });

  it('returns no segment when the worked range covers the whole axis', () => {
    const cycle = mkCycle([mkWeek('w1', 'S1', { 2: ['08:00', '19:00'] })]);
    expect(hatchingForDate(cycle, TUE_W41, AXIS.start, AXIS.end)).toEqual({
      kind: 'segments',
      segments: [],
    });
  });

  it('clamps segments to the axis when the worked range extends beyond it', () => {
    // Worked 07:30-18:30: before-segment fully clipped (07:30 < axis start),
    // after-segment = [18:30, 19:00]
    const cycle = mkCycle([mkWeek('w1', 'S1', { 2: ['07:30', '18:30'] })]);
    expect(hatchingForDate(cycle, TUE_W41, AXIS.start, AXIS.end)).toEqual({
      kind: 'segments',
      segments: [{ startMin: 1110, endMin: 1140 }],
    });
  });

  it('returns full for a non-worked day', () => {
    // S1 worked Tuesday only; Wednesday is a non-worked day
    const cycle = mkCycle([mkWeek('w1', 'S1', { 2: ['09:30', '18:00'] })]);
    expect(hatchingForDate(cycle, WED_W41, AXIS.start, AXIS.end)).toEqual({ kind: 'full' });
  });

  it('returns full for a 0-week cycle', () => {
    expect(hatchingForDate(mkCycle([]), TUE_W41, AXIS.start, AXIS.end)).toEqual({ kind: 'full' });
  });

  it('respects the rotated week, not always weeks[0]', () => {
    // W41 rotates to S2 (worked 10:00-18:30); W40 anchor week S1 is 09:30-18:00
    const cycle = mkCycle([
      mkWeek('w1', 'S1', { 2: ['09:30', '18:00'] }),
      mkWeek('w2', 'S2', { 2: ['10:00', '18:30'] }),
    ]);
    expect(hatchingForDate(cycle, TUE_W41, AXIS.start, AXIS.end)).toEqual({
      kind: 'segments',
      segments: [
        { startMin: 480, endMin: 600 },
        { startMin: 1110, endMin: 1140 },
      ],
    });
  });
});

// ---- slotCycleWarning ------------------------------------------------------

describe('slotCycleWarning', () => {
  const workedTuesday = () => mkCycle([mkWeek('w1', 'S1', { 2: ['09:30', '18:00'] })]);
  const med = () => mkMediator({ activeCycleId: 'cyc_1' });

  it('returns no warning for a mediator without a cycle', () => {
    expect(slotCycleWarning(mkMediator(), [], TUE_W41, '08:00', '09:00')).toBe('');
  });

  it('returns no warning when the slot is inside the worked range', () => {
    expect(slotCycleWarning(med(), [workedTuesday()], TUE_W41, '10:00', '12:00')).toBe('');
  });

  it('warns when the slot starts before the worked range', () => {
    expect(slotCycleWarning(med(), [workedTuesday()], TUE_W41, '08:00', '09:00')).toBe(
      'Hors plage horaire de travail d’Alice Dupont (09:30-18:00)'
    );
  });

  it('warns when the slot ends after the worked range', () => {
    expect(slotCycleWarning(med(), [workedTuesday()], TUE_W41, '17:00', '19:00')).toBe(
      'Hors plage horaire de travail d’Alice Dupont (09:30-18:00)'
    );
  });

  it('warns when the slot straddles the end of the worked range', () => {
    expect(slotCycleWarning(med(), [workedTuesday()], TUE_W41, '17:30', '18:30')).toBe(
      'Hors plage horaire de travail d’Alice Dupont (09:30-18:00)'
    );
  });

  it('warns on a non-worked day even inside usual hours', () => {
    // S1 works Tuesday only; the slot is on a Wednesday
    expect(slotCycleWarning(med(), [workedTuesday()], WED_W41, '10:00', '12:00')).toBe(
      'Alice Dupont ne travaille pas ce jour-là (cycle)'
    );
  });

  it('returns no warning for a slot on a worked day at the exact range bounds', () => {
    expect(slotCycleWarning(med(), [workedTuesday()], TUE_W41, '09:30', '18:00')).toBe('');
  });
});
