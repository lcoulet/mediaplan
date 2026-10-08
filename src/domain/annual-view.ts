// annual-view.ts — Annual view ("tableau de fonctionnement") domain slice 1:
// cell palette states, annual code catalog, worked-Saturday counters, ISO week
// labels and holiday overrides. Pure functions only, no browser APIs.
// Spec: test/features/annual-view/annual-grid.feature (domain scenarios).
// Palette: Excel hues accessibility-adjusted (decision 2026-10-03, contrasts
// computed in contrast_palette_mix.py — see docs/OPEN-QUESTIONS.md).
import type { Absence, AbsenceType, WorkCycle } from './types';
import { isoWeekKey, getWorkedHoursForDate } from './cycles';
import { isMuseumClosed, isPublicHoliday, frenchHolidays } from './hours';

// ---- Cell palette --------------------------------------------------------

/**
 * A palette state of the annual grid: semantic key, fill + text colors,
 * optional hatch (museum-closed). States are derived, never stored: the
 * fill carries the semantics on screen and in the Excel export.
 */
export interface AnnualPaletteState {
  /** Semantic key, e.g. 'absence', 'leaveRequest', 'presence'. */
  state: string;
  /** Cell fill color (hex). */
  fill: string;
  /** Text color on the fill (hex). Omitted when the fill is neutral. */
  text?: string;
  /** True for the museum-closed hatching (not exportable — replaced by a
   *  gray fill + « Fermé » text in the Excel export). */
  hatch?: boolean;
}

/**
 * Annual grid palette (mixed Excel + WCAG AA, decided 2026-10-03):
 *  - absence (yellow #F9A825 / #2b2b2b): CA, RHS, RTT, AM, CET, CEX, TPT...
 *  - mission (orange #d68c45 / #3a2408): free-text missions, Réf. WE
 *  - remote (pink #B85555): TELE télétravail
 *  - arrangement (violet #7B5AA0): amgt JJ/MM
 *  - leaveRequest (blue #4178AB): souhait — pending leave request
 *  - jdm (green #2F7A4A): JDM mission (Jardins du muséum)
 *  - workAbsence (red #c0392b / white): grève, syndicat, formation
 *  - presence (orange #C67A33): derived cycle presence (empty cell)
 *  - holiday (amber #fef5e7 / #8a4d10): public holiday row marker
 *  - museumClosed (hatch): 25/12, 01/01, 01/05
 */
export const ANNUAL_PALETTE: AnnualPaletteState[] = [
  { state: 'absence', fill: '#F9A825', text: '#2b2b2b' },
  { state: 'mission', fill: '#d68c45', text: '#3a2408' },
  { state: 'remote', fill: '#B85555' },
  { state: 'arrangement', fill: '#7B5AA0' },
  { state: 'leaveRequest', fill: '#4178AB' },
  { state: 'jdm', fill: '#2F7A4A' },
  { state: 'workAbsence', fill: '#c0392b', text: '#ffffff' },
  { state: 'presence', fill: '#C67A33' },
  { state: 'holiday', fill: '#fef5e7', text: '#8a4d10' },
  { state: 'museumClosed', fill: '#8a8a8a', hatch: true },
];

/** Palette keyed by semantic state for constant-time lookup. */
export function annualPaletteByState(): Record<string, AnnualPaletteState> {
  const map: Record<string, AnnualPaletteState> = {};
  for (const s of ANNUAL_PALETTE) map[s.state] = s;
  return map;
}

// ---- Annual code catalog --------------------------------------------------

/**
 * One code offered by the annual grid context menu. `absenceType` maps the
 * code onto the existing AbsenceType when the code stores an absence; free
 * text and derived codes have none.
 */
export interface AnnualCode {
  /** Displayed code, as in the reference Excel file. */
  code: string;
  /** Palette state of the cell when the code is chosen. */
  state: string;
  /** Existing AbsenceType used to store the entry, if any. */
  absenceType?: AbsenceType;
}

/**
 * Full code catalog of the annual view context menu (decision 2026-10-03):
 * leave codes in yellow, TELE pink, amgt violet, Souhait blue (leave_request),
 * JDM green (mission), work-related absences red, Réf. WE mission orange.
 */
