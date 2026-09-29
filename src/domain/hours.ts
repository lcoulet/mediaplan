// hours.ts — Hourly management domain: French public holidays (auto-computed,
// per-year modifiable), museum closure, day valorisation multipliers, worked
// hours per slot (setup and teardown included), quarterly hour quotas and
// the cumulative reliquat/déficit running balance.
// Pure functions only, no browser APIs. Spec: test/features/cycles/
// hourly-management.feature (domain scenarios only).
import type { Mediator, Offer, QuarterlyQuota, Slot, ValorisationConfig } from './types';

// ---- Defaults ------------------------------------------------------------

/** Public holidays count ×2 — fixed, not configurable. */
export const HOLIDAY_MULTIPLIER = 2;

/**
 * Default valorisation: Sundays ×1.5, Saturdays from the 12th Saturday of
 * the year onward ×1.5, no per-year holiday modifications.
 */
export function defaultValorisationConfig(): ValorisationConfig {
  return {
    sundayMultiplier: 1.5,
    valuedSaturdayThreshold: 12,
    valuedSaturdayMultiplier: 1.5,
    holidayOverrides: {},
  };
}

function configOrDefault(config?: ValorisationConfig): ValorisationConfig {
  return config ?? defaultValorisationConfig();
}

/** Round to 1e-6 to keep summed fractional hours free of float noise. */
function roundHours(x: number): number {
  return Math.round(x * 1e6) / 1e6;
}

// ---- French public holidays ----------------------------------------------

/** Easter Sunday (Gregorian, Meeus/Jones/Butcher algorithm) as a local Date. */
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function plusDays(d: Date, days: number): Date {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  copy.setDate(copy.getDate() + days);
  return copy;
}

export interface Holiday {
  date: string;
  name: string;
}

/**
 * Auto-computed French public holidays for a year: fixed-date holidays plus
 * the movable feasts derived from Easter (Lundi de Pâques +1, Ascension +39,
 * Lundi de Pentecôte +50). Returned in chronological order.
 */
export function frenchHolidays(year: number): Holiday[] {
  const easter = easterSunday(year);
  const holidays: Holiday[] = [
    { date: isoDate(new Date(year, 0, 1)), name: "Jour de l'An" },
    { date: isoDate(plusDays(easter, 1)), name: 'Lundi de Pâques' },
    { date: isoDate(new Date(year, 4, 1)), name: '1er Mai' },
    { date: isoDate(new Date(year, 4, 8)), name: '8 Mai' },
    { date: isoDate(plusDays(easter, 39)), name: 'Ascension' },
    { date: isoDate(plusDays(easter, 50)), name: 'Lundi de Pentecôte' },
    { date: isoDate(new Date(year, 6, 14)), name: '14 Juillet' },
    { date: isoDate(new Date(year, 7, 15)), name: '15 Août' },
    { date: isoDate(new Date(year, 10, 1)), name: '1er Novembre' },
    { date: isoDate(new Date(year, 10, 11)), name: '11 Novembre' },
    { date: isoDate(new Date(year, 11, 25)), name: '25 Décembre' },
  ];
  return holidays;
}

/** ISO dates of the effective holiday list of a year (overrides or default). */
function holidayDatesForYear(year: number, config: ValorisationConfig): Set<string> {
  const override = config.holidayOverrides[String(year)];
  if (override) return new Set(override);
  return new Set(frenchHolidays(year).map((h) => h.date));
}

/**
 * Whether a date is a public holiday, against the per-year modifiable list
 * (auto-computed by default; `holidayOverrides` replaces a whole year).
 */
export function isPublicHoliday(date: Date, config?: ValorisationConfig): boolean {
  const dates = holidayDatesForYear(date.getFullYear(), configOrDefault(config));
  return dates.has(isoDate(date));
}

/**
 * Museum closure days: 25/12 (Christmas), 01/01 (Jour de l'An) and 01/05
 * (1er Mai) — whatever the year. No work is possible on these days.
 */
export function isMuseumClosed(date: Date): boolean {
  const mmdd = isoDate(date).slice(5);
  return mmdd === '12-25' || mmdd === '01-01' || mmdd === '05-01';
}

// ---- Valued Saturdays -------------------------------------------------------

