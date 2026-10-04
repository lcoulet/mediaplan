// annual-view.ts — Annual view ("tableau de fonctionnement") domain slice 1:
// cell palette states, annual code catalog, worked-Saturday counters, ISO week
// labels and holiday overrides. Pure functions only, no browser APIs.
// Spec: test/features/annual-view/annual-grid.feature (domain scenarios).
// Palette: Excel hues accessibility-adjusted (decision 2026-10-03, contrasts
// computed in contrast_palette_mix.py — see docs/OPEN-QUESTIONS.md).
import type { Absence, AbsenceType, Slot } from './types';
import { isoWeekKey } from './cycles';

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
    { code: 'amgt', state: 'arrangement', absenceType: 'other' },
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
 * Worked-Saturday counter of a mediator at a date (decision 2026-10-03):
 * COMPUTED automatically — the number of Saturdays of the displayed year,
 * up to and including the given date, with at least one non-cancelled slot
 * assigned to the mediator. Displayed on Saturday rows only (null for any
 * other weekday); resets on year change because only the date's own year is
 * counted. Feeds the valued-Saturday threshold (valuedSaturdayThreshold).
 */
export function workedSaturdayCounter(mediatorId: string, slots: Slot[], date: Date): number | null {
  if (date.getDay() !== 6) return null; // Saturday rows only
  const year = date.getFullYear();
  const dateIso = toIsoDate(date);
  const workedSaturdays = new Set<string>();
  for (const slot of slots) {
    if (!slot.mediatorIds?.includes(mediatorId)) continue;
    if (slot.status === 'cancelled') continue;
    if (!slot.date || slot.date > dateIso) continue;
    const slotDate = new Date(`${slot.date}T00:00:00`);
    if (slotDate.getFullYear() !== year) continue; // per-year: resets on year change
    if (slotDate.getDay() !== 6) continue;
    workedSaturdays.add(slot.date);
  }
  return workedSaturdays.size;
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
