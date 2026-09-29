// cycles.ts — Work cycle domain: default cycle, validation, ISO week
// rotation/anchor/forcing, worked hours per date, and JSON copy/paste.
// Pure functions only, no browser APIs. Spec: test/features/cycles/
// cycle-model.feature. Vocabulary: docs/LEXICON.md ("Work Cycle").
import type { CycleWeek, CycleWeekDay, WorkCycle } from './types';
import { generateId } from './models';

// ---- ISO week helpers ---------------------------------------------------

/**
 * ISO week key ('2026-W41') of a date. Weeks start Monday; week 1 is the
 * week containing the year's first Thursday. The key uses the ISO
 * week-YEAR (e.g. Mon 2025-12-29 belongs to 2026-W01), so week 1 of a
 * year typically starts in late December of the previous calendar year.
 */
export function isoWeekKey(d: Date): string {
  // Thursday of d's week carries the ISO week-year.
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7; // Mon=0..Sun=6
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  const isoYear = date.getUTCFullYear();
  // Week number: days since the Monday of week 1, divided by 7, rounded up.
  const week1Monday = isoWeek1Monday(isoYear);
  const week = Math.round((date.getTime() - week1Monday.getTime()) / (7 * 86400000)) + 1;
  return `${isoYear}-W${String(week).padStart(2, '0')}`;
}

/** Monday of ISO week 1 of the given ISO week-year (UTC). */
function isoWeek1Monday(isoYear: number): Date {
  const jan4 = new Date(Date.UTC(isoYear, 0, 4));
  const dayNum = (jan4.getUTCDay() + 6) % 7;
  return new Date(jan4.getTime() - dayNum * 86400000);
}

function parseIsoWeekKey(key: string): { isoYear: number; week: number } {
  const m = /^(\d{4})-W(\d{2})$/.exec(key);
  if (!m) throw new Error(`Clé de semaine ISO invalide : ${key}`);
  return { isoYear: Number(m[1]), week: Number(m[2]) };
}

function formatIsoWeekKey(isoYear: number, week: number): string {
  return `${isoYear}-W${String(week).padStart(2, '0')}`;
}

/** Number of ISO weeks in an ISO week-year (52, or 53 in long years). */
function isoWeeksInYear(isoYear: number): number {
  // A year has 53 ISO weeks when its Jan 1 (or Dec 31) is a Thursday.
  const jan1 = new Date(Date.UTC(isoYear, 0, 1));
  const dec31 = new Date(Date.UTC(isoYear, 11, 31));
  const jan1Day = (jan1.getUTCDay() + 6) % 7; // Mon=0..Sun=6
  const dec31Day = (dec31.getUTCDay() + 6) % 7;
  return jan1Day === 3 || dec31Day === 3 ? 53 : 52;
}

/**
 * Add a (possibly negative) number of weeks to an ISO week key.
 * Handles year boundaries and 53-week years correctly.
 */
export function addIsoWeeks(key: string, delta: number): string {
  let { isoYear, week } = parseIsoWeekKey(key);
  week += delta;
  while (week < 1) {
    isoYear -= 1;
    week += isoWeeksInYear(isoYear);
  }
  while (week > isoWeeksInYear(isoYear)) {
    week -= isoWeeksInYear(isoYear);
    isoYear += 1;
  }
  return formatIsoWeekKey(isoYear, week);
}

/**
 * Signed difference in ISO weeks from `a` to `b` (b - a), correct across
 * year boundaries and 53-week years: isoWeeksBetween('2026-W40','2026-W43')
 * = 3, isoWeeksBetween('2025-W52','2026-W01') = 1.
 */
export function isoWeeksBetween(a: string, b: string): number {
  const aMon = isoWeek1Monday(parseIsoWeekKey(a).isoYear);
  aMon.setUTCDate(aMon.getUTCDate() + 7 * (parseIsoWeekKey(a).week - 1));
  const bMon = isoWeek1Monday(parseIsoWeekKey(b).isoYear);
  bMon.setUTCDate(bMon.getUTCDate() + 7 * (parseIsoWeekKey(b).week - 1));
  return Math.round((bMon.getTime() - aMon.getTime()) / (7 * 86400000));
}

