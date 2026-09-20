// WeeklyView.tsx — Vue hebdomadaire (anciennement CalendarView)
import { useState, useMemo } from 'react';
import { useData, getWeekStart } from './DataContext';
import {
  ABSENCE_TYPE_LABELS,
  getAbsenceTimeRange,
  getSlotPlanningStatus,
  toLocalDateString,
} from '../domain/models';
import type { SlotPlanningStatus } from '../domain/models';
import type { Slot, Absence } from '../domain/types';
import { useViewportPxPerHour } from './useElementWidth';
import SlotModal from './SlotModal';
import SlotDetailModal from './SlotDetailModal';

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const HOURS = Array.from({ length: 12 }, (_, i) => i + 8); // 8h à 19h
const FALLBACK_PX_PER_HOUR_V = 40; // before measurement / jsdom

// Planning status labels, colors and severity (weekly view).
// Severity order drives legend, stats AND visual weight:
//   À assigner (hatched red) > Indisponibilité (red) > Incompétent (amber)
//   > En apprentissage (pale yellow info) > OK (quiet green)
const STATUS_LABELS: Record<SlotPlanningStatus, string> = {
  ok: 'OK',
  unassigned: 'À assigner',
  dispo_issue: 'Indisponibilité',
  learning: 'En apprentissage',
  incompetent: 'Incompétent',
};
const STATUS_BG: Record<SlotPlanningStatus, string> = {
  ok: '#e8f5e9',          // quiet green
  unassigned: '#f8d7da',  // red base (hatched via CSS class)
  dispo_issue: '#f8d7da', // red
  learning: '#fff8e1',    // pale yellow (info)
  incompetent: '#ffe9c7', // amber warning
};
const STATUS_ORDER: SlotPlanningStatus[] = ['unassigned', 'dispo_issue', 'incompetent', 'learning', 'ok'];
const STATUS_SHORT: Record<SlotPlanningStatus, string> = {
  ok: 'OK',
  unassigned: 'À assigner',
  dispo_issue: 'Indispo.',
  learning: 'Apprentissage',
  incompetent: 'Incompétent',
};

