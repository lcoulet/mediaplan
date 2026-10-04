// annual-view.ts — Annual view ("tableau de fonctionnement") domain slice 1:
// cell palette states, annual code catalog, worked-Saturday counters, ISO week
// labels and holiday overrides. Pure functions only, no browser APIs.
// Spec: test/features/annual-view/annual-grid.feature (domain scenarios).
// Palette: Excel hues accessibility-adjusted (decision 2026-10-03, contrasts
// computed in contrast_palette_mix.py — see docs/OPEN-QUESTIONS.md).
import type { Absence, AbsenceType } from './types';

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