// ---- Validation ---------------------------------------------------------

export interface CycleValidation {
  ok: boolean;
  /** French error messages, surfaced in the UI. */
  errors: string[];
}

/**
 * Validate a work cycle. Rejects:
 *  - 0 weeks          « Le cycle doit comporter au moins une semaine »
 *  - reversed ranges  « L'heure de début doit précéder l'heure de fin »
 *  - zero-length ranges (same message)
 *  - empty week names, duplicate week names
 */
export function validateCycle(cycle: WorkCycle): CycleValidation {
  const errors: string[] = [];
  if (!cycle.weeks || cycle.weeks.length === 0) {
    errors.push('Le cycle doit comporter au moins une semaine');
    return { ok: false, errors };
  }
  const seenNames = new Set<string>();
  for (const week of cycle.weeks) {
    if (!week.name || !week.name.trim()) {
      errors.push('Chaque semaine de cycle doit avoir un nom');
    } else if (seenNames.has(week.name)) {
      errors.push(`Le nom de semaine « ${week.name} » est dupliqué`);
    }
    seenNames.add(week.name);
    for (const day of week.days || []) {
      if (day.startTime !== undefined && day.endTime !== undefined) {
        if (day.startTime >= day.endTime) {
          errors.push("L'heure de début doit précéder l'heure de fin");
        }
      }
    }
  }
  return { ok: errors.length === 0, errors };
}

// ---- Default cycle -------------------------------------------------------

/**
 * Default work cycle for a new mediator: a single week S1, Monday to Friday
 * 09:30-18:00, weekends off. The rotation is anchored on the current ISO
 * week by default (or the given anchor).
 */
export function createDefaultCycle(mediatorId: string, anchorIsoWeek?: string): WorkCycle {
  const days: CycleWeekDay[] = [];
  for (let d = 1; d <= 7; d++) {
    if (d >= 1 && d <= 5) {
      days.push({ day: d, startTime: '09:30', endTime: '18:00' });
    } else {
      days.push({ day: d });
    }
  }
  return {
    id: generateId('cyc'),
    mediatorId,
    weeks: [{ id: generateId('cweek'), name: 'S1', days }],
    anchorIsoWeek: anchorIsoWeek || isoWeekKey(new Date()),
    forcedWeeks: {},
  };
}

// ---- Rotation, anchor, forcing -------------------------------------------

/**
 * The cycle week active for a date, by ISO week resolution:
 *  1. A forcedWeeks entry for the date's ISO week takes ABSOLUTE
 *     precedence (ignored if its name matches no week).
 *  2. Otherwise the rotation from anchorIsoWeek: index is the signed week
 *     difference mod N; dates before the anchor rotate backwards — the
 *     rotation is unbounded in both directions.
 * Returns undefined for a 0-week cycle.
 */
export function cycleWeekForDate(cycle: WorkCycle, date: Date): CycleWeek | undefined {
  return cycleWeekForIsoWeek(cycle, isoWeekKey(date));
}

/** Same as cycleWeekForDate, resolved from an ISO week key directly. */
export function cycleWeekForIsoWeek(cycle: WorkCycle, weekKey: string): CycleWeek | undefined {
  if (!cycle.weeks || cycle.weeks.length === 0) return undefined;
  const forcedName = cycle.forcedWeeks?.[weekKey];
  if (forcedName) {
    const forced = cycle.weeks.find((w) => w.name === forcedName);
    if (forced) return forced; // absolute precedence
    // Unknown forced name: fall through to the rotation.
  }
  const n = cycle.weeks.length;
  const diff = isoWeeksBetween(cycle.anchorIsoWeek, weekKey);
  // Positive modulo: rotation is unbounded in both directions.
  const index = ((diff % n) + n) % n;
  return cycle.weeks[index];
}

/**
 * Worked hours for a displayed date: the range of the active cycle week
 * for that date, or { worked: false } when the day is not worked (or the
 * cycle has no weeks).
 */
