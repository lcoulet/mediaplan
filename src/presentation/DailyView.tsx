// DailyView.tsx — Day Planning View (Vue planning du jour)
// Layout per LEXICON.md: mediators as rows, time as columns (10-min grid lines),
// unassigned lane, standard offers lane.
import { useState, useMemo } from 'react';
import { useData, useCRUD } from './DataContext';
import type { Slot, Mediator } from '../domain/types';
import { mediatorConfirmedForOffer, mediatorLearningOffer } from '../domain/models';
import SlotModal from './SlotModal';

const START_HOUR = 8;
const END_HOUR = 19;
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => i + START_HOUR);
const HOUR_HEIGHT = 60; // px per hour

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export default function DailyView() {
  const { state, dispatch } = useData();
  const crud = useCRUD();
  const { data, locked } = state;

  // Local state for the selected day (defaults to today)
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const selectedDateStr = selectedDate.toISOString().slice(0, 10);

  // Slots for the selected day
  const daySlots = useMemo(() => {
    return data.slots.filter(slot => slot.date === selectedDateStr);
  }, [data.slots, selectedDateStr]);

  // Active mediators only
  const activeMediators = useMemo(() => {
    return data.mediators.filter(m => m.active);
  }, [data.mediators]);

  // Assigned vs unassigned
  const { assignedSlots, unassignedSlots } = useMemo(() => {
    const assigned = daySlots.filter(slot => slot.mediatorIds.length > 0);
    const unassigned = daySlots.filter(slot => slot.mediatorIds.length === 0);
    return { assignedSlots: assigned, unassignedSlots: unassigned };
  }, [daySlots]);

  // Standard offers (catalog — all offers available for drag-and-drop)
  const allOffers = data.offers;

  // Selected slot for competence highlighting (click → modal)
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

  // Drag and drop state
  const [draggedItem, setDraggedItem] = useState<{ type: 'offer' | 'slot'; id: string; data: any } | null>(null);

  // Highlight offer: from selected slot (click) OR dragged item (drag)
  const highlightOfferId = useMemo(() => {
    if (draggedItem) {
      if (draggedItem.type === 'slot') {
        const slot = data.slots.find(s => s.id === draggedItem.id);
        return slot?.offerId || null;
      } else {
        return draggedItem.id; // offer id directly
      }
    }
    return selectedSlot?.offerId || null;
  }, [draggedItem, selectedSlot, data.slots]);

  // Calculate time from drop position (x in pixels)
  function getTimeFromPosition(x: number): { hour: number; minute: number } {
    const totalMinutes = Math.floor(x / (HOUR_HEIGHT / 60));
    return {
      hour: START_HOUR + Math.floor(totalMinutes / 60),
      minute: totalMinutes % 60,
    };
  }

  // Format time as HH:mm
  function formatTime(hour: number, minute: number): string {
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }

  // Get competence status for a mediator and offer
  function getMediatorCompetenceStatus(mediator: Mediator, offerId: string): 'confirmed' | 'learning' | 'none' {
    if (mediatorConfirmedForOffer(mediator, offerId)) return 'confirmed';
    if (mediatorLearningOffer(mediator, offerId)) return 'learning';
    return 'none';
  }

  // Handle drop on mediator track
  function handleDropOnMediator(e: React.DragEvent, mediatorId: string) {
    e.preventDefault();
    if (!draggedItem) return;

    const track = (e.currentTarget as HTMLElement).closest('.daily-mediator-track');
    if (!track) return;

    const rect = track.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const { hour, minute } = getTimeFromPosition(x);
    const startTime = formatTime(hour, minute);

    if (draggedItem.type === 'offer') {
      const offer = data.offers.find(o => o.id === draggedItem.id);
      if (offer) {
        const duration = offer.duration;
        const endHour = hour + Math.floor(duration / 60);
        const endMinute = minute + (duration % 60);
        const endTime = formatTime(endHour, endMinute);

        const newSlot: Slot = {
          id: `slot_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          scheduleId: '',
          date: selectedDateStr,
          startTime,
          endTime,
          offerId: offer.id,
          mediatorIds: [mediatorId],
          status: 'planned',
          origin: 'manual',
          participantCount: 0,
          notes: '',
          importSource: '',
          importedAt: '',
          modifiedAfterImport: false,
        };
        crud({ type: 'ADD_SLOT', slot: newSlot });
      }
    } else if (draggedItem.type === 'slot') {
      const slot = data.slots.find(s => s.id === draggedItem.id);
      if (slot) {
        // Assign to this mediator (add to mediatorIds if not already present)
        const updatedSlot: Slot = {
          ...slot,
          mediatorIds: [...new Set([...slot.mediatorIds, mediatorId])],
        };
        crud({ type: 'UPDATE_SLOT', slot: updatedSlot });
      }
    }
    setDraggedItem(null);
  }

  // Handle drag start for offers
  function handleDragStart(e: React.DragEvent, type: 'offer' | 'slot', id: string) {
    setDraggedItem({ type, id, data: null });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', `${type}:${id}`);
  }

  // Handle drag over mediator track
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    // Add visual feedback
    const track = (e.currentTarget as HTMLElement);
    track.classList.add('drag-over');
  }

  // Handle drag leave mediator track
  function handleDragLeave(e: React.DragEvent) {
    const track = (e.currentTarget as HTMLElement);
    track.classList.remove('drag-over');
  }

  // Handle drag end
  function handleDragEnd() {
    setDraggedItem(null);
    // Remove drag-over class from all tracks
    document.querySelectorAll('.daily-mediator-track').forEach(track => {
      track.classList.remove('drag-over');
    });
  }

  // Clear selection when modal closes
  function handleModalClose() {
    setSlotModal(null);
    setSelectedSlot(null);
  }

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

  function getSlotTop(slot: Slot): number {
    return (toMinutes(slot.startTime) - START_HOUR * 60);
  }

  function getSlotHeight(slot: Slot): number {
    return toMinutes(slot.endTime) - toMinutes(slot.startTime);
  }

  const totalGridWidth = (END_HOUR - START_HOUR) * HOUR_HEIGHT;

  return (
    <div className="view active">
      <div className="toolbar">
        <div className="toolbar-left">
          <h2>Plan Jour — {selectedDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
          <button className="btn btn-secondary" onClick={() => goToDay(-1)}>←</button>
          <button className="btn btn-secondary" onClick={goToToday}>Aujourd'hui</button>
          <button className="btn btn-secondary" onClick={() => goToDay(1)}>→</button>
        </div>
        <div className="toolbar-right">
          <label className="toggle-switch">
            <input
              type="checkbox"
              id="toggle-edit-mode-daily"
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

      <div className="daily-grid">
        {/* Time axis — horizontal, hours as columns */}
        <div className="daily-time-axis">
          <div className="daily-time-spacer"></div>
          {HOURS.map(hour => (
            <div key={hour} className="daily-hour-label">
              {hour}:00
            </div>
          ))}
        </div>

        {/* Unassigned lane — above mediators */}
        <div className="daily-unassigned-section">
          <div className="daily-section-title">Réservations non affectées</div>
          <div className="daily-unassigned-row">
            <div className="daily-mediator-label">
              <span className="daily-mediator-name">Non assigné</span>
            </div>
            <div
              className="daily-mediator-track"
              style={{ width: `${totalGridWidth}px`, position: 'relative' }}
            >
              {HOURS.map((hour, i) => (
                <div
                  key={hour}
                  className="daily-hour-line"
                  style={{ left: `${i * HOUR_HEIGHT}px`, width: `${HOUR_HEIGHT}px` }}
                />
              ))}
              {unassignedSlots.length === 0 ? (
                <div className="daily-empty">Aucune réservation non affectée pour aujourd'hui.</div>
              ) : (
                unassignedSlots.map(slot => {
                  const offer = data.offers.find(o => o.id === slot.offerId);
                  const isSelected = selectedSlot?.id === slot.id;
                  const isImported = slot.origin === 'imported';
                  return (
                    <div
                      key={slot.id}
                      className={`daily-slot unassigned${isSelected ? ' selected' : ''}${isImported ? ' imported' : ''}`}
                      style={{
                        left: `${getSlotTop(slot)}px`,
                        width: `${getSlotHeight(slot)}px`,
                      }}
                      onClick={() => {
                        setSelectedSlot(slot);
                        setSlotModal({ slot, mediatorOnly: locked, defaultDate: slot.date });
                      }}
                      draggable={!locked || !isImported}
                      onDragStart={(e) => handleDragStart(e, 'slot', slot.id)}
                      onDragEnd={handleDragEnd}
                    >
                      <div className="slot-time">{slot.startTime} – {slot.endTime}</div>
                      <div className="slot-title">{offer?.name || '—'}</div>
                      <div className="slot-mediator">Non assigné</div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Mediator rows — below unassigned */}
        <div className="daily-mediators-section">
          <div className="daily-section-title">Médiateurs</div>
          {activeMediators.map(mediator => {
            const mediatorSlots = assignedSlots.filter(slot =>
              slot.mediatorIds.includes(mediator.id)
            );
            
            // Get competence status for the highlighted offer (drag or selection)
            const competenceStatus = highlightOfferId ? 
              getMediatorCompetenceStatus(mediator, highlightOfferId) : null;

            return (
              <div 
                key={mediator.id} 
                className={`daily-mediator-row${competenceStatus ? ` competence-${competenceStatus}` : ''}`}
              >
                <div className="daily-mediator-label">
                  <span className="daily-mediator-color" style={{ backgroundColor: mediator.color || '#ccc' }}></span>
                  <span className="daily-mediator-name">{mediator.firstName} {mediator.lastName}</span>
                </div>
                <div
                  className="daily-mediator-track"
                  style={{ width: `${totalGridWidth}px`, position: 'relative' }}
                  onDrop={(e) => handleDropOnMediator(e, mediator.id)}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                >
                  {/* Hour grid lines */}
                  {HOURS.map((hour, i) => (
                    <div
                      key={hour}
                      className="daily-hour-line"
                      style={{ left: `${i * HOUR_HEIGHT}px`, width: `${HOUR_HEIGHT}px` }}
                    />
                  ))}
                  {/* Slots */}
                  {mediatorSlots.map(slot => {
                    const offer = data.offers.find(o => o.id === slot.offerId);
                    const mediatorColor = mediator.color || '#ccc';
                    const isSelected = selectedSlot?.id === slot.id;
                    const isImported = slot.origin === 'imported';

                    return (
                      <div
                        key={slot.id}
                        className={`daily-slot assigned${isSelected ? ' selected' : ''}${isImported ? ' imported' : ''}`}
                        style={{
                          left: `${getSlotTop(slot)}px`,
                          width: `${getSlotHeight(slot)}px`,
                          borderLeftColor: mediatorColor,
                        }}
                        onClick={() => {
                          setSelectedSlot(slot);
                          setSlotModal({ slot, mediatorOnly: locked, defaultDate: slot.date });
                        }}
                        draggable={!locked || !isImported}
                        onDragStart={(e) => handleDragStart(e, 'slot', slot.id)}
                        onDragEnd={handleDragEnd}
                      >
                        <div className="slot-time">{slot.startTime} – {slot.endTime}</div>
                        <div className="slot-title">{offer?.name || '—'}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Standard offers lane — no time positioning */}
        <div className="daily-offers-section">
          <div className="daily-section-title">Offres libres (glissables)</div>
          <div className="daily-offers-list">
            {allOffers.length === 0 ? (
              <div className="daily-empty">Aucune offre libre disponible.</div>
            ) : (
              allOffers.map(offer => (
                <div key={offer.id} className="daily-offer" draggable={!locked}
                  onDragStart={(e) => handleDragStart(e, 'offer', offer.id)}
                  onDragEnd={handleDragEnd}>
                  <div className="offer-name">{offer.name}</div>
                  <div className="offer-duration">{offer.duration} min</div>
                </div>
              ))
            )}
          </div>
        </div>

        {slotModal && (
          <SlotModal
            slot={slotModal.slot}
            mediatorOnly={slotModal.mediatorOnly}
            defaultDate={slotModal.defaultDate}
            onClose={handleModalClose}
          />
        )}
      </div>
    </div>
  );
}
