// annual-editing.ts — Annual view ("tableau de fonctionnement") domain slices:
// IMMUTABLE editing operations on the persisted model. Pure functions, no
// browser APIs; every op returns a new value and never mutates its inputs.
// Spec: test/features/annual-view/annual-editing.feature (edition + fériés
// dérogation scenarios). Read-side logic lives in annual-view.ts (slice 1).
//
// Slice 4 (cell editing UI) adds the context-menu CHOICE mapping:
//  - annualMenuChoice: a code chip -> the stored absence fields (type+notes);
//  - annualFreeTextEntry: free text -> mission fields, exact catalog codes
//    keep their own type (decoded suggestions);
//
// Half-day exception ops write plain Absence records — the same entity the
// Absences view edits — but always scoped to ONE half-day cell:
//  - set:   replaces any same-date single-day exception of that mediator on
//           the same half-day; a same-date FULL-day entry is narrowed so the
//           untouched half keeps its stored value;
//  - clear: removes the covering half-day exception (\"retour au dérivé\");
//           a same-date full-day entry is narrowed to the surviving half;
//  - multi-day range absences (Absences-view scope) are NEVER touched.
// Holiday dérogation ops write the per-year AnnualHolidayOverrides deltas
// (add/remove against the auto-computed French list, see annual-view.ts).
import type { Absence, AbsenceHalfDay, AbsenceType } from './types';
import { generateId } from './models';
import type { AnnualHolidayOverrides } from './annual-view';
import { annualCodeCatalog } from './annual-view';

// ---- Half-day exceptions ---------------------------------------------------

/** The stored value of one half-day cell: a catalog code's absence fields. */
export interface HalfDayExceptionInput {
  /** Mediator owning the cell. */
  mediatorId: string;
  /** ISO date of the cell (YYYY-MM-DD). */
  date: string;
  /** The cell's half-day. */
  halfDay: 'morning' | 'afternoon';
  /** Absence type backing the code (see annualCodeCatalog in annual-view.ts). */
  type: AbsenceType;
  /** Free text / code displayed in the cell (e.g. 'CA', 'Stop Motion'). */
  notes: string;
}

/**
 * True when the absence is a single-day exception on the given date, i.e.
 * within the editing scope of one cell (halfDay 'none' covers BOTH cells of
 * that date). Multi-day ranges (Absences-view scope) are out of scope: a
 * cell edit never rewrites a range the coordinator entered elsewhere.
 */
function isSameDayException(absence: Absence, mediatorId: string, date: string): boolean {
  return absence.mediatorId === mediatorId && absence.startDate === date && absence.endDate === date;
}

/**
 * Store a half-day cell's value as an absence (immutable). Any existing
 * same-day exception of that mediator covering the SAME half-day is replaced;
 * a same-day full-day entry is narrowed so the untouched half-day keeps its
 * stored value. Other entries are copied as-is. The new entry gets a fresh
 * id (generateId) — cell edits are independent records, not merges.
 */
export function setHalfDayException(
  absences: readonly Absence[],
  input: HalfDayExceptionInput
): Absence[] {
  const otherHalf: AbsenceHalfDay = input.halfDay === 'morning' ? 'afternoon' : 'morning';
  const kept: Absence[] = [];
  for (const a of absences) {
    if (!isSameDayException(a, input.mediatorId, input.date)) {
      kept.push(a); // other mediator / other date / multi-day range: untouched
      continue;
    }
    if (a.halfDay === input.halfDay) continue; // replaced by the new entry
    if (a.halfDay === 'none') {
      // Narrow the full-day entry to the untouched half: it keeps its
      // own type/notes/id (its remaining half is still stored).
      kept.push({ ...a, halfDay: otherHalf });
      continue;
    }
    kept.push(a); // the OTHER half-day's own entry: untouched
  }
  kept.push({
    id: generateId('abs'),
    mediatorId: input.mediatorId,
    startDate: input.date,
    endDate: input.date,
    halfDay: input.halfDay,
    type: input.type,
    notes: input.notes,
  });
  return kept;
}

/**
 * Clear a half-day cell (\"retour au dérivé\"): remove the absence covering
 * that mediator + date + half-day (immutable). A same-day full-day entry is
 * narrowed to the surviving half-day instead of being deleted wholesale;
 * multi-day ranges and other mediators' entries are never touched. Returns a
 * new list even when nothing covered the cell.
 */
export function clearHalfDayException(
  absences: readonly Absence[],
  mediatorId: string,
  date: string,
  halfDay: 'morning' | 'afternoon'
): Absence[] {
  const otherHalf: AbsenceHalfDay = halfDay === 'morning' ? 'afternoon' : 'morning';
  const kept: Absence[] = [];
  for (const a of absences) {
    if (!isSameDayException(a, mediatorId, date)) {
      kept.push(a);
      continue;
    }
    if (a.halfDay === 'none') {
      kept.push({ ...a, halfDay: otherHalf }); // narrow, keep the other half
      continue;
    }
    if (a.halfDay === halfDay) continue; // the cleared cell's own entry: removed
    kept.push(a); // the other half-day's entry: untouched
  }
  return kept;
}