/**
 * 1-based index of a Saturday within its calendar year: the first Saturday
 * of the year is 1, the second 2, etc. (Used by the valued-Saturday
 * threshold: Saturdays from the Nth onward are valued.)
 */
export function saturdayIndexInYear(date: Date): number {
  const year = date.getFullYear();
  const jan1 = new Date(year, 0, 1);
  // Days until the first Saturday of the year (Sat = day 6)
  const jan1Dow = (jan1.getDay() + 6) % 7; // Mon=0..Sun=6
  const daysToFirstSaturday = (5 - jan1Dow + 7) % 7;
  const firstSaturday = new Date(year, 0, 1 + daysToFirstSaturday);
  const diff = Math.round((date.getTime() - firstSaturday.getTime()) / 86400000);
  return Math.floor(diff / 7) + 1;
}

// ---- Day multiplier ----------------------------------------------------------

/**
 * Valorisation multiplier of a date — the SINGLE HIGHEST multiplier wins,
 * no stacking: a public holiday counts ×2 (fixed), preempting the Sunday and
 * valued-Saturday multipliers; a Sunday counts sundayMultiplier; a Saturday
 * from the valuedSaturdayThreshold-th Saturday of the year onward counts
 * valuedSaturdayMultiplier; every other day counts ×1.
 */
export function dayMultiplier(date: Date, config?: ValorisationConfig): number {
  const cfg = configOrDefault(config);
  const candidates: number[] = [1];
  if (isPublicHoliday(date, cfg)) candidates.push(HOLIDAY_MULTIPLIER);
  const dow = date.getDay(); // Sun=0, Sat=6
  if (dow === 0) {
    candidates.push(cfg.sundayMultiplier);
  } else if (dow === 6 && saturdayIndexInYear(date) >= cfg.valuedSaturdayThreshold) {
    candidates.push(cfg.valuedSaturdayMultiplier);
  }
  return Math.max(...candidates);
}

// ---- Worked hours per slot (paid time) -----------------------------------------