export function annualCodeCatalog(): AnnualCode[] {
  return [
    { code: 'CA', state: 'absence', absenceType: 'leave' },
    { code: 'RHS', state: 'absence', absenceType: 'leave' },
    { code: 'RTT', state: 'absence', absenceType: 'leave' },
    { code: 'CET', state: 'absence', absenceType: 'leave' },
    { code: 'CEX', state: 'absence', absenceType: 'leave' },
    { code: 'AM', state: 'absence', absenceType: 'sick' },
    { code: 'TPT', state: 'absence', absenceType: 'other' },
    { code: 'TELE', state: 'remote', absenceType: 'other' },
    // Aménagements come in PAIRS (decision 2026-10-05: days/half-days are
    // exchanged T/NT) — two codes, same violet state, worked vs not.
    { code: 'Amgt.T', state: 'arrangement', absenceType: 'other' },
    { code: 'Amgt.NT', state: 'arrangement', absenceType: 'other' },
    { code: 'souhait CA', state: 'leaveRequest', absenceType: 'leave_request' },
    { code: 'JDM', state: 'jdm', absenceType: 'mission' },
    { code: 'grève', state: 'workAbsence', absenceType: 'other' },
    { code: 'syndicat', state: 'workAbsence', absenceType: 'other' },
    { code: 'formation', state: 'workAbsence', absenceType: 'training' },
    { code: 'Réf. WE', state: 'mission', absenceType: 'mission' },
  ];
}

/** Generic fallback label per absence type when the notes carry no code. */
const FALLBACK_CODE: Record<AbsenceType, string> = {
  leave: 'CA',
  mission: 'Mission',
  training: 'formation',
  sick: 'AM',
  other: 'Autre',
  leave_request: 'souhait CA',
};

/** The code displayed in a cell for a stored absence (notes, or fallback).
 *  A pending leave request (leave_request) displays « souhait CA » — the
 *  blue cell is distinct from the confirmed leave's yellow. */
export function codeForAbsence(absence: Absence): string {
  const notes = (absence.notes || '').trim() || FALLBACK_CODE[absence.type];
  if (absence.type === 'leave_request') {
    return notes.startsWith('souhait') ? notes : `souhait ${notes}`;
  }
  return notes;
}

/** Default code of an absence type when the coordinator picks a bare type. */
export function defaultCodeForType(type: AbsenceType): string {
  return FALLBACK_CODE[type];
}

// ---- Half-day resolution ---------------------------------------------------

/**
 * Half-day coverage of an absence for a date: 'morning', 'afternoon', 'none'
 * (full day), or null when the date is outside the absence range. A half-day
 * absence covers exactly its own half-day.
 */
export function halfDayOfAbsence(absence: Absence, date: Date): 'morning' | 'afternoon' | 'none' | null {
  const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  if (iso < absence.startDate || iso > absence.endDate) return null;
  if (absence.halfDay === 'morning' || absence.halfDay === 'afternoon') return absence.halfDay;
  return 'none';
}

// ---- Worked-Saturday counter ----------------------------------------------

/**
 * How a Saturday counts as WORKED for the counter (spec fix 2026-10-04:
 * the counter counts worked Saturdays as displayed in the annual grid —
 * presence cells, NOT slots):
 * - 'any_half_day' (DEFAULT, decision 2026-10-04): at least ONE half-day
 *   of the Saturday shows presence (morning OR afternoon — a full day is
 *   two presence halves and still counts for one)
 * - 'full_day': BOTH half-days must show presence
 * - 'morning': the MORNING half only
 * Pluggable on purpose: switching the counting rule is a one-argument
 * change at the call sites.
 */
export type SaturdayCountStrategy = 'any_half_day' | 'full_day' | 'morning';

/**
 * Classification congés/travail d'un état de cellule annuelle (decision with
 * Loic 2026-10-05). WORKED:
 *  - presence (cycle-derived), mission (Réf. WE, free text), remote (TELE),
 *    jdm (mission Jardins du muséum)
 *  - arrangement Amgt.T (aménagement travaillé)
 *  - workAbsence 'formation' (training counts as work)
 * NOT worked:
 *  - absence (CA, CEX, AM, RHS, TPT — temps partiel thérapeutique is a
 *    chômé day), leaveRequest (souhait)
 *  - arrangement Amgt.NT and legacy bare 'amgt' (safe default: unknown
 *    arrangement is not counted as work)
 *  - workAbsence grève / syndicat (no effective public service)
 *  - holiday / museumClosed row states, neutral cells
 * The second argument is the cell CODE (how Amgt.T / Amgt.NT and
 * formation / grève are told apart within the same visual state).
 */
