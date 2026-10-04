// annual-export.ts — Annual view slice 5: Excel export DOMAIN workbook
// model. Pure functions, no browser APIs: builds the header rows, the day
// rows and the per-cell values + palette states of the exported file, at
// the EXACT format of the reference table (decisions 2026-10-03 #11 and
// 2026-10-04 #18-21). The infrastructure layer (annual-excel.ts) turns
// this model into a styled .xlsx via SheetJS.
// Spec: test/features/annual-view/annual-grid.feature (Export Excel).

import type { AppData, Mediator, WorkCycle } from './types';
import {
  deriveAnnualCell,
  workedSaturdayCounter,
  annualHolidayState,
  type AnnualHolidayOverrides,
} from './annual-view';
import { cycleWeekForDate, isoWeekKey } from './cycles';

// ---- Model types ---------------------------------------------------------

/**
 * One cell of the exported grid. `value` is the cell text (EMPTY for the
 * derived presence: the fill carries the semantic — decision 2026-10-04);
 * `state` is the palette key of ANNUAL_PALETTE driving the fill (null =
 * ordinary cell, no fill).
 */
export interface AnnualExportCell {
  /** Cell text ('' for the derived presence and untouched cells). */
  value: string;
  /** Palette state key of ANNUAL_PALETTE, or null for an unstyled cell. */
  state: string | null;
  /** Mediator the cell belongs to (style mapping / tests). */
  mediatorId: string;
  /** Half-day column of the mediator's group. */
  halfDay: 'morning' | 'afternoon';
}

/**
 * One day row of the exported file. The leftmost « Sem. » column holds the
 * ISO week label on the Monday of each week group ('' elsewhere); the date
 * column holds the weekday + date label, plus « Férié » / « Fermé » on
 * their rows (decision 2026-10-04).
 */
export interface AnnualExportRow {
  /** ISO date (YYYY-MM-DD) of the day — NOT exported, model key only. */
  iso: string;
  /** ISO week label ('S 40') on the group's first row, '' between. */
  weekLabel: string;
  /** Weekday + date label ('lun. 28/09'), with Férié/Fermé appended. */
  dateLabel: string;
  /** Row state driving the DATE cell fill: 'holiday' | 'museumClosed' | null. */
  rowState: 'holiday' | 'museumClosed' | null;
  /** The date cell (palette state + label), styled by the infrastructure. */
  dateCell: { value: string; state: string | null };
  /** One cell per half-day per exported mediator, in column order. */
  cells: AnnualExportCell[];
}

/** One merged 2-column header of the first row, per mediator. */
export interface AnnualExportMerge {
  /** Top-left cell, 0-based { r, c }. */
  from: { r: number; c: number };
  /** Bottom-right cell, 0-based { r, c }. */
  to: { r: number; c: number };
}

/**
 * The full export model of a displayed year: two header rows (merged
 * mediator names + Matin/Après-midi sub-headers), one row per day of the
 * year, one cell per half-day per exported mediator. No counting columns
 * (decision 2026-10-03 #9: not reproduced).
 */
export interface AnnualExportModel {
  /** Displayed year (every day row belongs to it). */
  year: number;
  /** Header row 1: Sem. | Date | merged mediator name groups. */
  headerRows: { value: string; state: string | null }[][];
  /** Merged ranges of the header (mediator name cells). */
  merges: AnnualExportMerge[];
  /** One row per day of the displayed year, weekends included. */
  dayRows: AnnualExportRow[];
  /** Exported mediators, in column order (hidden inactive excluded). */
  mediators: Mediator[];
}

/** Options of the export model. */
export interface AnnualExportOptions {
  /**
   * Include inactive mediators (decision 2026-10-04 #20): the state of the
   * « Médiateurs désactivés » toggle at export time is law — hidden
   * mediators are NOT exported, shown ones are.
   */
  includeInactive?: boolean;
  /** Holiday dérogations of the annual view (per-year deltas). */
  holidayOverrides?: AnnualHolidayOverrides;
}

// ---- Filename ------------------------------------------------------------

/**
 * Export filename, timestamped and year-stamped, following the
 * generateExportFilename conventions (OPEN-QUESTIONS, export decision
 * 2026-10-04): tableau-fonctionnement-<year>-<YYYYMMDD>-<HHMM>.xlsx — the
 * DISPLAYED year first, then the export date, then the export hour.
 */
export function annualExportFilename(year: number, when: Date = new Date()): string {
  const yyyy = when.getFullYear();
  const mm = String(when.getMonth() + 1).padStart(2, '0');
  const dd = String(when.getDate()).padStart(2, '0');
  const hh = String(when.getHours()).padStart(2, '0');
  const min = String(when.getMinutes()).padStart(2, '0');
  return `tableau-fonctionnement-${year}-${yyyy}${mm}${dd}-${hh}${min}.xlsx`;
}

// ---- Labels ----------------------------------------------------------------

// French weekday abbreviations of the date labels (lun. 28/09) — same
// format as the on-screen grid.
const WEEKDAY_SHORT = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];

