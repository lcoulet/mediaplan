// test/hours.test.ts — Hourly management domain: French public holidays,
// museum closure, day valorisation multipliers, worked hours (setup and
// teardown included), quarterly hour quotas and cumulative running balance.
// Spec: test/features/cycles/hourly-management.feature (domain scenarios only).
import { describe, it, expect } from 'vitest';
import { parseLocalDate, toLocalDateString } from '../src/domain/models';
import type { Mediator, QuarterlyQuota, Slot, ValorisationConfig } from '../src/domain/types';
import {
  HOLIDAY_MULTIPLIER,
  canAssignSlotOnDate,
  computeQuarterlyBalance,
  dayMultiplier,
  defaultValorisationConfig,
  frenchHolidays,
  isMuseumClosed,
  isPublicHoliday,
  quarterOfDate,
  saturdayIndexInYear,
  validateQuota,
  workedHoursForSlot,
} from '../src/domain/hours';

// ---- Test helpers ------------------------------------------------------

const d = parseLocalDate;

function mkMediator(
  opts: { arrangement?: string; contractType?: string; id?: string } = {}
): Mediator {
  return {
    id: opts.id ?? 'med_alice',
    lastName: 'Alice',
    firstName: '',
    email: '',
    phone: '',
    competences: [],
    active: true,
    color: '#fff',
    notes: '',
    ...(opts.arrangement !== undefined ? { arrangement: opts.arrangement } : {}),
    ...(opts.contractType !== undefined ? { contractType: opts.contractType } : {}),
  };
}

function mkSlot(
  date: string,
  startTime: string,
  endTime: string,
  opts: {
    setupTime?: number;
    teardownTime?: number;
    status?: Slot['status'];
    mediatorId?: string;
  } = {}
): Slot {
  const mediatorId = opts.mediatorId ?? 'med_alice';
  return {
    id: `slot_${date}_${startTime}_${mediatorId}`,
    scheduleId: 'sch1',
    offerId: 'off1',
    mediatorIds: [mediatorId],
    date,
    startTime,
    endTime,
    participantCount: 1,
    status: opts.status ?? 'planned',
    notes: '',
    origin: 'manual',
    importSource: '',
    importedAt: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    modifiedAfterImport: false,
    groupName: '',
    guide: '',
    location: '',
    groupNature: '',
    contactName: '',
    contactPhone: '',
    contactEmail: '',
    ...(opts.setupTime !== undefined ? { setupTime: opts.setupTime } : {}),
    ...(opts.teardownTime !== undefined ? { teardownTime: opts.teardownTime } : {}),
  };
}

function mkQuota(
  opts: {
    mediatorId?: string;
    year?: number;
    quarter?: 1 | 2 | 3 | 4;
    hours?: number;
    effectiveFrom?: string;
  } = {}
): QuarterlyQuota {
  const year = opts.year ?? 2026;
  const quarter = opts.quarter ?? 1;
  const mediatorId = opts.mediatorId ?? 'med_alice';
  return {
    id: `quota_${mediatorId}_${year}_T${quarter}`,
    mediatorId,
    year,
    quarter,
    hours: opts.hours ?? 120,
    effectiveFrom: opts.effectiveFrom ?? `${year}-01-01`,
  };
}

/** Config with defaults + overrides. */
function mkConfig(overrides: Partial<ValorisationConfig> = {}): ValorisationConfig {
  return { ...defaultValorisationConfig(), ...overrides };
}

/** ISO dates of the auto-computed French holidays (test years). */
const HOLIDAY_DATES = new Set<string>([
  ...[2025, 2026, 2027, 2028].flatMap((y) => frenchHolidays(y).map((h) => h.date)),
]);

function timePlus(start: string, hours: number): string {
  const [h, m] = start.split(':').map(Number);
  const total = h * 60 + m + Math.round(hours * 60);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * Build plain weekday slots (no valorisation: weekdays, no holidays)
 * summing exactly totalHours, starting at firstIso.
 */
function manySlots(totalHours: number, firstIso: string, mediatorId = 'med_alice'): Slot[] {
  const slots: Slot[] = [];
  let remaining = totalHours;
  const cur = parseLocalDate(firstIso);
  while (remaining > 0) {
    const iso = toLocalDateString(cur);
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6 && !HOLIDAY_DATES.has(iso)) {
      const h = Math.min(8, remaining);
      slots.push(mkSlot(iso, '10:00', h === 8 ? '18:00' : timePlus('10:00', h), { mediatorId }));
      remaining -= h;
    }
    cur.setDate(cur.getDate() + 1);
  }
  return slots;
}