export function isWorkedState(state: string | undefined, code?: string): boolean {
  switch (state) {
    case 'presence':
    case 'mission':
    case 'remote':
    case 'jdm':
      return true;
    case 'arrangement':
      return code === 'Amgt.T';
    case 'workAbsence':
      return code === 'formation';
    default:
      return false;
  }
}

/** True when the Saturday is worked for the mediator under the strategy. */
function saturdayIsWorked(
  mediatorId: string,
  date: Date,
  inputs: { cycle?: WorkCycle; absences: Absence[] },
  strategy: SaturdayCountStrategy
): boolean {
  // Museum-closure days are NEVER worked (decision 2026-10-05), whatever
  // the cycle says. Public holidays ARE worked (they don't block).
  if (isMuseumClosed(date)) return false;
  const halves: ('morning' | 'afternoon')[] =
    strategy === 'morning' ? ['morning'] : ['morning', 'afternoon'];
  const need = strategy === 'full_day' ? 2 : 1;
  let present = 0;
  for (const half of halves) {
    const cell = deriveAnnualCell(mediatorId, date, half, inputs);
    if (isWorkedState(cell?.state, cell?.code)) present++;
  }
  return present >= need;
}

/**
 * Worked-Saturday counter of a mediator at a date: the number of Saturdays
 * of the displayed year, up to and including the given date, WORKED by the
 * mediator — as shown in the annual grid (presence cells; a covering
 * absence/wish prevents counting). Strategy decides what "worked" means
 * (default any_half_day: one worked half-day suffices — decision
 * 2026-10-04). Displayed on Saturday rows only (null for any other
 * weekday); resets on year change because only the date's own year is
 * counted. Feeds the valued-Saturday threshold (valuedSaturdayThreshold).
 */
