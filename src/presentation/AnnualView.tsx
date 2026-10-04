// AnnualView.tsx — « Tableau de fonctionnement »: full-year grid of every
// day (weekends included) x mediators, one cell per half-day (Matin /
// Après-midi), driven entirely by the domain slices:
//   - presence/codes derived from the cycle + stored absences
//     (src/domain/annual-view.ts, deriveAnnualCell — never stored)
//   - ISO week labels in their own leftmost « Sem. » column, spanning the
//     7 day-rows of the week (annualWeekLabel — decision 2026-10-04)
//   - worked-Saturday counters computed from slots
//     (workedSaturdayCounter), valued from valuedSaturdayThreshold
//   - férié rows (default French list + per-year dérogations, editable in
//     the férié panel — annual-editing.ts holiday ops)
//   - route focus: the row of the app's global date (?date=) is highlighted
//     and scrolled into view; week/day labels navigate to the weekly/daily
//     views (decisions 2026-10-04)
//   - inactive mediators hidden by default, revealed by the toolbar toggle
//     (decision #17)
// Editing (context menu, paint mode) is a separate slice; this view only
// DISPLAYS the derived state.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useData } from './DataContext';
import { toLocalDateString, parseLocalDate } from '../domain/models';
import {
  deriveAnnualCell,
  workedSaturdayCounter,
  annualHolidayState,
  annualHolidayPanelList,
  ANNUAL_FERIE_ADDED,
  ANNUAL_FERIE_REMOVED,
  type AnnualHolidayOverrides,
} from '../domain/annual-view';
import { cycleWeekForDate, isoWeekKey } from '../domain/cycles';
import {
  addHolidayDerogation,
  removeHolidayDerogation,
  resetHolidayDerogation,
  setHalfDayException,
  clearHalfDayException,
  annualMenuChoice,
  annualFreeTextEntry,
} from '../domain/annual-editing';
import AnnualCellMenu, { type AnnualCellTarget } from './AnnualCellMenu';
import { quarterOfDate, computeQuarterlyBalance, defaultValorisationConfig } from '../domain/hours';
import { buildAnnualExportModel, annualExportFilename } from '../domain/annual-export';
import { writeAnnualExcel } from '../infrastructure/annual-excel';
import type { Mediator, WorkCycle } from '../domain/types';

// French weekday abbreviations of the date labels (lun. 28/09)
const WEEKDAY_SHORT = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];