// ---- French public holidays --------------------------------------------

describe('frenchHolidays', () => {
  it('computes the full 2026 list, movable feasts included (Pâques 06/04, Ascension 14/05, Pentecôte 25/05)', () => {
    expect(frenchHolidays(2026)).toEqual([
      { date: '2026-01-01', name: "Jour de l'An" },
      { date: '2026-04-06', name: 'Lundi de Pâques' },
      { date: '2026-05-01', name: '1er Mai' },
      { date: '2026-05-08', name: '8 Mai' },
      { date: '2026-05-14', name: 'Ascension' },
      { date: '2026-05-25', name: 'Lundi de Pentecôte' },
      { date: '2026-07-14', name: '14 Juillet' },
      { date: '2026-08-15', name: '15 Août' },
      { date: '2026-11-01', name: '1er Novembre' },
      { date: '2026-11-11', name: '11 Novembre' },
      { date: '2026-12-25', name: '25 Décembre' },
    ]);
  });

  it('computes the movable feasts correctly for 2024', () => {
    const h = frenchHolidays(2024);
    expect(h.find((x) => x.name === 'Lundi de Pâques')?.date).toBe('2024-04-01');
    expect(h.find((x) => x.name === 'Ascension')?.date).toBe('2024-05-09');
    expect(h.find((x) => x.name === 'Lundi de Pentecôte')?.date).toBe('2024-05-20');
  });

  it('computes the movable feasts correctly for 2025', () => {
    const h = frenchHolidays(2025);
    expect(h.find((x) => x.name === 'Lundi de Pâques')?.date).toBe('2025-04-21');
    expect(h.find((x) => x.name === 'Ascension')?.date).toBe('2025-05-29');
    expect(h.find((x) => x.name === 'Lundi de Pentecôte')?.date).toBe('2025-06-09');
  });
});

// ---- Museum closure ------------------------------------------------------

describe('isMuseumClosed', () => {
  it('closes the museum on 25/12, 01/01 and 01/05, whatever the year', () => {
    expect(isMuseumClosed(d('2026-01-01'))).toBe(true);
    expect(isMuseumClosed(d('2026-05-01'))).toBe(true);
    expect(isMuseumClosed(d('2026-12-25'))).toBe(true);
    expect(isMuseumClosed(d('2027-01-01'))).toBe(true);
    expect(isMuseumClosed(d('2027-12-25'))).toBe(true);
  });

  it('keeps the museum open on other days, including other holidays', () => {
    expect(isMuseumClosed(d('2026-05-08'))).toBe(false); // 8 Mai: open
    expect(isMuseumClosed(d('2026-05-26'))).toBe(false);
    expect(isMuseumClosed(d('2026-01-06'))).toBe(false);
  });
});

// ---- Public holiday list (per-year, modifiable) ---------------------------

describe('isPublicHoliday', () => {
  it('matches the auto-computed French list by default', () => {
    expect(isPublicHoliday(d('2026-05-08'))).toBe(true);
    expect(isPublicHoliday(d('2026-05-26'))).toBe(false);
    expect(isPublicHoliday(d('2026-04-06'))).toBe(true);
  });

  it('honors a per-year override that removes a holiday', () => {
    const without8Mai = frenchHolidays(2026)
      .map((h) => h.date)
      .filter((iso) => iso !== '2026-05-08');
    const cfg = mkConfig({ holidayOverrides: { '2026': without8Mai } });
    expect(isPublicHoliday(d('2026-05-08'), cfg)).toBe(false);
    expect(isPublicHoliday(d('2026-05-01'), cfg)).toBe(true);
  });

  it('honors a per-year override that adds a holiday, without touching other years', () => {
    const withExtra = [...frenchHolidays(2026).map((h) => h.date), '2026-05-26'];
    const cfg = mkConfig({ holidayOverrides: { '2026': withExtra } });
    expect(isPublicHoliday(d('2026-05-26'), cfg)).toBe(true);
    // 2027 is not overridden: it keeps the default list
    expect(isPublicHoliday(d('2027-05-08'), cfg)).toBe(true);
  });
});

// ---- Valued Saturdays -----------------------------------------------------