/**
 * The absence covering a mediator + date + half-day, or null. Same-day
 * exceptions match their own half-day; a full-day entry covers both.
 * Multi-day ranges covering the date are also found (read-side coverage for
 * the cell display) — unlike the write ops, which never touch them.
 */
export function findHalfDayException(
  absences: readonly Absence[],
  mediatorId: string,
  date: string,
  halfDay: 'morning' | 'afternoon'
): Absence | null {
  let range: Absence | null = null;
  for (const a of absences) {
    if (a.mediatorId !== mediatorId) continue;
    if (a.startDate <= date && date <= a.endDate) {
      if (a.halfDay === 'none' || a.halfDay === halfDay) {
        // Prefer the exact same-day exception over a covering range
        if (a.startDate === date && a.endDate === date) return a;
        range = a;
      }
    }
  }
  return range;
}

// ---- Context menu choice mapping -------------------------------------------

/** Stored absence fields of one cell value: type + displayed notes/code. */
export interface CellEntry {
  /** AbsenceType backing the value. */
  type: AbsenceType;
  /** Displayed code / free text stored in the absence notes. */
  notes: string;
}

/**
 * Map a context-menu code chip onto its stored absence fields (slice 4).
 * The menu's « Souhait » chip stores the pending leave request as
 * « souhait CA » (type leave_request, blue cell — distinct from the
 * confirmed leave); every other chip maps straight onto its catalog entry.
 * Returns null for an unknown code — the UI must not invent a mapping.
 */
export function annualMenuChoice(code: string): CellEntry | null {
  if (code === 'Souhait') return { type: 'leave_request', notes: 'souhait CA' };
  const entry = annualCodeCatalog().find((c) => c.code === code);
  if (!entry || !entry.absenceType) return null;
  return { type: entry.absenceType, notes: entry.code };
}

/**
 * Map the free-text input onto its stored fields: a trimmed input that
 * EXACTLY matches a catalog code stores that code's type (a decoded
 * suggestion picked as text — « JDM » stays the green mission code); any
 * other text is a mission displayed as-is (orange, decision 2026-10-03:
 * free text is non-blocking). Returns null for blank input.
 */
export function annualFreeTextEntry(text: string): CellEntry | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const entry = annualCodeCatalog().find((c) => c.code === trimmed);
  if (entry && entry.absenceType) return { type: entry.absenceType, notes: entry.code };
  return { type: 'mission', notes: trimmed };
}

// ---- Holiday dérogations ---------------------------------------------------

/**
 * ADD a date to a year's holiday dérogations (immutable): the date becomes a
 * holiday in the annual grid (see annualHolidayState). Idempotent — adding an
 * already-added date is a no-op; adding a date that was REMOVED un-removes it
 * (one date cannot be both added and removed: `added` wins so the canonical
 * state always matches what the coordinator sees). Other years and dates are
 * copied unchanged.
 */
export function addHolidayDerogation(
  overrides: AnnualHolidayOverrides,
  year: string,
  date: string
): AnnualHolidayOverrides {
  const entry = overrides[year];
  if (entry && entry.added.includes(date)) return overrides; // idempotent
  const removed = entry ? entry.removed.filter((d) => d !== date) : [];
  const added = entry ? [...entry.added, date] : [date];
  return { ...overrides, [year]: { added, removed } };
}

/**
 * REMOVE a date from a year's holiday markings (immutable): the date loses
 * its holiday marking (default or dérogation). Idempotent; a date that was
 * ADDED goes back to no marking (dropped from `added`, not pushed to
 * `removed` — an added date has no default to restore). Other years and
 * dates are copied unchanged.
 */
export function removeHolidayDerogation(
  overrides: AnnualHolidayOverrides,
  year: string,
  date: string
): AnnualHolidayOverrides {
  const entry = overrides[year];
  if (!entry) return { ...overrides, [year]: { added: [], removed: [date] } };
  if (!entry.added.includes(date) && entry.removed.includes(date)) return overrides; // idempotent
  const added = entry.added.filter((d) => d !== date);
  // Symmetric with addHolidayDerogation: an ADDED date moves to `removed`
  // (one date is never in both lists). The read side is unaffected — an
  // added date has no default marking, so `removed` also yields none.
  const removed = [...entry.removed, date];
  return { ...overrides, [year]: { added, removed } };
}

/**
 * RESET a date's dérogation (immutable): the date returns to its default
 * marking (auto-computed holiday or ordinary day). When nothing remains for
 * the year, the year entry is pruned; when the year has no dérogation at
 * all, the SAME reference is returned (no-op).
 */
export function resetHolidayDerogation(
  overrides: AnnualHolidayOverrides,
  year: string,
  date: string
): AnnualHolidayOverrides {
  const entry = overrides[year];
  if (!entry) return overrides;
  const added = entry.added.filter((d) => d !== date);
  const removed = entry.removed.filter((d) => d !== date);
  if (added.length === 0 && removed.length === 0) {
    const next = { ...overrides };
    delete next[year]; // prune the empty year entry
    return next;
  }
  return { ...overrides, [year]: { added, removed } };
}