/** Date label of a day row (« lun. 28/09 »). */
function dayLabel(d: Date): string {
  return `${WEEKDAY_SHORT[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** ISO date (YYYY-MM-DD) of a local Date, without timezone drift. */
function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ---- Model -----------------------------------------------------------------

/**
 * Build the export model of a displayed year (pure). Every day of the year
 * is exported, weekends included; the derived presence is an EMPTY cell
 * with the presence fill; absences/missions carry their code + legend fill;
 * worked-Saturday counters are exported IN the Saturday cells; cycle week
 * pills export on the Monday rows; férié/closed rows carry their date-cell
 * fill + text. Inactive mediators are excluded unless includeInactive.
 */
export function buildAnnualExportModel(
  data: AppData,
  year: number,
  options: AnnualExportOptions = {}
): AnnualExportModel {
  const holidayOverrides = options.holidayOverrides ?? data.annualHolidayOverrides ?? {};

  // Column model: active mediators first; inactive ones only when shown
  // (decision #20 — the toggle state at export time is law).
  const active = data.mediators.filter((m) => m.active);
  const inactive = data.mediators.filter((m) => !m.active);
  const columns: Mediator[] = options.includeInactive
    ? [...active, ...inactive]
    : active;

  // Per-mediator lookup of the active cycle
  const cycleByMediator = new Map<string, WorkCycle | undefined>();
  for (const m of data.mediators) {
    cycleByMediator.set(
      m.id,
      m.activeCycleId ? data.cycles.find((c) => c.id === m.activeCycleId) : undefined
    );
  }

  // ---- Header rows -------------------------------------------------------
  // Row 1: Sem. | Date | one merged 2-column group per mediator — the
  // mediator's name followed by the contract-type pill text (the mockup's
  // <span class="mname"> + <span class="pill pill-contract">).
  const headerRow1: { value: string; state: string | null }[] = [
    { value: 'Sem.', state: null },
    { value: 'Date', state: null },
  ];
  const headerRow2: { value: string; state: string | null }[] = [
    { value: '', state: null },
    { value: '', state: null },
  ];
  const merges: AnnualExportMerge[] = [];
  columns.forEach((m, i) => {
    const name = `${m.firstName} ${m.lastName}`.trim();
    const pill = m.contractType ? ` ${m.contractType}` : '';
    const col = 2 + i * 2;
    // Column-indexed: the merged name cell + an empty placeholder covering
    // the second column of the group (the merge spans both).
    headerRow1.push({ value: `${name}${pill}`, state: null });
    headerRow1.push({ value: '', state: null });
    headerRow2.push({ value: 'Matin', state: null });
    headerRow2.push({ value: 'Après-midi', state: null });
    merges.push({ from: { r: 0, c: col }, to: { r: 0, c: col + 1 } });
  });

  // ---- Day rows ------------------------------------------------------------
  const dayRows: AnnualExportRow[] = [];
  const cursor = new Date(year, 0, 1);
  while (cursor.getFullYear() === year) {
    const d = new Date(cursor);
    const iso = toIsoDate(d);
    const rowState = annualHolidayState(d, holidayOverrides);

    // Date label + Férié / Fermé text on their rows
    let dateLabel = dayLabel(d);
    if (rowState === 'holiday') dateLabel += ' Férié';
    if (rowState === 'museumClosed') dateLabel += ' Fermé';

    // ISO week label on the Monday of each week group (the merged cell
    // spans its rows — '' in between, like the on-screen leftmost column).
    const weekLabel =
      d.getDay() === 1 ? `S ${isoWeekNumberOf(d)}` : '';

    const cells: AnnualExportCell[] = [];
    for (const m of columns) {
      for (const halfDay of ['morning', 'afternoon'] as const) {
        let value = '';
        let state: string | null = null;

        // Worked-Saturday counter (decision #19): exported IN the morning
        // cell of Saturday rows, like the reference Excel — the on-screen
        // grid shows the pill on the morning cell only, the export matches.
        const counter =
          d.getDay() === 6 && halfDay === 'morning'
            ? workedSaturdayCounter(m.id, data.slots, d)
            : null;
        if (counter !== null) {
          value = String(counter);
        }

        // Cycle week pill on the Monday morning cell (decision: exported
        // like the reference Excel). The pill prefixes the cell content;
        // both the pill and a stored code can coexist.
        const cycle = cycleByMediator.get(m.id);
        if (d.getDay() === 1 && halfDay === 'morning' && cycle) {
          const pill = cycleWeekForDate(cycle, d)?.name;
          if (pill) value = value ? `${pill} ${value}` : pill;
        }

        // Derived cell: stored absences/missions win, presence is EMPTY
        // with the presence fill (the fill carries the semantic).
        const cell = m.active
          ? deriveAnnualCell(m.id, d, halfDay, { cycle, absences: data.absences })
          : null;
        if (cell) {
          state = cell.state;
          if (cell.code) value = cell.code; // full text, never abbreviated (decision #18)
        }

        cells.push({ value, state, mediatorId: m.id, halfDay });
      }
    }

    dayRows.push({
      iso,
      weekLabel,
      dateLabel,
      rowState,
      dateCell: { value: dateLabel, state: rowState },
      cells,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return {
    year,
    headerRows: [headerRow1, headerRow2],
    merges,
    dayRows,
    mediators: columns,
  };
}

/** ISO week number of a date (1..53), from the 'YYYY-Www' key. */
function isoWeekNumberOf(d: Date): number {
  return Number(isoWeekKey(d).split('-W')[1]);
}