describe('saturdayIndexInYear', () => {
  it('numbers Saturdays 1-based within their calendar year', () => {
    expect(saturdayIndexInYear(d('2026-01-03'))).toBe(1); // first Saturday of 2026
    expect(saturdayIndexInYear(d('2026-01-31'))).toBe(5);
    expect(saturdayIndexInYear(d('2026-03-21'))).toBe(12);
    expect(saturdayIndexInYear(d('2026-03-28'))).toBe(13);
  });
});

// ---- Day multiplier --------------------------------------------------------

describe('dayMultiplier', () => {
  it('is ×1 on a normal weekday', () => {
    expect(dayMultiplier(d('2026-01-06'))).toBe(1); // Tuesday
  });

  it('applies the configurable Sunday multiplier (default 1.5)', () => {
    expect(dayMultiplier(d('2026-02-08'))).toBe(1.5); // Sunday
    expect(dayMultiplier(d('2026-02-08'), mkConfig({ sundayMultiplier: 2 }))).toBe(2);
  });

  it('values Saturdays from the Nth Saturday of the year onward, INCLUSIVE (default N=12, ×1.5)', () => {
    expect(dayMultiplier(d('2026-03-28'))).toBe(1.5); // 13th Saturday: valued
    expect(dayMultiplier(d('2026-03-21'))).toBe(1.5); // 12th Saturday: first valued
    expect(dayMultiplier(d('2026-03-14'))).toBe(1); // 11th Saturday: not yet
  });

  it('counts earlier Saturdays normally when the threshold is lowered', () => {
    const cfg = mkConfig({ valuedSaturdayThreshold: 5 });
    expect(dayMultiplier(d('2026-01-31'), cfg)).toBe(1.5); // 5th Saturday
    expect(dayMultiplier(d('2026-01-24'), cfg)).toBe(1); // 4th Saturday
  });

  it('applies the configurable valued-Saturday multiplier', () => {
    const cfg = mkConfig({ valuedSaturdayMultiplier: 2 });
    expect(dayMultiplier(d('2026-03-28'), cfg)).toBe(2);
  });

  it('counts a public holiday ×2 (fixed), preempting the Friday/Saturday valorisation', () => {
    expect(HOLIDAY_MULTIPLIER).toBe(2);
    expect(dayMultiplier(d('2026-05-08'))).toBe(2); // 8 Mai, a Friday
    // 15 Août 2026 falls on a Saturday: ×2 only, no stacking with the
    // valued-Saturday multiplier
    expect(dayMultiplier(d('2026-08-15'))).toBe(2);
  });

  it('lets the single highest multiplier win when a férié falls on a Sunday', () => {
    // 1er Novembre 2026 is a Sunday
    expect(dayMultiplier(d('2026-11-01'))).toBe(2); // 2 > 1.5
    expect(dayMultiplier(d('2026-11-01'), mkConfig({ sundayMultiplier: 3 }))).toBe(3); // 3 > 2
  });
});

// ---- Worked hours per slot (paid time) --------------------------------------

describe('workedHoursForSlot', () => {
  it('includes setup before and teardown after (paid time)', () => {
    const slot = mkSlot('2026-01-06', '10:00', '18:00', { setupTime: 30, teardownTime: 30 });
    expect(workedHoursForSlot(slot)).toBe(9);
  });

  it('counts the booking duration alone when there is no logistics', () => {
    expect(workedHoursForSlot(mkSlot('2026-01-06', '10:00', '13:00'))).toBe(3);
  });

  it('falls back to the offer\'s setup/teardown when the slot carries none', () => {
    const slot = mkSlot('2026-01-06', '10:00', '13:00');
    const offer = { setupTime: 15, teardownTime: 15 } as Parameters<typeof workedHoursForSlot>[1];
    expect(workedHoursForSlot(slot, offer)).toBe(3.5);
  });

  it('supports fractional totals', () => {
    expect(workedHoursForSlot(mkSlot('2026-01-06', '10:00', '13:00', { setupTime: 45 }))).toBe(3.75);
  });
});

// ---- Calendar quarter --------------------------------------------------------

describe('quarterOfDate', () => {
  it('returns the calendar quarter of a date (T1..T4)', () => {
    expect(quarterOfDate(d('2026-01-01'))).toBe(1);
    expect(quarterOfDate(d('2026-03-31'))).toBe(1);
    expect(quarterOfDate(d('2026-04-01'))).toBe(2);
    expect(quarterOfDate(d('2026-06-30'))).toBe(2);
    expect(quarterOfDate(d('2026-07-01'))).toBe(3);
    expect(quarterOfDate(d('2026-09-30'))).toBe(3);
    expect(quarterOfDate(d('2026-10-01'))).toBe(4);
    expect(quarterOfDate(d('2026-12-31'))).toBe(4);
  });
});

