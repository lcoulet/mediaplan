// cycle-edit.ts — Pure editing helpers for the cycle-chain modal
// (CycleChainModal.tsx) and the quarterly-quota counter on the mediator
// form. All state transforms are pure: they return a NEW cycle and never
// mutate the input (undo/redo history relies on immutable snapshots).
// Spec: test/features/cycles/cycle-model.feature (modal scenarios) and
// hourly-management.feature (quota display scenarios).

import { generateId } from './models';
import type { CycleWeek, CycleWeekDay, Mediator, WorkCycle } from './types';
import type { QuarterlyBalance } from './hours';

// ---- Week list editing ---------------------------------------------------

/** Copy the cycle with its weeks replaced by `map(weeks)`. */
function withWeeks(cycle: WorkCycle, map: (weeks: CycleWeek[]) => CycleWeek[]): WorkCycle {
  return { ...cycle, weeks: map(cycle.weeks.map((w) => ({ ...w }))) };
}

function fullDays(): CycleWeekDay[] {
  return Array.from({ length: 7 }, (_, i) => ({ day: i + 1 }));
}

/** Next free auto-name for a new week: S{n+1} where n = weeks.length. */
function nextWeekName(weeks: CycleWeek[]): string {
  let n = weeks.length + 1;
  const taken = new Set(weeks.map((w) => w.name));
  while (taken.has(`S${n}`)) n++;
  return `S${n}`;
}

/**
 * Append a new cycle week at the end of the rotation, auto-named S{n+1}
 * (or the next free S-number), all days non-worked. Extends the rotation.
 */
export function addCycleWeek(cycle: WorkCycle): WorkCycle {
  return withWeeks(cycle, (weeks) => [
    ...weeks,
    { id: generateId('cweek'), name: nextWeekName(cycle.weeks), days: fullDays() },
  ]);
}

/**
 * Remove the week with the given id. REFUSES to remove the last remaining
 * week (a cycle must have at least one week — spec decision 2): returns the
 * input cycle unchanged. Forced entries pointing at the removed week's name
 * are dropped (they would otherwise reference a non-existent week).
 */
export function removeCycleWeek(cycle: WorkCycle, weekId: string): WorkCycle {
  if (cycle.weeks.length <= 1) return cycle;
  const removed = cycle.weeks.find((w) => w.id === weekId);
  if (!removed) return cycle;
  const forcedWeeks = { ...cycle.forcedWeeks };
  for (const [key, name] of Object.entries(forcedWeeks)) {
    if (name === removed.name) delete forcedWeeks[key];
  }
  return {
    ...cycle,
    weeks: cycle.weeks.filter((w) => w.id !== weekId).map((w) => ({ ...w })),
    forcedWeeks,
  };
}

/**
 * Rename the week with the given id (trimmed). Forced entries pointing at
 * the old name follow the rename, so the forcing keeps its meaning.
 */
export function renameCycleWeek(cycle: WorkCycle, weekId: string, name: string): WorkCycle {
  const week = cycle.weeks.find((w) => w.id === weekId);
  if (!week) return cycle;
  const newName = name.trim();
  const forcedWeeks = { ...cycle.forcedWeeks };
  for (const [key, forcedName] of Object.entries(forcedWeeks)) {
    if (forcedName === week.name) forcedWeeks[key] = newName;
  }
  return {
    ...cycle,
    weeks: cycle.weeks.map((w) => (w.id === weekId ? { ...w, name: newName } : { ...w })),
    forcedWeeks,
  };
}

/**
 * Move the week with the given id by `delta` positions (-1 up, +1 down) in
 * the rotation order. No-op at the list boundaries.
 */
export function moveCycleWeek(cycle: WorkCycle, weekId: string, delta: number): WorkCycle {
  const index = cycle.weeks.findIndex((w) => w.id === weekId);
  if (index < 0) return cycle;
  const target = index + delta;
  if (target < 0 || target >= cycle.weeks.length) return cycle;
  const weeks = cycle.weeks.map((w) => ({ ...w }));
  const [moved] = weeks.splice(index, 1);
  weeks.splice(target, 0, moved);
  return { ...cycle, weeks };
}

// ---- Per-day editing --------------------------------------------------------

function mapWeekDays(cycle: WorkCycle, weekId: string, map: (days: CycleWeekDay[]) => CycleWeekDay[]): WorkCycle {
  return {
    ...cycle,
    weeks: cycle.weeks.map((w) =>
      w.id === weekId ? { ...w, days: map(w.days.map((d) => ({ ...d }))) } : { ...w }
    ),
  };
}

/**
 * Set whether a day of a week is worked. Checking a non-worked day gives it
 * the default 09:30-18:00 range; unchecking removes its range entirely
 * (spec: a non-worked day has NO range).
 */