export function getWorkedHoursForDate(
  cycle: WorkCycle,
  date: Date
): { worked: true; startTime: string; endTime: string } | { worked: false } {
  const week = cycleWeekForDate(cycle, date);
  if (!week) return { worked: false };
  const isoDay = ((date.getDay() + 6) % 7) + 1; // Mon=1..Sun=7
  const day = week.days.find((d) => d.day === isoDay);
  if (day && day.startTime !== undefined && day.endTime !== undefined) {
    return { worked: true, startTime: day.startTime, endTime: day.endTime };
  }
  return { worked: false };
}

// ---- One active cycle per mediator ---------------------------------------

/**
 * Set the mediator's active cycle in the list: the new cycle REPLACES the
 * mediator's existing cycle (a mediator has one active cycle at a time).
 * Returns a new array; the input is not mutated.
 */
export function setActiveCycle(cycles: WorkCycle[], cycle: WorkCycle): WorkCycle[] {
  return [...cycles.filter((c) => c.mediatorId !== cycle.mediatorId), cycle];
}

// ---- Copy / paste JSON ----------------------------------------------------

/** Serialize the full cycle definition (weeks, names, per-day ranges). */
export function copyCycleToJSON(cycle: WorkCycle): string {
  return JSON.stringify({
    weeks: cycle.weeks.map((w) => ({ name: w.name, days: w.days })),
    anchorIsoWeek: cycle.anchorIsoWeek,
    forcedWeeks: cycle.forcedWeeks,
  });
}

export type PasteCycleResult = { ok: true; cycle: WorkCycle } | { ok: false; error: string };

/**
 * Parse and validate a pasted cycle JSON for a mediator. The definition
 * (weeks, names, per-day ranges, anchor, forced weeks) is copied; ids are
 * regenerated via cycleIdFor. Errors (French, surfaced in the UI):
 *  - « JSON invalide »
 *  - missing required fields (listed)
 *  - « Le cycle doit comporter au moins une semaine »
 *  - invalid time ranges / names (from validateCycle)
 */
export function pasteCycleFromJSON(
  json: string,
  mediatorId: string,
  cycleIdFor: () => string
): PasteCycleResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, error: 'JSON invalide' };
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, error: 'JSON invalide' };
  }
  const obj = parsed as Record<string, unknown>;
  if (obj.weeks === undefined) {
    return { ok: false, error: 'Champs requis manquants : weeks' };
  }
  if (!Array.isArray(obj.weeks)) {
    return { ok: false, error: 'Champs requis manquants : weeks' };
  }
  const missing = new Set<string>();
  const weeks: CycleWeek[] = (obj.weeks as Record<string, unknown>[]).map((w, i) => {
    if (typeof w !== 'object' || w === null || w.name === undefined) {
      missing.add(`weeks[${i}].name`);
    }
    const days: CycleWeekDay[] = [];
    if (typeof w === 'object' && w !== null && Array.isArray(w.days)) {
      for (const d of w.days as Record<string, unknown>[]) {
        if (typeof d !== 'object' || d === null) continue;
        const day: CycleWeekDay = { day: Number(d.day) };
        if (d.startTime !== undefined) day.startTime = String(d.startTime);
        if (d.endTime !== undefined) day.endTime = String(d.endTime);
        days.push(day);
      }
    }
    return {
      id: generateId('cweek'),
      name: typeof w?.name === 'string' ? w.name : '',
      days,
    };
  });
  if (missing.size > 0) {
    return { ok: false, error: `Champs requis manquants : ${[...missing].join(', ')}` };
  }
  const cycle: WorkCycle = {
    id: cycleIdFor(),
    mediatorId,
    weeks,
    anchorIsoWeek:
      typeof obj.anchorIsoWeek === 'string' ? obj.anchorIsoWeek : isoWeekKey(new Date()),
    forcedWeeks:
      obj.forcedWeeks && typeof obj.forcedWeeks === 'object' && !Array.isArray(obj.forcedWeeks)
        ? (obj.forcedWeeks as Record<string, string>)
        : {},
  };
  const v = validateCycle(cycle);
  if (!v.ok) {
    return { ok: false, error: v.errors[0] };
  }
  return { ok: true, cycle };
}