// ---- Quota validation ----------------------------------------------------------

describe('validateQuota', () => {
  it('refuses a quota on a mediator without arrangement, with the exact spec message', () => {
    const mediator = mkMediator({ contractType: 'temps plein' });
    const v = validateQuota(mediator, mkQuota());
    expect(v.ok).toBe(false);
    expect(v.reason).toBe(
      "Le quota d'heures s'applique uniquement aux médiateurs avec aménagement"
    );
  });

  it('accepts a quota on a mediator with an arrangement (contract type irrelevant)', () => {
    expect(validateQuota(mkMediator({ arrangement: 'temps partiel' }), mkQuota()).ok).toBe(true);
    expect(
      validateQuota(
        mkMediator({ arrangement: 'mi-temps thérapeutique', contractType: 'temps plein' }),
        mkQuota()
      ).ok
    ).toBe(true);
  });

  it('refuses an out-of-range quarter', () => {
    const quota = { ...mkQuota(), quarter: 5 as 1 } satisfies QuarterlyQuota;
    const v = validateQuota(mkMediator({ arrangement: 'temps partiel' }), quota);
    expect(v.ok).toBe(false);
    expect(v.reason).toBe('Le trimestre doit être compris entre 1 et 4');
  });

  it('refuses negative hours', () => {
    const quota = mkQuota({ hours: -5 });
    const v = validateQuota(mkMediator({ arrangement: 'temps partiel' }), quota);
    expect(v.ok).toBe(false);
    expect(v.reason).toBe("Le quota d'heures ne peut pas être négatif");
  });

  it('refuses a missing effective date', () => {
    const quota = mkQuota({ effectiveFrom: '' });
    const v = validateQuota(mkMediator({ arrangement: 'temps partiel' }), quota);
    expect(v.ok).toBe(false);
    expect(v.reason).toBe("La date d'effet du quota est requise");
  });
});

// ---- Museum-closed assignment refusal ---------------------------------------------

describe('canAssignSlotOnDate', () => {
  it('refuses assignment on a museum-closed day with the exact spec warning', () => {
    const result = canAssignSlotOnDate(d('2026-12-25'));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(
      'Le musée est fermé le 25/12/2026 — aucun travail n\'est possible'
    );
  });

  it('refuses assignment on 01/05 and 01/01 (museum closure days)', () => {
    expect(canAssignSlotOnDate(d('2026-05-01')).ok).toBe(false);
    expect(canAssignSlotOnDate(d('2027-01-01')).ok).toBe(false);
  });

  it('allows assignment on normal days and open holidays', () => {
    expect(canAssignSlotOnDate(d('2026-01-06'))).toEqual({ ok: true });
    expect(canAssignSlotOnDate(d('2026-05-08'))).toEqual({ ok: true }); // 8 Mai: open
  });
});

// ---- Quarterly balance -----------------------------------------------------------