export function setDayWorked(cycle: WorkCycle, weekId: string, day: number, worked: boolean): WorkCycle {
  return mapWeekDays(cycle, weekId, (days) =>
    days.map((d) =>
      d.day === day
        ? worked
          ? { day, startTime: d.startTime ?? '09:30', endTime: d.endTime ?? '18:00' }
          : { day }
        : d
    )
  );
}

/**
 * Set the start and/or end time of a day range. Passing undefined for one
 * bound keeps the existing value.
 */
export function setDayRange(
  cycle: WorkCycle,
  weekId: string,
  day: number,
  startTime: string | undefined,
  endTime: string | undefined
): WorkCycle {
  return mapWeekDays(cycle, weekId, (days) =>
    days.map((d) => {
      if (d.day !== day) return d;
      const start = startTime !== undefined ? startTime : d.startTime;
      const end = endTime !== undefined ? endTime : d.endTime;
      if (start !== undefined && end !== undefined) {
        return { day, startTime: start, endTime: end };
      }
      return { day };
    })
  );
}

// ---- Week summary (collapsed week header) -------------------------------------

const DAY_ABBR = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'] as const;

/**
 * Compact French summary of a week's worked days for the collapsed week
 * header: « lun-ven 09:30-18:00 », « lun 09:30-18:00 · sam 10:00-17:00 »,
 * or « aucun jour travaillé ».
 * Consecutive days sharing the same range are folded into a-bbr range.
 */
export function summarizeCycleWeek(week: CycleWeek): string {
  // (dayAbbrev, range) runs of consecutive worked days with the same range
  const runs: Array<{ first: number; last: number; range: string }> = [];
  for (const d of week.days) {
    if (d.startTime === undefined || d.endTime === undefined) continue;
    const range = `${d.startTime}-${d.endTime}`;
    const last = runs[runs.length - 1];
    if (last && last.last === d.day - 1 && last.range === range) {
      last.last = d.day;
    } else {
      runs.push({ first: d.day, last: d.day, range });
    }
  }
  if (runs.length === 0) return 'aucun jour travaillé';
  return runs
    .map((r) =>
      r.first === r.last
        ? `${DAY_ABBR[r.first - 1]} ${r.range}`
        : `${DAY_ABBR[r.first - 1]}-${DAY_ABBR[r.last - 1]} ${r.range}`
    )
    .join(' · ');
}

// ---- ISO week key validation (anchor + forced inputs) ---------------------------

/**
 * Whether a string is a well-formed ISO week key 'YYYY-Www'
 * (week 01..53).
 */
export function validateIsoWeekKey(key: string): boolean {
  return /^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/.test(key);
}

// ---- Quota counter formatting (mediator form) -------------------------------------

/** French formatting of an hour count: integers plain, fractions with a comma. */
function frHours(h: number): string {
  const rounded = Math.round(h * 100) / 100;
  return String(rounded).replace('.', ',');
}

export interface QuotaSummary {
  /** « T3 2026 : 112h / 120h » */
  counter: string;
  /** « Solde : 8h » or « Dépassement de 10h » */
  balance: string;
  /** True when trackedHours > quota + carriedOver (amber, non-blocking). */
  overrun: boolean;
  /** « dont 5h reportés du trimestre précédent » when carriedOver ≠ 0. */
  carriedLabel?: string;
}

/**
 * Format the quarterly balance for the mediator-form quota counter:
 * counter line, solde/dépassement line, overrun flag and carry-over note.
 */
export function cycleQuotaSummary(
  mediator: Mediator,
  balance: QuarterlyBalance,
  quarter: 1 | 2 | 3 | 4,
  year: number
): QuotaSummary {
  // The mediator name is not part of the counter; the arrangement presence
  // is a precondition checked by the caller (computeQuarterlyBalance
  // returns null without one). Kept in the signature for parity with the
  // domain helpers and future per-mediator wording.
  void mediator;
  const effective = balance.quota + balance.carriedOver;
  const overrun = balance.trackedHours > effective;
  const summary: QuotaSummary = {
    counter: `T${quarter} ${year} : ${frHours(balance.trackedHours)}h / ${frHours(balance.quota)}h`,
    balance: overrun
      ? `Dépassement de ${frHours(balance.trackedHours - effective)}h`
      : `Solde : ${frHours(balance.balance)}h`,
    overrun,
  };
  if (balance.carriedOver > 0) {
    summary.carriedLabel = `dont ${frHours(balance.carriedOver)}h reportés du trimestre précédent`;
  } else if (balance.carriedOver < 0) {
    summary.carriedLabel = `dont ${frHours(-balance.carriedOver)}h de déficit reportés du trimestre précédent`;
  }
  return summary;
}

// ---- Quota input parsing -------------------------------------------------------------

/**
 * Parse a quota-hours input field: accepts '120', '120,5' (French decimal)
 * or '120.5'. Returns null for empty, non-numeric or negative input —
 * negative values are refused later by validateQuota, so they stay unparseable
 * in the form.
 */
export function quotaNumberFromInput(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) && value >= 0 ? value : null;
}