// « lun. 28/09 » — date label of a day row
function dayLabel(d: Date): string {
  return `${WEEKDAY_SHORT[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// « 10 août » — French date label of a férié chip
const MONTH_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
function ferieLabel(iso: string): string {
  const d = parseLocalDate(iso);
  const day = d.getDate() === 1 ? '1er' : String(d.getDate());
  return `${day} ${MONTH_SHORT[d.getMonth()]}`;
}

const HALF_DAYS: { key: 'morning' | 'afternoon'; label: string }[] = [
  { key: 'morning', label: 'Matin' },
  { key: 'afternoon', label: 'Après-midi' },
];

// Cell palette state -> CSS class (annual-… styles in style.css, palette
// decided 2026-10-03 — Excel hues accessibility-adjusted)
const STATE_CLASS: Record<string, string> = {
  presence: 'st-presence',
  absence: 'st-absence',
  mission: 'st-mission',
  remote: 'st-remote',
  arrangement: 'st-arrangement',
  leaveRequest: 'st-leaveRequest',
  jdm: 'st-jdm',
  workAbsence: 'st-workAbsence',
};

// Suggestions of the free-text legend note (codes decoded from the Excel file)
const FREE_TEXT_SUGGESTIONS = ['Réf. WE', 'JDM', 'Stop Motion', 'offre anniv', 'Montréal', 'RDV aux Jardins'];

export default function AnnualView() {
  const { state, dispatch, commit } = useData();
  const { data, currentDate } = state;

  // Displayed year: the app's global date's year by default (route sync);
  // the year segmented control overrides it while browsing.
  const [year, setYear] = useState(() => currentDate.getFullYear());
  // Follow the global date's year when it changes from elsewhere (another
  // view navigates to a different year and comes back).
  useEffect(() => {
    setYear(currentDate.getFullYear());
  }, [currentDate.getFullYear()]);

  // Route focus: the day row of the global date is highlighted + scrolled
  // into view. Re-runs when the global date changes (arriving from another
  // view lands on the same focused day).
  const focusIso = toLocalDateString(currentDate);
  const focusRef = useRef<HTMLTableRowElement | null>(null);
  useEffect(() => {
    // Only when the focused day belongs to the DISPLAYED year: a date in
    // another year has no row to focus (the year control shows it).
    if (focusRef.current) {
      focusRef.current.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
    }
  }, [focusIso, year]);

  // Inactive mediators hidden by default (decision 2026-10-04, #17)
  const [showInactive, setShowInactive] = useState(false);

  // Férié panel: open state + the date input of the add form
  const [ferieDate, setFerieDate] = useState('');
  const holidayOverrides: AnnualHolidayOverrides = data.annualHolidayOverrides ?? {};

  // ---- Column model: active mediators first, inactive revealed by the
  // toggle (never mixed: hidden = not rendered at all, per the decision) ----
  const activeMediators = data.mediators.filter((m) => m.active);
  const inactiveMediators = data.mediators.filter((m) => !m.active);
  const columns: Mediator[] = showInactive
    ? [...activeMediators, ...inactiveMediators]
    : activeMediators;

  // Per-mediator lookup of the active cycle (one active cycle per mediator)
  const cycleByMediator = useMemo(() => {
    const map = new Map<string, WorkCycle | undefined>();
    for (const m of data.mediators) {
      map.set(m.id, m.activeCycleId ? data.cycles.find((c) => c.id === m.activeCycleId) : undefined);
    }
    return map;
  }, [data.mediators, data.cycles]);

  // Valued-Saturday threshold (valorisation): counters >= threshold render
  // in the valued style. Defaults when no config is persisted.
  const valorisation = data.valorisation ?? defaultValorisationConfig();

  // ---- Row model: every day of the year, weekends included --------------
  const days = useMemo(() => {
    const list: Date[] = [];
    const cursor = new Date(year, 0, 1);
    while (cursor.getFullYear() === year) {
      list.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return list;
  }, [year]);

  // Days grouped per ISO week, Monday-anchored: a partial first/last week
  // (Jan 1 falling mid-week) is its own group, labeled like the reference
  // Excel (S 1 of 2026 starts on Mon 2025-12-29 — the group holds Jan 1-4).
  // The week cell of the group's FIRST row spans all the group's rows
  // (rowspan = group length, not always 7).
  const weekGroups = useMemo(() => {
    const groups: { label: string; mondayIso: string; days: Date[] }[] = [];
    for (const d of days) {
      const monday = new Date(d);
      monday.setDate(monday.getDate() - ((d.getDay() + 6) % 7));
      const mondayIso = toLocalDateString(monday);
      const label = `S ${Number(isoWeekKey(d).split('-W')[1])}`;
      const last = groups[groups.length - 1];
      if (last && last.mondayIso === mondayIso) {
        last.days.push(d);
      } else {
        groups.push({ label, mondayIso, days: [d] });
      }
    }
    return groups;
  }, [days]);

  // Férié chips of the panel + per-day row states
  const ferieChips = useMemo(
    () => annualHolidayPanelList(year, holidayOverrides),
    [year, holidayOverrides]
  );
  const dayState = useMemo(() => {
    const map = new Map<string, 'holiday' | 'museumClosed' | null>();
    for (const d of days) map.set(toLocalDateString(d), annualHolidayState(d, holidayOverrides));
    return map;
  }, [days, holidayOverrides]);

  // Quarter of the displayed moment (quota balance display)
  const quarter = quarterOfDate(currentDate);

  // ---- Férié panel operations (immutable ops + one undoable commit) ----
  const commitOverrides = (next: AnnualHolidayOverrides) => {
    const nextData = { ...data, annualHolidayOverrides: next };
    dispatch({ type: 'SET_DATA', data: nextData });
    commit(nextData, 'Fériés modifiés (tableau)');
  };
  const addFerie = () => {
    if (!ferieDate || Number(ferieDate.slice(0, 4)) !== year) return;
    commitOverrides(addHolidayDerogation(holidayOverrides, String(year), ferieDate));
    setFerieDate('');
  };
  const removeFerie = (iso: string) => {
    commitOverrides(removeHolidayDerogation(holidayOverrides, String(year), iso));
  };
  const resetFerie = (iso: string) => {
    commitOverrides(resetHolidayDerogation(holidayOverrides, String(year), iso));
  };

  // ---- Cell editing (slice 4): context menu + paint mode -----------------
  //
  // One undoable commit per edited/painted cell (decision 2026-10-03):
  // dispatch + commit with the label of the applied value.
  const [menuTarget, setMenuTarget] = useState<AnnualCellTarget | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  // Paint mode: the value to duplicate on each click (the last picked code).
  // Click-by-click only — no drag painting (decision 2026-10-03).
  const [paintValue, setPaintValue] = useState<string | null>(null);
  // The last code chip picked in the view: « Peindre ce code » duplicates it
  // (paint is activated FROM the menu, after a value was chosen).
  const [lastPickedCode, setLastPickedCode] = useState('CA');
  const gridRef = useRef<HTMLDivElement | null>(null);

  const applyEntry = (
    mediatorId: string,
    iso: string,
    halfDay: 'morning' | 'afternoon',
    entry: { type: import('../domain/types').AbsenceType; notes: string }
  ) => {
    const absences = setHalfDayException(data.absences, { mediatorId, date: iso, halfDay, type: entry.type, notes: entry.notes });
    const nextData = { ...data, absences };
    dispatch({ type: 'SET_DATA', data: nextData });
    commit(nextData, `Tableau : ${entry.notes} (${iso})`);
  };

  const clearCell = (target: AnnualCellTarget) => {
    const absences = clearHalfDayException(data.absences, target.mediatorId, target.date, target.halfDay);
    const nextData = { ...data, absences };
    dispatch({ type: 'SET_DATA', data: nextData });
    commit(nextData, `Tableau : effacement (${target.date})`);
  };

  const pickCode = (code: string) => {
    if (!menuTarget) return;
    setLastPickedCode(code);
    const entry = annualMenuChoice(code);
    if (entry) applyEntry(menuTarget.mediatorId, menuTarget.date, menuTarget.halfDay, entry);
  };

  const pickFreeText = (text: string) => {
    if (!menuTarget) return;
    const entry = annualFreeTextEntry(text);
    if (entry) applyEntry(menuTarget.mediatorId, menuTarget.date, menuTarget.halfDay, entry);
  };

  // Cell click: paint mode duplicates the value; otherwise open the menu
  // near the click, clamped so the 260px-wide, ~330px-tall menu stays
  // inside the viewport (fixed positioning, above the sticky grid).
  // `pos` carries the anchor coordinates: the click point for mouse, or
  // the cell's own bounding box for keyboard activation (React keyboard
  // events carry no clientX/clientY).
  const cellClick = (m: Mediator, iso: string, halfDay: 'morning' | 'afternoon', pos: { x: number; y: number }) => {
    if (paintValue) {
      const entry = annualMenuChoice(paintValue);
      if (entry) applyEntry(m.id, iso, halfDay, entry);
      return;
    }
    setMenuTarget({ mediatorId: m.id, mediatorName: `${m.firstName} ${m.lastName}`, date: iso, halfDay });
    setMenuPos({
      top: Math.min(pos.y, window.innerHeight - 340),
      left: Math.min(pos.x, window.innerWidth - 270),
    });
  };

  // Escape: closes the menu, then exits paint mode (feature scenarios).
  // A mousedown outside the grid card does the same.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (menuTarget) return; // the menu's own handler closes it (stopPropagation)
      if (paintValue) setPaintValue(null);
    };
    const onDown = (e: MouseEvent) => {
      if (gridRef.current && !gridRef.current.contains(e.target as Node)) {
        setMenuTarget(null);
        setPaintValue(null);
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [menuTarget, paintValue]);

  // ---- Navigation (decisions 2026-10-04): week label -> weekly view on
  // that ISO week; day label -> daily view on that date -------------------
  const gotoDay = (iso: string) => {
    dispatch({ type: 'SET_VIEW', view: 'daily' });
    dispatch({ type: 'SET_CURRENT_DATE', date: parseLocalDate(iso) });
  };
  const gotoWeek = (mondayIso: string) => {
    dispatch({ type: 'SET_VIEW', view: 'weekly' });
    dispatch({ type: 'SET_CURRENT_DATE', date: parseLocalDate(mondayIso) });
  };

  const empty = data.mediators.length === 0;

  // ---- Excel export (slice 5, decisions 2026-10-03 #11 + 2026-10-04
  // #18-21): the DISPLAYED year, the columns as shown (hidden inactive
  // mediators are NOT exported — the toggle state at export time is law),
  // codes as full text, counters in the Saturday cells, legend fills.
  // Fully client-side: SheetJS in the browser, no network request.
  const exportExcel = () => {
    const model = buildAnnualExportModel(data, year, {
      includeInactive: showInactive,
      holidayOverrides,
    });
    const bytes = writeAnnualExcel(model);
    // Copy into a plain ArrayBuffer (TS BlobPart rejects ArrayBufferLike)
    const buffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buffer).set(bytes);
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = annualExportFilename(year);
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="annual-view">
      <div className="toolbar">
        <h2>Tableau de fonctionnement</h2>
        <div className="annual-toolbar-controls">
          <span className="year-seg" role="group" aria-label="Année affichée">
            {[year - 1, year, year + 1].map((y) => (
              <button
                key={y}
                type="button"
                className={y === year ? 'active' : ''}
                aria-pressed={y === year}
                onClick={() => setYear(y)}
              >
                {y}
              </button>
            ))}
          </span>
          <label className={`toggle-inactive ${showInactive ? 'checked-state' : ''}`}>
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
            <span>Médiateurs désactivés</span>
          </label>
          <button
            className="btn btn-secondary annual-export-btn"
            type="button"
            title="Export Excel au format de la table de référence — textes complets (pas d'abréviations), compteurs de samedis inclus, médiateurs désactivés masqués exclus — pas d'impression/PDF en v1"
            onClick={exportExcel}
          >
            ⇩ Exporter Excel
          </button>
        </div>
      </div>
      <p className="annual-toolbar-note">
        Lignes = tous les jours de l'année, week-ends compris ; une cellule par
        demi-journée (Matin · Après-midi). {activeMediators.length} médiateur
        {activeMediators.length === 1 ? '' : 's'} actif
        {activeMediators.length === 1 ? '' : 's'} affiché
        {activeMediators.length === 1 ? '' : 's'}
        {inactiveMediators.length > 0 && !showInactive
          ? ` ; ${inactiveMediators.length} désactivé${inactiveMediators.length === 1 ? '' : 's'} masqué${inactiveMediators.length === 1 ? '' : 's'} par défaut`
          : ''}
        . Clic sur une demi-journée → menu des codes, texte libre, effacement,
        peinture.
      </p>

      {/* Paint-mode banner (decision 2026-10-03): the duplicated value +
          exit affordances (Esc, click outside the grid, ✕ Quitter). */}
      {paintValue && (
        <div className="annual-paint-banner" role="status">
          <span aria-hidden="true">🖌</span>
          <span>Peinture : <strong>{paintValue}</strong> — cliquez les cellules à remplir, Échap pour quitter.</span>
          <span className="bp-spacer"></span>
          <button
            className="btn-exit-paint"
            type="button"
            title="Quitter le mode peinture (Échap ou clic hors de la grille)"
            onClick={() => setPaintValue(null)}
          >
            ✕ Quitter
          </button>
        </div>
      )}

      {/* Collapsible legend — palette decided 2026-10-03 */}
      <details className="annual-legend-box">
        <summary>Légende (couleurs et codes)</summary>
        <div className="annual-legend-body">
          <span className="lg"><span className="sw sw-presence"></span>Orange vide = présence dérivée du cycle (calculée, jamais stockée)</span>
          <span className="lg"><span className="sw sw-absence"></span>Jaune + code = absence (CA, RHS, RTT, AM, CET, CEX, TPT, congé parental / maternité / naissance, dispo)</span>
          <span className="lg"><span className="sw sw-remote"></span>Rose + TELE = télétravail</span>
          <span className="lg"><span className="sw sw-arrangement"></span>Violet + amgt JJ/MM = aménagement d'un jour travaillé (exception au cycle)</span>
          <span className="lg"><span className="sw sw-leaveRequest"></span>Bleu + code = souhait en attente (CA, RHS, RTT — demande non confirmée, distinct du congé posé en jaune)</span>
          <span className="lg"><span className="sw sw-mission"></span>Orange + texte = mission / événement (Réf. WE, stop motion, offre anniv, privatisation)</span>
          <span className="lg"><span className="sw sw-jdm"></span>Vert + JDM = mission aux Jardins du muséum (mission, pas une absence)</span>
          <span className="lg"><span className="sw sw-workAbsence"></span>Rouge + code = absence liée au travail (grève, syndicat, formation)</span>
          <span className="lg"><span className="sw sw-neutral"></span>Blanc = neutre (jour non travaillé ou médiateur sans cycle)</span>
          <span className="lg"><span className="sw sw-closed"></span>Hachures = musée fermé (25/12, 01/01, 01/05)</span>
          <span className="lg"><span className="sw sw-ferie"></span>Fond ambre = jour férié (liste française par défaut, modifiable par dérogation et par année)</span>
          <span className="lg"><span className="ct-sw">S1</span>Pilule de semaine de cycle — une fois par semaine ISO, sur la cellule du lundi, valable pour toute la semaine</span>
          <span className="lg"><span className="ct-sw">×N</span>Compteur de samedis travaillés (calculé, alimente la valorisation à partir du seuil — vert : samedi valorisé)</span>
          <span className="lg"><span className="pill quota-ok">reliquat</span>/<span className="pill quota-ko">déficit</span>Solde trimestriel (médiateurs avec aménagement)</span>
          <span className="lg" style={{ width: '100%' }}>Abréviations dans les cellules — le survol (title) affiche le texte complet ({FREE_TEXT_SUGGESTIONS.slice(0, 3).join(', ')}…)</span>
        </div>
      </details>

      {/* Férié panel (toolbar zone): default French list + per-year
          dérogations — add/remove/reset, committed undoably */}
      <details className="annual-ferie-box">
        <summary>Fériés {year} — dérogations par année</summary>
        <div className="annual-ferie-body">
          <p className="annual-ferie-line">
            Liste française par défaut, calculée pour {year}. Ajout / retrait en
            dérogation, propre à cette année ({year + 1} suivra sa liste par
            défaut).
          </p>
          <div className="annual-chiplist">
            {ferieChips.map((chip) => {
              const label = chip.name || ferieLabel(chip.date);
              return (
                <span
                  key={chip.date}
                  className={`annual-chip ${chip.status === ANNUAL_FERIE_ADDED ? 'added' : ''} ${chip.status === ANNUAL_FERIE_REMOVED ? 'removed' : ''}`}
                  title={`${chip.date}${chip.name ? ' — ' + chip.name : ''}`}
                >
                  {label}
                  {chip.status === ANNUAL_FERIE_REMOVED ? (
                    <button
                      type="button"
                      title={`Rétablir ${label}`}
                      onClick={() => resetFerie(chip.date)}
                    >
                      ↺
                    </button>
                  ) : (
                    <button
                      type="button"
                      title={`Retirer ${label} des fériés de ${year}`}
                      onClick={() => removeFerie(chip.date)}
                    >
                      ✕
                    </button>
                  )}
                </span>
              );
            })}
          </div>
          <div className="annual-ferie-form">
            <label htmlFor="annual-new-ferie">Férié {year} :</label>
            <input
              id="annual-new-ferie"
              type="date"
              className="date-input"
              value={ferieDate}
              min={`${year}-01-01`}
              max={`${year}-12-31`}
              onChange={(e) => setFerieDate(e.target.value)}
              aria-label={`Date du nouveau férié ${year}`}
            />
            <button
              className="btn btn-primary annual-ferie-add"
              type="button"
              onClick={addFerie}
            >
              + Ajouter la date
            </button>
            <span className="annual-ferie-line">— le marquage par défaut des autres jours fériés est inchangé</span>
          </div>
        </div>
      </details>

      {empty ? (
        <div className="annual-card">
          <div className="empty-state">
            <span className="es-icon" aria-hidden="true">🗓️</span>
            <h3>Aucun médiateur</h3>
            <p>Aucun médiateur défini : créez-en un dans la vue Médiateurs pour alimenter le tableau.</p>
          </div>
        </div>
      ) : (
        <div className={`annual-card ${paintValue ? 'painting' : ''}`} ref={gridRef}>
          <div className="grid-wrap">
            <table className="agrid" aria-label={`Tableau de fonctionnement ${year}`}>
              <colgroup>
                <col style={{ width: 48 }} />
                <col style={{ width: 108 }} />
                {columns.map((m) => (
                  <col key={m.id} style={{ width: 30 }} span={2} />
                ))}
              </colgroup>
              <thead>
                <tr className="thead-row">
                  <th className="wkcol" scope="col"><span className="wkcol-head">Sem.</span></th>
                  <th className="date" scope="col">
                    <span className="d-day muted">Date</span>
                    <span className="d-day small">Matin · Après-midi</span>
                  </th>
                  {columns.map((m) => {
                    const quota = m.arrangement
                      ? computeQuarterlyBalance(m, data.slots, data.quotas, valorisation, year, quarter)
                      : null;
                    return (
                      <th
                        key={m.id}
                        className={`mh ${m.active ? '' : 'inactive'}`}
                        colSpan={2}
                        scope="col"
                        title={m.active ? undefined : 'Médiateur désactivé (Mediator.active === false) — masqué par défaut, révélé par la case « Médiateurs désactivés »'}
                      >
                        <span className="mname">{m.firstName} {m.lastName}</span>
                        {!m.active && <span className="dchip dchip-inactive">(désactivé)</span>}
                        {m.contractType && <span className="pill pill-contract">{m.contractType}</span>}
                        {quota && (
                          <span className="mquota">
                            <span
                              className={`pill ${quota.balance >= 0 ? 'quota-ok' : 'quota-ko'}`}
                              title="Solde trimestriel calculé par computeQuarterlyBalance — quota configurable par trimestre"
                            >
                              T{quarter} : {quota.balance >= 0 ? 'reliquat' : 'déficit'} {quota.balance >= 0 ? '+' : ''}{quota.balance} h
                            </span>
                          </span>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {weekGroups.map((group) =>
                  group.days.map((d, dayIndex) => {
                  const iso = toLocalDateString(d);
                  const rowState = dayState.get(iso) ?? null;
                  const isFocus = iso === focusIso;
                  const isSaturday = d.getDay() === 6;
                  const isMonday = d.getDay() === 1;
                  return (
                    <tr
                      key={iso}
                      id={`annual-row-${iso}`}
                      ref={isFocus ? focusRef : undefined}
                      className={[
                        rowState === 'holiday' ? 'ferie' : '',
                        rowState === 'museumClosed' ? 'closed' : '',
                        isFocus ? 'route-focus' : '',
                      ].filter(Boolean).join(' ')}
                    >
                      {dayIndex === 0 && (
                        <th className="wkcol" rowSpan={group.days.length} scope="rowgroup">
                          <button
                            type="button"
                            className="wk-btn"
                            title={`Ouvrir la vue hebdo — ${group.label}`}
                            onClick={() => gotoWeek(group.mondayIso)}
                          >
                            {group.label}
                          </button>
                        </th>
                      )}
                      <th className="date" scope="row">
                        <button type="button" className="day-btn" title={`Ouvrir la vue jour — ${iso}`} onClick={() => gotoDay(iso)}>
                          {dayLabel(d)}
                        </button>
                        {rowState === 'holiday' && <span className="dchip dchip-ferie">Férié</span>}
                        {rowState === 'museumClosed' && (
                          <>
                            <span className="dchip dchip-ferie">Férié</span>
                            <span className="dchip dchip-closed">Fermé</span>
                          </>
                        )}
                        {isFocus && (
                          <span className="route-chip" title="Ligne ciblée par la date de la route (?date=…) — mise en évidence + défilement">●</span>
                        )}
                      </th>
                      {columns.map((m) => {
                        const cycle = cycleByMediator.get(m.id);
                        return HALF_DAYS.map(({ key }, i) => {
                          const cell = m.active
                            ? deriveAnnualCell(m.id, d, key, {
                                cycle,
                                absences: data.absences,
                              })
                            : null;
                          const isMondayCell = isMonday && i === 0;
                          const cyclePill =
                            isMondayCell && cycle ? cycleWeekForDate(cycle, d)?.name : null;
                          const counter = isSaturday && m.active && key === 'morning'
                            ? workedSaturdayCounter(m.id, data.slots, d)
                            : null;
                          const valued = counter !== null && counter >= valorisation.valuedSaturdayThreshold;
                          return (
                            <td
                              key={`${m.id}-${key}`}
                              className={`c ${cell ? STATE_CLASS[cell.state] ?? '' : 'st-neutral'}`}
                              title={cell?.code ? cell.code : undefined}
                              role="button"
                              tabIndex={0}
                              aria-label={`${m.firstName} ${m.lastName} — ${iso} ${key === 'morning' ? 'Matin' : 'Après-midi'}${cell?.code ? ` — ${cell.code}` : ''}`}
                              onClick={(e) => cellClick(m, iso, key, { x: e.clientX, y: e.clientY })}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  const r = e.currentTarget.getBoundingClientRect();
                                  cellClick(m, iso, key, { x: r.left + r.width / 2, y: r.top });
                                }
                              }}
                            >
                              {counter !== null && (
                                <span
                                  className={`ct ${valued ? 'valued' : ''} ${counter === 0 ? 'zero' : ''}`}
                                  title={`${counter === 0 ? 'Aucun samedi' : ordinal(counter) + ' samedi'} travaillé${valued ? ' — valorisé' : ` — valorisé à partir du ${valorisation.valuedSaturdayThreshold}ᵉ`}`}
                                >
                                  ×{counter}
                                </span>
                              )}
                              {cyclePill && <span className="cycp">{cyclePill}</span>}
                              {cell?.code}
                            </td>
                          );
                        });
                      })}
                    </tr>
                  );
                  })
                )}
              </tbody>
            </table>
          </div>
          {/* Context menu of the clicked half-day cell — fixed at the click
              position (clamped to the viewport), above the sticky grid
              columns, below modals. */}
          {menuTarget && menuPos && (
            <div
              style={{ position: 'fixed', top: Math.max(8, menuPos.top), left: Math.max(8, menuPos.left), zIndex: 150 }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <AnnualCellMenu
                target={menuTarget}
                paintCode={lastPickedCode}
                onPickCode={pickCode}
                onPickFreeText={pickFreeText}
                onClear={clearCell}
                onPaint={(code) => setPaintValue(code)}
                onClose={() => setMenuTarget(null)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// 1er, 2e, 3e… — French ordinal of the Saturday counter tooltip
function ordinal(n: number): string {
  return n === 1 ? '1er' : `${n}e`;
}