describe('computeQuarterlyBalance — who is tracked', () => {
  const slot = mkSlot('2026-01-06', '10:00', '18:00');
  const quota = mkQuota({ hours: 120 });
  const cfg = mkConfig();

  // Decision 2026-10-04: a CONFIGURED quota is enough to track a mediator —
  // neither an arrangement nor a contract type is required. This reverses
  // the original arrangement-only trigger (tracked in OPEN-QUESTIONS).
  it('tracks a mediator with a configured quota, without arrangement or contract type', () => {
    expect(computeQuarterlyBalance(mkMediator(), [slot], [quota], cfg, 2026, 1)).not.toBeNull();
  });

  it('tracks on contract type alone when a quota is configured', () => {
    const contractOnly = mkMediator({ contractType: 'mi-temps' });
    expect(computeQuarterlyBalance(contractOnly, [slot], [quota], cfg, 2026, 1)).not.toBeNull();
  });

  it('tracks nothing when the quarter has no configured quota', () => {
    const alice = mkMediator({ arrangement: 'temps partiel' });
    expect(computeQuarterlyBalance(alice, [slot], [], cfg, 2026, 1)).toBeNull();
    expect(
      computeQuarterlyBalance(alice, [slot], [mkQuota({ quarter: 2 })], cfg, 2026, 1)
    ).toBeNull();
  });

  it('computes a balance for a mediator with arrangement and configured quota', () => {
    const aliceArrangement = mkMediator({ arrangement: 'temps partiel' });
    expect(computeQuarterlyBalance(aliceArrangement, [slot], [quota], cfg, 2026, 1)).toEqual({
      quota: 120,
      trackedHours: 8,
      carriedOver: 0,
      balance: 112,
    });
  });

  it('ignores another mediator\'s quota and slots', () => {
    const aliceArrangement = mkMediator({ arrangement: 'temps partiel' });
    const quotas = [mkQuota({ mediatorId: 'med_bob', hours: 50 })];
    const slots = [mkSlot('2026-01-06', '10:00', '18:00', { mediatorId: 'med_bob' })];
    expect(computeQuarterlyBalance(aliceArrangement, slots, quotas, cfg, 2026, 1)).toBeNull();
  });

  it('does not count cancelled slots', () => {
    const aliceArrangement = mkMediator({ arrangement: 'temps partiel' });
    const slots = [
      mkSlot('2026-01-06', '10:00', '18:00'),
      mkSlot('2026-01-07', '10:00', '18:00', { status: 'cancelled' }),
    ];
    const result = computeQuarterlyBalance(aliceArrangement, slots, [quota], cfg, 2026, 1);
    expect(result?.trackedHours).toBe(8);
  });
});

describe('computeQuarterlyBalance — per-quarter quota configuration', () => {
  it('returns each quarter\'s own configured quota (hours may be fractional)', () => {
    const mediator = mkMediator({ arrangement: 'temps partiel' });
    const quotas = [
      mkQuota({ quarter: 1, hours: 120 }),
      mkQuota({ quarter: 2, hours: 100 }),
      mkQuota({ quarter: 3, hours: 100 }),
      mkQuota({ quarter: 4, hours: 100 }),
    ];
    const cfg = mkConfig();
    expect(computeQuarterlyBalance(mediator, [], quotas, cfg, 2026, 1)?.quota).toBe(120);
    expect(computeQuarterlyBalance(mediator, [], quotas, cfg, 2026, 2)?.quota).toBe(100);
    expect(computeQuarterlyBalance(mediator, [], quotas, cfg, 2026, 4)?.quota).toBe(100);

    const fractional = [mkQuota({ hours: 120.5 })];
    const slot = mkSlot('2026-01-06', '10:00', '18:00');
    expect(computeQuarterlyBalance(mediator, [slot], fractional, cfg, 2026, 1)).toEqual({
      quota: 120.5,
      trackedHours: 8,
      carriedOver: 0,
      balance: 112.5,
    });
  });
});

describe('computeQuarterlyBalance — attribution by slot-date quarter', () => {
  it('attributes hours to the quarter of the slot DATE (31/03 → T1, 01/04 → T2)', () => {
    const mediator = mkMediator({ arrangement: 'temps partiel' });
    const quotas = [mkQuota({ quarter: 1, hours: 120 }), mkQuota({ quarter: 2, hours: 100 })];
    const slots = [
      mkSlot('2026-03-31', '10:00', '18:00'),
      mkSlot('2026-04-01', '10:00', '13:00'),
    ];
    const cfg = mkConfig();
    expect(computeQuarterlyBalance(mediator, slots, quotas, cfg, 2026, 1)).toEqual({
      quota: 120,
      trackedHours: 8,
      carriedOver: 0,
      balance: 112,
    });
    expect(computeQuarterlyBalance(mediator, slots, quotas, cfg, 2026, 2)).toEqual({
      quota: 100,
      trackedHours: 3,
      carriedOver: 112,
      balance: 209,
    });
  });
});