function timeToMinutes(t: string): number {
  const [h, m] = (t || '0:0').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Total paid time of a slot in hours: booking duration + setup before +
 * teardown after. The slot's own logistics values take precedence; when the
 * slot carries none (legacy data), the offer's values apply.
 */
export function workedHoursForSlot(slot: Slot, offer?: Pick<Offer, 'setupTime' | 'teardownTime'>): number {
  const setup = slot.setupTime ?? offer?.setupTime ?? 0;
  const teardown = slot.teardownTime ?? offer?.teardownTime ?? 0;
  const minutes =
    timeToMinutes(slot.endTime) - timeToMinutes(slot.startTime) + setup + teardown;
  return roundHours(Math.max(0, minutes) / 60);
}

// ---- Calendar quarter ------------------------------------------------------------

/** Calendar quarter of a date: 1 (Jan-Mar) .. 4 (Oct-Dec). */
export function quarterOfDate(date: Date): 1 | 2 | 3 | 4 {
  return (Math.floor(date.getMonth() / 3) + 1) as 1 | 2 | 3 | 4;
}

// ---- Quota validation ---------------------------------------------------------------

export interface QuotaValidation {
  ok: boolean;
  /** French error message, surfaced in the UI. */
  reason?: string;
}

/**
 * Validate a quota configuration. The quarterly hour quota applies ONLY to
 * mediators with a working-time arrangement (aménagement) — the contract
 * type alone does not qualify. Refuses (French messages, surfaced in the UI):
 *  - mediator without arrangement
 *    « Le quota d'heures s'applique uniquement aux médiateurs avec aménagement »
 *  - quarter out of range  « Le trimestre doit être compris entre 1 et 4 »
 *  - negative hours        « Le quota d'heures ne peut pas être négatif »
 *  - missing effective date « La date d'effet du quota est requise »
 */
export function validateQuota(mediator: Mediator, quota: QuarterlyQuota): QuotaValidation {
  if (!mediator.arrangement) {
    return {
      ok: false,
      reason: "Le quota d'heures s'applique uniquement aux médiateurs avec aménagement",
    };
  }
  if (quota.quarter < 1 || quota.quarter > 4) {
    return { ok: false, reason: 'Le trimestre doit être compris entre 1 et 4' };
  }
  if (quota.hours < 0) {
    return { ok: false, reason: "Le quota d'heures ne peut pas être négatif" };
  }
  if (!quota.effectiveFrom) {
    return { ok: false, reason: "La date d'effet du quota est requise" };
  }
  return { ok: true };
}

// ---- Museum-closed assignment refusal --------------------------------------------

export type AssignOnDateResult = { ok: true } | { ok: false; reason: string };

/**
 * Whether a slot may be assigned on a date. REFUSES museum-closed days
 * (25/12, 01/01, 01/05): no work is possible, no hours may be consumed.
 */
export function canAssignSlotOnDate(date: Date): AssignOnDateResult {
  if (isMuseumClosed(date)) {
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    return {
      ok: false,
      reason: `Le musée est fermé le ${dd}/${mm}/${yyyy} — aucun travail n'est possible`,
    };
  }
  return { ok: true };
}

// ---- Quarterly balance --------------------------------------------------------------

export interface QuarterlyBalance {
  /** Configured quota of the quarter (hours). */
  quota: number;
  /** Valued hours worked in the quarter (after the quota's effectiveFrom). */
  trackedHours: number;
  /** Cumulative balance carried over from the previous configured quarters. */
  carriedOver: number;
  /** quota + carriedOver - trackedHours: reliquat (>0) or déficit (<0). */
  balance: number;
}

function trackedHoursForQuarter(
  mediatorId: string,
  slots: Slot[],
  quota: QuarterlyQuota,
  config: ValorisationConfig
): number {
  const startMonth = (quota.quarter - 1) * 3;
  const endMonth = startMonth + 2;
  let total = 0;
  for (const slot of slots) {
    if (!slot.mediatorIds?.includes(mediatorId)) continue;
    if (slot.status === 'cancelled') continue;
    if (!slot.date) continue;
    const date = new Date(`${slot.date}T00:00:00`);
    if (date.getFullYear() !== quota.year) continue;
    if (date.getMonth() < startMonth || date.getMonth() > endMonth) continue;
    // Only slots from the quota's effective date onward count
    if (slot.date < quota.effectiveFrom) continue;
    total += workedHoursForSlot(slot) * dayMultiplier(date, config);
  }
  return roundHours(total);
}

/**
 * Quarterly hour balance of a mediator for a calendar quarter.
 *
 * Returns null when nothing is tracked: no arrangement on the mediator, or
 * no quota configured for that mediator/year/quarter. The quota applies
 * ONLY to mediators with an arrangement (the contract type alone never
 * triggers tracking).
 *
 * Hours are attributed to the quarter of the slot DATE, valued with the
 * day multiplier of that date, and only slots ON OR AFTER the quota's
 * effectiveFrom count (mid-quarter configuration). The running balance is
 * cumulative: each previous CONFIGURED quarter of the year contributes its
 * reliquat/déficit (unconfigured quarters are skipped, not reset).
 */
export function computeQuarterlyBalance(
  mediator: Mediator,
  slots: Slot[],
  quotas: QuarterlyQuota[],
  config: ValorisationConfig | undefined,
  year: number,
  quarter: 1 | 2 | 3 | 4
): QuarterlyBalance | null {
  // The quota applies only to mediators with an arrangement; removing the
  // arrangement stops the tracking entirely.
  if (!mediator.arrangement) return null;
  const cfg = configOrDefault(config);
  const quota = quotas.find(
    (q) => q.mediatorId === mediator.id && q.year === year && q.quarter === quarter
  );
  if (!quota) return null;

  const trackedHours = trackedHoursForQuarter(mediator.id, slots, quota, cfg);

  // Cumulative carry-over: each previous CONFIGURED quarter of the same
  // year contributes its reliquat (positive) or déficit (negative).
  let carriedOver = 0;
  for (const q of quarter > 1 ? ([1, 2, 3, 4] as const).slice(0, quarter - 1) : []) {
    const prev = quotas.find(
      (x) => x.mediatorId === mediator.id && x.year === year && x.quarter === q
    );
    if (!prev) continue; // unconfigured quarter: skipped, not reset
    const prevTracked = trackedHoursForQuarter(mediator.id, slots, prev, cfg);
    carriedOver += prev.hours - prevTracked;
  }
  carriedOver = roundHours(carriedOver);

  return {
    quota: quota.hours,
    trackedHours,
    carriedOver,
    balance: roundHours(quota.hours + carriedOver - trackedHours),
  };
}