export function workedSaturdayCounter(
  mediatorId: string,
  inputs: { cycle?: WorkCycle; absences: Absence[] },
  date: Date,
  strategy: SaturdayCountStrategy = 'any_half_day'
): number | null {
  if (date.getDay() !== 6) return null; // Saturday rows only
  const year = date.getFullYear();
  const worked = new Set<string>();
  // Walk the year's Saturdays up to the given date (inclusive)
  const cursor = new Date(year, 0, 1);
  while (cursor.getFullYear() === year && cursor <= date) {
    if (cursor.getDay() === 6) {
      if (saturdayIsWorked(mediatorId, cursor, inputs, strategy)) {
        worked.add(toIsoDate(cursor));
      }
      cursor.setDate(cursor.getDate() + 7); // jump week-wise once on a Saturday
    } else {
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  return worked.size;
}

/** ISO date (YYYY-MM-DD) of a local Date, without timezone drift. */
function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ---- Week labels ----------------------------------------------------------

/** One ISO week label of the annual grid's own « Semaine » column. */
export interface AnnualWeekLabel {
  /** ISO week key, e.g. '2026-W37'. */
  weekKey: string;
  /** Displayed label, e.g. 'S 37'. */
  label: string;
  /** ISO date of the week's Monday (the anchor row spanning the 7 days). */
  monday: string;
}

/**
 * Week label of a day row: 'S 37' on Mondays (the label spans its whole ISO
 * week in its own leftmost column — decision 2026-10-04), null on any other
 * weekday. Follows the ISO week-year: Mon 2025-12-29 is 'S 1' (of 2026).
 */
export function annualWeekLabel(date: Date): string | null {
  if (date.getDay() !== 1) return null; // Monday rows only
  const key = isoWeekKey(date); // '2026-W37'
  return `S ${Number(key.split('-W')[1])}`;
}

/**
 * All ISO week labels of a grid year: the ISO weeks touched by the year's
 * days (Jan 1 to Dec 31), Monday-anchored and in chronological order. A year
 * whose Jan 1 falls mid-week starts at that partial week's Monday (possibly
 * in the previous December); 2026 has 53 ISO weeks, 2027 has 52.
 */
export function annualWeekLabelsForYear(year: number): AnnualWeekLabel[] {
  const labels: AnnualWeekLabel[] = [];
  const seen = new Set<string>();
  // One label per ISO week TOUCHED by the year's calendar days: Jan 1
  // belongs to 2026-W01 (so 2026 spans S 1..S 53, its Monday falling in Dec
  // 2025), while Jan 1 2027 belongs to 2026-W53 (so 2027 starts at S 1 on
  // Mon 2027-01-04). Mondays are the anchor row spanning the 7 days.
  const cursor = new Date(year, 0, 1);
  while (cursor.getFullYear() === year) {
    const weekKey = isoWeekKey(cursor);
    if (!seen.has(weekKey)) {
      seen.add(weekKey);
      const monday = new Date(cursor);
      monday.setDate(monday.getDate() - ((cursor.getDay() + 6) % 7));
      labels.push({
        weekKey,
        label: `S ${Number(weekKey.split('-W')[1])}`,
        monday: toIsoDate(monday),
      });
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return labels;
}

// ---- Férié panel display list ---------------------------------------------

/** Chip states of the annual view's férié panel (per-year dérogations). */
export const ANNUAL_FERIE_DEFAULT = 'default' as const;
export const ANNUAL_FERIE_ADDED = 'added' as const;
export const ANNUAL_FERIE_REMOVED = 'removed' as const;

/** One chip of the férié panel: a holiday date and its dérogation state. */
export interface AnnualFerieChip {
  /** ISO date (YYYY-MM-DD), always inside the displayed year. */
  date: string;
  /** French name of the holiday ('' for ADDED dérogations: no known name). */
  name: string;
  /** 'default' (auto-computed French list), 'added' or 'removed' dérogation. */
  status: typeof ANNUAL_FERIE_DEFAULT | typeof ANNUAL_FERIE_ADDED | typeof ANNUAL_FERIE_REMOVED;
}

/**
 * Display list of the férié panel for a year: the auto-computed French
 * holidays (frenchHolidays in hours.ts) as 'default' chips, defaults struck
 * through as 'removed' when the year's dérogation removed them, then the
 * year's 'added' dérogation dates appended at the end (chronologically).
 * Dates outside the requested year in the dérogation are ignored — a chip
 * always belongs to exactly one displayed year. Pure function.
 */
export function annualHolidayPanelList(
  year: number,
  overrides?: AnnualHolidayOverrides
): AnnualFerieChip[] {
  const derogation = overrides?.[String(year)];
  const added = (derogation?.added ?? []).filter((d) => Number(d.slice(0, 4)) === year);
  const removed = new Set(
    (derogation?.removed ?? []).filter((d) => Number(d.slice(0, 4)) === year)
  );
  const chips: AnnualFerieChip[] = frenchHolidays(year).map((h) => ({
    date: h.date,
    name: h.name,
    status: removed.has(h.date) ? ANNUAL_FERIE_REMOVED : ANNUAL_FERIE_DEFAULT,
  }));
  for (const date of [...added].sort()) {
    chips.push({ date, name: '', status: ANNUAL_FERIE_ADDED });
  }
  return chips;
}

// ---- Holiday overrides ------------------------------------------------------

/**
 * Per-year holiday dérogations of the annual view: dates ADDED to and
 * REMOVED from the auto-computed French list of that year. Unlike the
 * whole-list `holidayOverrides` of ValorisationConfig (hours.ts), these
 * are deltas: adding 10 août keeps every default marking, removing
 * 14 juillet unmarks only that day (annual-grid.feature, fériés scenarios).
 */
export interface AnnualHolidayOverrides {
  /** Year ('2026') -> { added, removed } ISO dates. */
  [year: string]: { added: string[]; removed: string[] };
}

/**
 * Row state of a day in the annual grid: 'museumClosed' (hatched — 25/12,
 * 01/01, 01/05, whatever the year), 'holiday' (amber — public holiday of
 * the effective list) or null (ordinary day). Museum closure takes
 * precedence: a férié that falls on a closure day shows the closure state.
 *
 * The list is the auto-computed French holidays of the year (frenchHolidays
 * in hours.ts), adjusted by the per-year add/remove dérogations; years
 * without dérogations use the pure defaults.
 */
export function annualHolidayState(
  date: Date,
  overrides?: AnnualHolidayOverrides
): 'holiday' | 'museumClosed' | null {
  if (isMuseumClosed(date)) return 'museumClosed';
  const iso = toIsoDate(date);
  const year = String(date.getFullYear());
  const derogation = overrides?.[year];
  if (derogation) {
    if (derogation.removed.includes(iso)) return null;
    if (derogation.added.includes(iso)) return 'holiday';
  }
  if (isPublicHoliday(date)) return 'holiday';
  return null;
}

// ---- Cell derivation ---------------------------------------------------------

/** The derived content of one half-day cell of the annual grid. */
export interface AnnualCell {
  /** Palette state (key into ANNUAL_PALETTE). */
  state: string;
  /** Displayed code/text; absent for the derived presence (empty cell). */
  code?: string;
  /** The stored absence backing the cell, when one exists. */
  absence?: Absence;
}

/** Inputs of the derivation: the mediator's cycle and stored absences. */
export interface AnnualCellInputs {
  /** The mediator's active work cycle (optional: no cycle = neutral cells). */
  cycle?: WorkCycle;
  /** All stored absences (filtered by mediator inside). */
  absences: Absence[];
}

/** Map each existing AbsenceType onto its palette state. */
const TYPE_STATE: Record<AbsenceType, string> = {
  leave: 'absence',
  mission: 'mission',
  training: 'workAbsence',
  sick: 'absence',
  other: 'absence',
  leave_request: 'leaveRequest',
};

/** Palette state of a stored entry: catalog code first, type fallback.
 *  Aménagements are matched by prefix: the stored entry carries the
 *  arrangement date (« amgt 21/06 », « Amgt.T 21/06 »), still a violet
 *  arrangement cell. Legacy bare « amgt » still matches (legacy data).
 *  Exported for the annual view's memoized per-year cell matrix (same
 *  precedence as deriveAnnualCell, computed once per data change). */
export function stateForEntry(absence: Absence): string {
  const code = codeForAbsence(absence);
  const catalog = annualCodeCatalog().find(
    (c) =>
      c.code === code ||
      ((c.code === 'Amgt.T' || c.code === 'Amgt.NT' || c.code === 'amgt') &&
        code.toLowerCase().startsWith('amgt'))
  );
  if (catalog) return catalog.state;
  return TYPE_STATE[absence.type];
}

/**
 * Derive one half-day cell of the annual grid (presence model, decision
 * 2026-10-03): the orange presence is COMPUTED from the mediator's cycle
 * (never stored); absences/missions placed on top REPLACE the derived
 * presence visually; clearing reverts to the derived state. Returns null
 * for a neutral cell (non-worked day, or no cycle at all).
 */
export function deriveAnnualCell(
  mediatorId: string,
  date: Date,
  halfDay: 'morning' | 'afternoon',
  inputs: AnnualCellInputs
): AnnualCell | null {
  // Overlay: a stored absence covering this mediator + date + half-day wins.
  // A same-day exception (cell-editing scope) takes PRECEDENCE over a
  // covering multi-day range: cell edits replace the display without ever
  // rewriting the range itself (the write ops never touch ranges).
  let range: Absence | null = null;
  for (const absence of inputs.absences) {
    if (absence.mediatorId !== mediatorId) continue;
    const coverage = halfDayOfAbsence(absence, date);
    if (coverage === null) continue;
    if (coverage === 'none' || coverage === halfDay) {
      // Same-day entries (cell-editing scope) win immediately; a covering
      // multi-day range is kept as fallback (first match, loop order).
      if (isSameDayEntry(absence, date)) {
        return { state: stateForEntry(absence), code: codeForAbsence(absence), absence };
      }
      range = absence;
    }
  }
  if (range) {
    return { state: stateForEntry(range), code: codeForAbsence(range), absence: range };
  }
  // Derived presence: the mediator's cycle works this date
  if (inputs.cycle && getWorkedHoursForDate(inputs.cycle, date).worked) {
    return { state: 'presence' };
  }
  return null;
}

/** True when the absence spans exactly the given date (single-day entry).
 *  Exported for the annual view's memoized per-year cell matrix. */
export function isSameDayEntry(absence: Absence, date: Date): boolean {
  const iso = toIsoDate(date);
  return absence.startDate === iso && absence.endDate === iso;
}