describe('computeQuarterlyBalance — paid time and day valorisation', () => {
  const mediator = mkMediator({ arrangement: 'temps partiel' });
  const cfg = mkConfig();

  it('counts slot time INCLUDING setup/teardown (9h for 8h + 30min + 30min)', () => {
    const slots = [mkSlot('2026-01-06', '10:00', '18:00', { setupTime: 30, teardownTime: 30 })];
    const result = computeQuarterlyBalance(mediator, slots, [mkQuota()], cfg, 2026, 1);
    expect(result?.trackedHours).toBe(9);
  });

  it('counts a férié slot double (8h × 2 = 16 on 08/05/2026, T2)', () => {
    const slots = [mkSlot('2026-05-08', '10:00', '18:00')];
    const result = computeQuarterlyBalance(mediator, slots, [mkQuota({ quarter: 2, hours: 100 })], cfg, 2026, 2);
    expect(result?.trackedHours).toBe(16);
  });

  it('applies the Sunday multiplier (4h × 1.5 = 6 on 08/02/2026, T1)', () => {
    const slots = [mkSlot('2026-02-08', '10:00', '14:00')];
    const result = computeQuarterlyBalance(mediator, slots, [mkQuota()], cfg, 2026, 1);
    expect(result?.trackedHours).toBe(6);
  });

  it('recalculates when the Sunday multiplier changes (4h × 2 = 8)', () => {
    const slots = [mkSlot('2026-02-08', '10:00', '14:00')];
    const result = computeQuarterlyBalance(
      mediator,
      slots,
      [mkQuota()],
      mkConfig({ sundayMultiplier: 2 }),
      2026,
      1
    );
    expect(result?.trackedHours).toBe(8);
  });

  it('values the 13th Saturday (8h × 1.5 = 12 on 28/03/2026) but not the 5th (31/01/2026)', () => {
    const valued = [mkSlot('2026-03-28', '10:00', '18:00')];
    expect(computeQuarterlyBalance(mediator, valued, [mkQuota()], cfg, 2026, 1)?.trackedHours).toBe(12);
    const early = [mkSlot('2026-01-31', '10:00', '18:00')];
    expect(computeQuarterlyBalance(mediator, early, [mkQuota()], cfg, 2026, 1)?.trackedHours).toBe(8);
  });

  it('counts a férié Saturday ×2 only, no stacking (15/08/2026, T3)', () => {
    const slots = [mkSlot('2026-08-15', '10:00', '18:00')];
    const result = computeQuarterlyBalance(mediator, slots, [mkQuota({ quarter: 3, hours: 100 })], cfg, 2026, 3);
    expect(result?.trackedHours).toBe(16);
  });

  it('recounts a removed holiday normally and an added holiday double', () => {
    const without8Mai = frenchHolidays(2026).map((h) => h.date).filter((iso) => iso !== '2026-05-08');
    const removed = mkConfig({ holidayOverrides: { '2026': without8Mai } });
    const slots = [mkSlot('2026-05-08', '10:00', '18:00')];
    const quotas = [mkQuota({ quarter: 2, hours: 100 })];
    expect(computeQuarterlyBalance(mediator, slots, quotas, removed, 2026, 2)?.trackedHours).toBe(8);

    const withExtra = { '2026': [...frenchHolidays(2026).map((h) => h.date), '2026-05-26'] };
    const added = mkConfig({ holidayOverrides: withExtra });
    const extraSlots = [mkSlot('2026-05-26', '10:00', '18:00')];
    expect(computeQuarterlyBalance(mediator, extraSlots, quotas, added, 2026, 2)?.trackedHours).toBe(16);
  });
});

describe('computeQuarterlyBalance — effectiveFrom', () => {
  const mediator = mkMediator({ arrangement: 'temps partiel' });

  it('does not count slots before the arrangement was configured mid-quarter', () => {
    // Aménagement + quota configured on 15/02/2026: the 10/02 slot predates it
    const quotas = [mkQuota({ hours: 120, effectiveFrom: '2026-02-15' })];
    const slots = [mkSlot('2026-02-10', '10:00', '18:00')];
    const result = computeQuarterlyBalance(mediator, slots, quotas, mkConfig(), 2026, 1);
    expect(result?.trackedHours).toBe(0);
    expect(result?.balance).toBe(120);
  });

  it('counts slots from the effective date onward (inclusive), not before', () => {
    const quotas = [mkQuota({ hours: 120, effectiveFrom: '2026-02-16' })];
    const slots = [
      mkSlot('2026-02-10', '10:00', '18:00'), // before: excluded
      mkSlot('2026-02-16', '10:00', '18:00'), // on the effective date: included
      mkSlot('2026-02-17', '10:00', '18:00'), // after: included
    ];
    const result = computeQuarterlyBalance(mediator, slots, quotas, mkConfig(), 2026, 1);
    expect(result?.trackedHours).toBe(16);
  });

  it('keeps tracking a configured quota after the arrangement is removed (decision 2026-10-04)', () => {
    const slots = [
      ...manySlots(50, '2026-01-02'),
      mkSlot('2026-02-20', '10:00', '18:00'), // after removal on 15/02
    ];
    const quotas = [mkQuota({ hours: 120 })];
    // The mediator state after removal: no arrangement — but the quota is
    // still configured, and a configured quota alone drives the tracking.
    const removed = mkMediator();
    expect(computeQuarterlyBalance(removed, slots, quotas, mkConfig(), 2026, 1)).not.toBeNull();
    // Stopping the tracking = removing the quota configuration itself.
    expect(computeQuarterlyBalance(removed, slots, [], mkConfig(), 2026, 1)).toBeNull();
  });
});