// Compact emoji per status — used when lanes are too narrow for text
const STATUS_EMOJI: Record<SlotPlanningStatus, string> = {
  ok: '✔️',
  unassigned: '❌',
  dispo_issue: '🚫',
  learning: '📚',
  incompetent: '⚠️',
};

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export default function WeeklyView() {
  const { state, dispatch } = useData();
  const { data, currentDate, filters, locked, showAbsences } = state;

  // Week displayed = week containing the global currentDate
  const currentWeekStart = useMemo(() => getWeekStart(currentDate), [currentDate]);

  // Responsive vertical scale: fill the viewport height with the 11h day grid
  const pxPerHourV = useViewportPxPerHour(HOURS.length - 1, FALLBACK_PX_PER_HOUR_V);

  // Modal state
  const [slotModal, setSlotModal] = useState<{
    slot: Slot | null;
    mediatorOnly: boolean;
    defaultDate: string;
  } | null>(null);
  const [detailSlot, setDetailSlot] = useState<Slot | null>(null);

  const todayStr = new Date().toISOString().slice(0, 10);

  // Filter slots
  const filteredSlots = useMemo(() => {
    let slots = data.slots;
    if (filters.mediatorId) slots = slots.filter((s) => s.mediatorIds.includes(filters.mediatorId));
    if (filters.offerId) slots = slots.filter((s) => s.offerId === filters.offerId);
    return slots;
  }, [data.slots, filters.mediatorId, filters.offerId]);

  // Period label
  const periodLabel = useMemo(() => {
    const end = new Date(currentWeekStart);
    end.setDate(end.getDate() + 6);
    const fmt = (d: Date) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    return `${fmt(currentWeekStart)} – ${fmt(end)}`;
  }, [currentWeekStart]);

  // Day data
  const dayData = useMemo(() => {
    const days: {
      dateStr: string;
      daySlots: Slot[];
      dayAbsences: Absence[];
    }[] = [];

    for (let i = 0; i < 7; i++) {
      const d = new Date(currentWeekStart);
      d.setDate(d.getDate() + i);
      const ds = toLocalDateString(d);

      const daySlots = filteredSlots
        .filter((s) => s.date === ds)
        .sort((a, b) => a.startTime.localeCompare(b.startTime));

      let dayAbsences: Absence[] = [];
      if (showAbsences) {
        dayAbsences = data.absences
          .filter((a) => {
            if (filters.mediatorId && a.mediatorId !== filters.mediatorId) return false;
            return ds >= a.startDate && ds <= a.endDate;
          })
          .map(abs => {
            const timeRange = getAbsenceTimeRange(abs, data.halfDayConfig);
            return { ...abs, startTime: timeRange.startTime, endTime: timeRange.endTime };
          });
      }

      days.push({ dateStr: ds, daySlots, dayAbsences });
    }
    return days;
  }, [currentWeekStart, filteredSlots, data.absences, showAbsences, filters.mediatorId]);

  // Compute parallel lanes for a day's slots
  function computeLanes(slots: Slot[]): Slot[][] {
    const lanes: Slot[][] = [];
    const sorted = [...slots].sort((a, b) => a.startTime.localeCompare(b.startTime));
    for (const slot of sorted) {
      const startMin = toMinutes(slot.startTime);
      let placed = false;
      for (const lane of lanes) {
        const last = lane[lane.length - 1];
        if (toMinutes(last.endTime) <= startMin) {
          lane.push(slot);
          placed = true;
          break;
        }
      }
      if (!placed) lanes.push([slot]);
    }
    return lanes;
  }

  function handleSlotClick(slot: Slot) {
    if (locked) {
      setSlotModal({ slot, mediatorOnly: true, defaultDate: slot.date });
    } else {
      setSlotModal({ slot, mediatorOnly: false, defaultDate: slot.date });
    }
  }

  function handleDayClick(dateStr: string, e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest('.cal-slot')) return;
    if (locked) return;
    setSlotModal({ slot: null, mediatorOnly: false, defaultDate: dateStr });
  }

  function changeWeek(delta: number) {
    // Move the global date by whole weeks, keeping the same weekday.
    // The displayed week is derived from currentDate.
    const d = new Date(currentDate);
    d.setDate(d.getDate() + delta * 7);
    dispatch({ type: 'SET_CURRENT_DATE', date: d });
  }

  function goToToday() {
    dispatch({ type: 'SET_CURRENT_DATE', date: new Date() });
  }

  // Weekly planning stats: count slots per status (filtered ones only)
  const weekStats = useMemo(() => {
    const counts: Record<SlotPlanningStatus, number> = {
      ok: 0, unassigned: 0, dispo_issue: 0, learning: 0, incompetent: 0,
    };
    for (const dd of dayData) {
      for (const s of dd.daySlots) {
        counts[getSlotPlanningStatus(s, data)]++;
      }
    }
    return counts;
  }, [dayData, data]);

  return (
    <div className="view active">
      <div className="toolbar">
        <div className="toolbar-left">
          <h2>Plan Hebdo</h2>
          <button className="btn btn-secondary" id="btn-prev-week" onClick={() => changeWeek(-1)}>
            ←
          </button>
          <span className="period-label" id="period-label">{periodLabel}</span>
          <button className="btn btn-secondary" id="btn-next-week" onClick={() => changeWeek(1)}>
            →
          </button>
          <button className="btn btn-secondary" id="btn-today" onClick={goToToday}>
            Aujourd'hui
          </button>
          {/* Weekly stats badge */}
          <div className="week-stats" id="week-stats">
            {STATUS_ORDER.map((st) => (
              <span key={st} className={`week-stat week-stat-${st}`} title={STATUS_LABELS[st]}>
                <span className="week-stat-dot" style={{ background: STATUS_BG[st] }}></span>
                {weekStats[st]}
              </span>
            ))}
          </div>
        </div>
        <div className="toolbar-right">
          <select
            className="select"
            id="filter-mediator"
            value={filters.mediatorId}
            onChange={(e) => dispatch({ type: 'SET_FILTER_MEDIATOR', mediatorId: e.target.value })}
          >
            <option value="">Tous les médiateurs</option>
            {data.mediators.map((m) => (
              <option key={m.id} value={m.id}>
                {m.firstName} {m.lastName}
              </option>
            ))}
          </select>
          <select
            className="select"
            id="filter-offer"
            value={filters.offerId}
            onChange={(e) => dispatch({ type: 'SET_FILTER_OFFER', offerId: e.target.value })}
          >
            <option value="">Toutes les offres</option>
            {data.offers.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          <label className="toggle-switch">
            <input
              type="checkbox"
              id="toggle-absences"
              checked={showAbsences}
              onChange={(e) => dispatch({ type: 'SET_SHOW_ABSENCES', show: e.target.checked })}
            />
            <span className="toggle-slider"></span>
            <span className="toggle-label">Absences</span>
          </label>
          <label className="toggle-switch">
            <input
              type="checkbox"
              id="toggle-edit-mode"
              checked={!locked}
              onChange={(e) => {
                const checked = e.target.checked;
                if (checked) {
                  if (
                    !confirm(
                      '⚠️ Activer le mode modification permet de modifier les créneaux.\n\nLes offres importées pourront être éditées et seront marquées comme "modifiées après import".\n\nContinuer ?'
                    )
                  ) {
                    e.target.checked = false;
                    return;
                  }
                  dispatch({ type: 'SET_LOCKED', locked: false });
                } else {
                  dispatch({ type: 'SET_LOCKED', locked: true });
                }
              }}
            />
            <span className="toggle-slider"></span>
            <span className="toggle-label">Mode modification</span>
          </label>
        </div>
      </div>

      <div className="calendar-wrapper">
        <div className="calendar-grid">
          {/* Header row */}
          <div className="cal-header">
            <div></div>
            {dayData.map((dd, i) => {
              const d = new Date(currentWeekStart);
              d.setDate(d.getDate() + i);
              const isToday = dd.dateStr === todayStr;
              return (
                <div key={dd.dateStr} className={`cal-day-name ${isToday ? 'cal-today' : ''}`}>
                  <span>{DAYS[i]}</span>
                  <span className="cal-day-num">{d.getDate()}</span>
                </div>
              );
            })}
          </div>

          {/* Time column */}
          <div className="cal-time-col">
            {HOURS.map((h) => (
              <div key={h} className="cal-time-label" style={{ height: `${pxPerHourV}px` }}>
                {h.toString().padStart(2, '0')}:00
              </div>
            ))}
          </div>

          {/* Day columns */}
          {dayData.map((dd) => {
            const lanes = computeLanes(dd.daySlots);
            const laneCount = lanes.length;

            return (
              <div
                key={dd.dateStr}
                className="cal-day-col"
                data-date={dd.dateStr}
                style={{ minHeight: `${(HOURS.length - 1) * pxPerHourV}px` }}
                onClick={(e) => handleDayClick(dd.dateStr, e)}
              >
                {/* Absence banners */}
                {dd.dayAbsences.map((abs) => {
                  const mediator = data.mediators.find((m) => m.id === abs.mediatorId);
                  const label = ABSENCE_TYPE_LABELS[abs.type] || abs.type;
                  const medName = mediator ? `${mediator.firstName} ${mediator.lastName}` : '—';
                  
                  // Calculate position based on startTime/endTime
                  const startMinutes = toMinutes(abs.startTime || '00:00');
                  const endMinutes = toMinutes(abs.endTime || '23:59');

                  // Day column height scales with the viewport
                  const DAY_HEIGHT = (HOURS.length - 1) * pxPerHourV;
                  const MINUTES_PER_PX = DAY_HEIGHT / (11 * 60);

                  const top = (startMinutes - 8 * 60) * MINUTES_PER_PX;
                  const height = (endMinutes - startMinutes) * MINUTES_PER_PX;
                  
                  return (
                    <div
                      key={abs.id}
                      className={`cal-absence absence-${abs.type}`}
                      style={{ top: `${top}px`, height: `${Math.max(height - 4, 16)}px` }}
                      title={`${medName} — ${label} (${abs.startTime || '00:00'} – ${abs.endTime || '23:59'})`}
                    >
                      <span className="absence-label">🚫 {medName} — {label}</span>
                    </div>
                  );
                })}

                {/* Slots in lanes */}
                {lanes.map((laneSlots, laneIdx) =>
                  laneSlots.map((slot) => {
                    const offer = data.offers.find((o) => o.id === slot.offerId);
                    const mediator = data.mediators.find((m) => m.id === slot.mediatorIds[0]);
                    const planningStatus = getSlotPlanningStatus(slot, data);
                    const originIcon = slot.origin === 'imported' ? (slot.modifiedAfterImport ? ' 📥✏' : ' 📥') : ' ✋';
                    const mediatorColor = mediator ? mediator.color || '#ccc' : '#ccc';
                    const mediatorBadge = mediator ? (
                      <span className="slot-mediator-dot" style={{ background: mediatorColor }}></span>
                    ) : null;

                    const startMin = toMinutes(slot.startTime);
                    const endMin = toMinutes(slot.endTime);
                    const top = (startMin - 8 * 60) * (pxPerHourV / 60);
                    const heightCalc = (endMin - startMin) * (pxPerHourV / 60);
                    const widthPct = laneCount > 1 ? 100 / laneCount : 100;
                    const leftPct = laneIdx * widthPct;

                    // Native tooltip: everything a coordinator needs at a glance
                    const statusDetail = (() => {
                      if (planningStatus === 'unassigned') return 'Aucun médiateur assigné';
                      const medNames = slot.mediatorIds
                        .map((id) => {
                          const m = data.mediators.find((mm) => mm.id === id);
                          return m ? `${m.firstName} ${m.lastName}` : id;
                        })
                        .join(', ');
                      if (planningStatus === 'dispo_issue')
                        return `Médiateur(s) indisponible(s) : ${medNames}`;
                      if (planningStatus === 'learning')
                        return `En formation : ${medNames}`;
                      if (planningStatus === 'incompetent')
                        return `Aucun médiateur compétent : ${medNames}`;
                      return medNames;
                    })();
                    const tooltip = [
                      `${offer ? offer.name : '—'}`,
                      `${slot.startTime} – ${slot.endTime}`,
                      `État : ${STATUS_LABELS[planningStatus]}`,
                      statusDetail,
                      `Origine : ${slot.origin === 'imported' ? 'Importé' : 'Manuel'}`,
                    ].join('\n');

                    return (
                      <div
                        key={slot.id}
                        className={`cal-slot pstatus-${planningStatus} origin-${slot.origin}`}
                        style={{
                          top: `${top}px`,
                          height: `${heightCalc - 2}px`,
                          width: `calc(${widthPct}% - 4px)`,
                          left: `calc(${leftPct}% + 2px)`,
                          background: STATUS_BG[planningStatus],
                          borderLeftColor: mediatorColor,
                        }}
                        data-slot-id={slot.id}
                        title={tooltip}
                        onClick={() => handleSlotClick(slot)}
                      >
                        {laneCount === 1 ? (
                          <>
                            <div className="slot-badges">
                              <span className="slot-badge slot-badge-time">{slot.startTime}–{slot.endTime}</span>
                              <span className="slot-badge slot-badge-title">
                                {offer ? offer.name : '—'}{originIcon}
                              </span>
                              <span className={`slot-badge slot-badge-status sb-${planningStatus}`}>
                                {STATUS_EMOJI[planningStatus]} {STATUS_SHORT[planningStatus]}
                              </span>
                            </div>
                            {mediator && (
                              <div className="slot-mediator">
                                {mediatorBadge}
                                {mediator.firstName} {mediator.lastName}
                              </div>
                            )}
                          </>
                        ) : (
                          // Narrow parallel lane: emoji summary only —
                          // status emoji on top, mediator dot BELOW it
                          <div className="slot-badges slot-badges-compact">
                            <span className="slot-badge-emoji" title={STATUS_LABELS[planningStatus]}>
                              {STATUS_EMOJI[planningStatus]}
                            </span>
                            {mediator && (
                              <span className="slot-mediator-dot slot-mediator-dot-below" style={{ background: mediatorColor }}></span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            );
          })}
          {/* Legend: planning status badges (same emoji + colors as in slots) */}
          <div className="week-legend">
            {STATUS_ORDER.map((st) => (
              <span key={st} className="week-legend-item">
                <span
                  className={`slot-badge slot-badge-status sb-${st}`}
                  style={{ background: STATUS_BG[st] }}
                >
                  {STATUS_EMOJI[st]} {STATUS_LABELS[st]}
                </span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Modals */}
      {slotModal && (
        <SlotModal
          slot={slotModal.slot}
          mediatorOnly={slotModal.mediatorOnly}
          defaultDate={slotModal.defaultDate}
          onClose={() => setSlotModal(null)}
        />
      )}
      {detailSlot && (
        <SlotDetailModal slot={detailSlot} onClose={() => setDetailSlot(null)} />
      )}
    </div>
  );
}
