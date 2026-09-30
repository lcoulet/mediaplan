// ReservationView.tsx — "Plan Accueil": chronological LIST of the
// day's reservations. Same day navigation as the daily view, but no time
// grid and no drag & drop: mediators in the left lane, Secutix-style
// booking summary on the right, rows sorted by ascending block start
// (setup included).
import { useMemo, useState } from 'react';
import { useData } from './DataContext';
import type { Slot } from '../domain/types';
import {
  toLocalDateString,
  getISOWeekNumber,
  formatSlotBookingSummary,
  sortSlotsByBlockStart,
  isFreeVisitOffer,
} from '../domain/models';
import { spaceForSlot, blockTextColor } from '../domain/space-display';
import { offerShortLabel } from '../domain/spaces';
import { usePrint, printDateLine } from './usePrint';
import SlotModal from './SlotModal';

export default function ReservationView() {
  const { state, dispatch } = useData();
  const { data, locked } = state;
  const print = usePrint();

  // Single source of truth: global currentDate (URL-synced by DataProvider)
  const selectedDate = state.currentDate;
  const setSelectedDate = (d: Date) => dispatch({ type: 'SET_CURRENT_DATE', date: d });
  const selectedDateStr = toLocalDateString(selectedDate);

  // Slots for the selected day, sorted by block start (setup included).
  // Free visits (Accueil Libre, no mediator needed) go to their own
  // bottom section instead of the mediated list.
  const { sortedSlots, freeVisitSlots } = useMemo(() => {
    const daySlots = data.slots.filter(slot => slot.date === selectedDateStr);
    const offerById = new Map(data.offers.map(o => [o.id, o]));
    const mediated = daySlots.filter(s => !isFreeVisitOffer(offerById.get(s.offerId)));
    const free = daySlots.filter(s => isFreeVisitOffer(offerById.get(s.offerId)));
    return {
      sortedSlots: sortSlotsByBlockStart(mediated, data.offers),
      freeVisitSlots: sortSlotsByBlockStart(free, data.offers),
    };
  }, [data.slots, data.offers, selectedDateStr]);

  // Modal state
  const [slotModal, setSlotModal] = useState<{
    slot: Slot | null;
    mediatorOnly: boolean;
    defaultDate: string;
  } | null>(null);

  function goToDay(delta: number) {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + delta);
    setSelectedDate(newDate);
  }

  function goToToday() {
    setSelectedDate(new Date());
  }

  function handleModalClose() {
    setSlotModal(null);
  }

  // One list row: left lane (mediators / "Non assigné" / "Libre") and the
  // Secutix-style booking summary on the right. The summary band is
  // colored by the slot's SPACE (spec: the mediator column is untouched);
  // the offer short label appears as the band's first line.
  function renderRow(slot: Slot, lane: React.ReactNode) {
    const offer = data.offers.find(o => o.id === slot.offerId);
    const isImported = slot.origin === 'imported';
    const isFree = isFreeVisitOffer(offer);
    // Free-visit rows keep their current look (spec decision); only the
    // mediated offer bands take the space color.
    const space = isFree ? undefined : spaceForSlot(data.spaces, slot, offer);
    const textColor = space ? blockTextColor(space) : undefined;
    return (
      <div
        key={slot.id}
        className={`res-row${isImported ? ' imported' : ''}${slot.mediatorIds.length === 0 && !isFree ? ' unassigned' : ''}${space ? ' has-space' : ''}`}
        onClick={() => {
          setSlotModal({ slot, mediatorOnly: locked && isImported, defaultDate: slot.date });
        }}
      >
        <div className="res-mediators">{lane}</div>
        <div
          className="res-summary"
          style={space ? { backgroundColor: space.color, color: textColor } : undefined}
        >
          <div className="res-band-label" title={offer ? offerShortLabel(offer) : undefined}>
            {offer ? offerShortLabel(offer) : '—'}
          </div>
          {formatSlotBookingSummary(slot, offer)}
        </div>
      </div>
    );
  }

  return (
    <div className="view active">
      <div className="toolbar">
        <div className="toolbar-left">
          <button className="btn btn-secondary" onClick={() => goToDay(-1)}>←</button>
          <button className="btn btn-secondary" onClick={goToToday}>Aujourd'hui</button>
          <button className="btn btn-secondary" onClick={() => goToDay(1)}>→</button>
          <h2>
            <label className="date-picker-label" title="Changer la date">
              Plan Accueil — Semaine {getISOWeekNumber(selectedDate)} — {selectedDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              <input
                type="date"
                className="date-picker-input"
                value={toLocalDateString(selectedDate)}
                onChange={(e) => {
                  if (e.target.value) {
                    const [y, m, d] = e.target.value.split('-').map(Number);
                    setSelectedDate(new Date(y, m - 1, d));
                  }
                }}
              />
            </label>
          </h2>
        </div>
        <div className="toolbar-right">
          <span className="res-count">
            {sortedSlots.length + freeVisitSlots.length} réservation{sortedSlots.length + freeVisitSlots.length > 1 ? 's' : ''}
          </span>
          <button
            className="btn btn-secondary print-btn"
            id="btn-print-reservations"
            onClick={print}
            title="Imprimer le plan accueil (A4 paysage)"
          >
            🖨️ Imprimer
          </button>
        </div>
      </div>

      {/* Print header: view title + day date (screen-hidden, print-only) */}
      <div className="print-header">
        <h1>
          Plan Accueil — Semaine {getISOWeekNumber(selectedDate)} —{' '}
          {selectedDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </h1>
        <div className="print-date">{printDateLine()}</div>
      </div>

      <div className="res-list">
        <div className="res-header">
          <div className="res-mediators">Médiateurs</div>
          <div className="res-summary">Réservation</div>
        </div>
        {sortedSlots.length === 0 && freeVisitSlots.length === 0 ? (
          <div className="daily-empty">Aucune réservation pour aujourd'hui.</div>
        ) : (
          sortedSlots.map(slot => {
            const mediators = data.mediators.filter(m => slot.mediatorIds.includes(m.id));
            return renderRow(
              slot,
              mediators.length === 0 ? (
                <span className="res-unassigned">Non assigné</span>
              ) : (
                mediators.map(m => (
                  <span key={m.id} className="res-mediator">
                    <span className="slot-mediator-glyph" style={{ color: m.color || '#ccc' }}>●</span>
                    {' '}{m.lastName} {m.firstName}
                    {m.phone && <span className="res-mediator-phone">{m.phone}</span>}
                  </span>
                ))
              )
            );
          })
        )}
      </div>

      {freeVisitSlots.length > 0 && (
        <div className="res-freevisits">
          <div className="daily-section-title">Réservations visites libres</div>
          {freeVisitSlots.map(slot => renderRow(slot, <span className="res-free-label">Libre</span>))}
        </div>
      )}

      {slotModal && (
        <SlotModal
          slot={slotModal.slot}
          mediatorOnly={slotModal.mediatorOnly}
          defaultDate={slotModal.defaultDate}
          onClose={handleModalClose}
        />
      )}
    </div>
  );
}