describe('computeQuarterlyBalance — adjusting a quota mid-quarter', () => {
  it('keeps the consumed hours and recalculates the balance against the new quota', () => {
    const mediator = mkMediator({ arrangement: 'temps partiel' });
    const slots = [mkSlot('2026-01-06', '10:00', '18:00')];
    const cfg = mkConfig();
    const before = computeQuarterlyBalance(mediator, slots, [mkQuota({ hours: 120 })], cfg, 2026, 1);
    expect(before).toEqual({ quota: 120, trackedHours: 8, carriedOver: 0, balance: 112 });
    const after = computeQuarterlyBalance(mediator, slots, [mkQuota({ hours: 90 })], cfg, 2026, 1);
    expect(after).toEqual({ quota: 90, trackedHours: 8, carriedOver: 0, balance: 82 });
  });
});

describe('computeQuarterlyBalance — reliquat/déficit carry-over (cumulative)', () => {
  const mediator = mkMediator({ arrangement: 'temps partiel' });
  const cfg = mkConfig();

  it('carries a T1 reliquat into T2 (quota effectif 120)', () => {
    const quotas = [mkQuota({ hours: 120 }), mkQuota({ quarter: 2, hours: 100 })];
    const slots = manySlots(100, '2026-01-02');
    const t1 = computeQuarterlyBalance(mediator, slots, quotas, cfg, 2026, 1);
    expect(t1).toEqual({ quota: 120, trackedHours: 100, carriedOver: 0, balance: 20 });
    const t2 = computeQuarterlyBalance(mediator, slots, quotas, cfg, 2026, 2);
    expect(t2).toEqual({ quota: 100, trackedHours: 0, carriedOver: 20, balance: 120 });
  });

  it('carries a T1 déficit into T2 (quota effectif 90)', () => {
    const quotas = [mkQuota({ hours: 120 }), mkQuota({ quarter: 2, hours: 100 })];
    const slots = manySlots(130, '2026-01-02');
    const t1 = computeQuarterlyBalance(mediator, slots, quotas, cfg, 2026, 1);
    expect(t1).toEqual({ quota: 120, trackedHours: 130, carriedOver: 0, balance: -10 });
    const t2 = computeQuarterlyBalance(mediator, slots, quotas, cfg, 2026, 2);
    expect(t2).toEqual({ quota: 100, trackedHours: 0, carriedOver: -10, balance: 90 });
  });

  it('accumulates the running balance over several quarters (T1 +20, T2 −15 → T3 quota effectif 105)', () => {
    const quotas = [
      mkQuota({ hours: 120 }),
      mkQuota({ quarter: 2, hours: 100 }),
      mkQuota({ quarter: 3, hours: 100 }),
    ];
    const slots = [...manySlots(100, '2026-01-02'), ...manySlots(115, '2026-04-02')];
    const t2 = computeQuarterlyBalance(mediator, slots, quotas, cfg, 2026, 2);
    expect(t2).toEqual({ quota: 100, trackedHours: 115, carriedOver: 20, balance: 5 });
    const t3 = computeQuarterlyBalance(mediator, slots, quotas, cfg, 2026, 3);
    expect(t3).toEqual({ quota: 100, trackedHours: 0, carriedOver: 5, balance: 105 });
  });

  it('skips unconfigured quarters in the carry (they track nothing)', () => {
    // T2 has no quota: the T1 reliquat flows straight into T3
    const quotas = [mkQuota({ hours: 120 }), mkQuota({ quarter: 3, hours: 100 })];
    const slots = manySlots(100, '2026-01-02');
    const t3 = computeQuarterlyBalance(mediator, slots, quotas, cfg, 2026, 3);
    expect(t3).toEqual({ quota: 100, trackedHours: 0, carriedOver: 20, balance: 120 });
  });
});
