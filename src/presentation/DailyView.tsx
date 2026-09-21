// DailyView.tsx — Day Planning View (Vue planning du jour)
// Layout per LEXICON.md: mediators as rows, time as columns (10-min grid lines),
// unassigned lane, standard offers lane.
import { useState, useMemo } from 'react';
import { useData, useCRUD } from './DataContext';
import type { Slot, Mediator, Absence, AbsenceType } from '../domain/types';
import { mediatorConfirmedForOffer, mediatorLearningOffer, getAbsenceTimeRange, getDefaultHalfDayConfig, toLocalDateString, getSlotTotalRange, formatSlotBookingSummary } from '../domain/models';
import { ABSENCE_TYPE_LABELS } from '../domain/models';
import { useElementWidth, pxPerHourFromWidth } from './useElementWidth';
import SlotModal from './SlotModal';

const START_HOUR = 8;
const END_HOUR = 19;
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => i + START_HOUR);
const FALLBACK_PX_PER_HOUR = 60; // used until the container is measured
const TRACK_HEIGHT = 32; // Fixed height for mediator tracks

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export default function DailyView() {
  const { state, dispatch } = useData();
  const crud = useCRUD();
  const { data, locked } = state;

  // Single source of truth: global currentDate (URL-synced by DataProvider)
  const selectedDate = state.currentDate;
  const setSelectedDate = (d: Date) => dispatch({ type: 'SET_CURRENT_DATE', date: d });

  const selectedDateStr = toLocalDateString(selectedDate);

  // Slots for the selected day
  const daySlots = useMemo(() => {
    return data.slots.filter(slot => slot.date === selectedDateStr);
  }, [data.slots, selectedDateStr]);

  // Active mediators only - sorted alphabetically by lastName, then firstName
  const activeMediators = useMemo(() => {
    return data.mediators
      .filter(m => m.active)
      .sort((a, b) => {
        const aName = `${a.lastName} ${a.firstName}`.toLowerCase();
        const bName = `${b.lastName} ${b.firstName}`.toLowerCase();
        return aName.localeCompare(bName);
      });
  }, [data.mediators]);

  // Assigned vs unassigned
  const { assignedSlots, unassignedSlots } = useMemo(() => {
    const assigned = daySlots.filter(slot => slot.mediatorIds.length > 0);
    const unassigned = daySlots.filter(slot => slot.mediatorIds.length === 0);
    return { assignedSlots: assigned, unassignedSlots: unassigned };
  }, [daySlots]);

  // Standard offers: rendering uses visibleOffers (search-filtered catalog)

  // Selected slot for competence highlighting (click -> modal)
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

  // Drag and drop state
  const [draggedItem, setDraggedItem] = useState<{ type: 'offer' | 'slot'; id: string; data: any } | null>(null);
  
  // Drag indicator state (red bar showing drop position)
  const [dragIndicator, setDragIndicator] = useState<{
    left: number;
    width: number;
    startTime: string;
    endTime: string;
    blockStart: string;
    blockEnd: string;
  } | null>(null);

  // Half-day configuration
  const halfDayConfig = data.halfDayConfig || getDefaultHalfDayConfig();

  // Absences for the selected day with computed time ranges
  const dayAbsences = useMemo(() => {
    return data.absences
      .filter(a => a.startDate <= selectedDateStr && a.endDate >= selectedDateStr)
      .map(abs => {
        const timeRange = getAbsenceTimeRange(abs, halfDayConfig);
        return { ...abs, startTime: timeRange.startTime, endTime: timeRange.endTime };
      });
  }, [data.absences, selectedDateStr, halfDayConfig]);

  // Mediator filter: 'libres' | 'occupes' | 'tous' | <mediatorId>
  const [mediatorFilter, setMediatorFilter] = useState<string>('tous');

  // Offer search filter (case-insensitive)
  const [offerSearch, setOfferSearch] = useState<string>('');

  // Mediators displayed after applying the filter.
  // "Libres" = no slot AND no absence that day (absent ≠ libre).
  const visibleMediators = useMemo(() => {
    if (mediatorFilter === 'tous') return activeMediators;
    if (mediatorFilter === 'libres') {
      return activeMediators.filter(m => {
        const hasSlot = assignedSlots.some(s => s.mediatorIds.includes(m.id));
        const hasAbsence = dayAbsences.some(a => a.mediatorId === m.id);
        return !hasSlot && !hasAbsence;
      });
    }
    if (mediatorFilter === 'occupes') {
      return activeMediators.filter(m =>
        assignedSlots.some(s => s.mediatorIds.includes(m.id))
      );
    }
    // Specific mediator selected
    return activeMediators.filter(m => m.id === mediatorFilter);
  }, [activeMediators, mediatorFilter, assignedSlots, dayAbsences]);

  // Offers displayed after applying the search filter
  const visibleOffers = useMemo(() => {
    const q = offerSearch.trim().toLowerCase();
    if (!q) return data.offers;
    return data.offers.filter(o =>
      o.name.toLowerCase().includes(q) ||
      (o.description || '').toLowerCase().includes(q) ||
      (o.location || '').toLowerCase().includes(q)
    );
  }, [data.offers, offerSearch]);

  // Responsive scale: measure the grid container and fill the width.
  // The 200px mediator-label column is subtracted from the available width.
  const { ref: gridRef, width: gridWidth } = useElementWidth();
  const MEDIATOR_LABEL_WIDTH = 200;
  const pxPerHour = gridWidth > 0
    ? pxPerHourFromWidth(gridWidth - MEDIATOR_LABEL_WIDTH, END_HOUR - START_HOUR)
    : FALLBACK_PX_PER_HOUR;
  const pxPerMin = pxPerHour / 60;

  // Calculate minutes per pixel for the grid
  const totalGridWidth = (END_HOUR - START_HOUR) * pxPerHour;

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

  // Get competence status for a mediator and offer
  function getMediatorCompetenceStatus(mediator: Mediator, offerId: string): 'confirmed' | 'learning' | 'none' {
    if (mediatorConfirmedForOffer(mediator, offerId)) return 'confirmed';
    if (mediatorLearningOffer(mediator, offerId)) return 'learning';
    return 'none';
  }

  // Get absence color for a given type
  function getAbsenceColor(type: string): string {
    const colors: Record<string, string> = {
      leave: '#e74c3c',
      mission: '#2ecc71',
      training: '#9b59b6',
      sick: '#e67e22',
      other: '#95a5a6',
      leave_request: '#1e90ff',
    };
    return colors[type] || '#95a5a6';
  }

  // Get absence label for a given type
  function getAbsenceLabel(type: AbsenceType): string {
    return ABSENCE_TYPE_LABELS[type] || type;
  }

  // Shared drop-position calculation: cursor x -> rounded 10-min time.
  // Used by BOTH the drag indicator and the actual drop so the created slot
  // always matches the time shown in the tooltip.
  function getDropTimeFromX(track: HTMLElement, clientX: number): string {
    const rect = track.getBoundingClientRect();
    const x = clientX - rect.left;
    // Round to 10-minute precision
    const totalMinutes = Math.round(x / pxPerMin / 10) * 10;
    const hour = START_HOUR + Math.floor(totalMinutes / 60);
    const minute = totalMinutes % 60;
    return formatTime(hour, minute);
  }

  // Handle drop on mediator track
  function handleDropOnMediator(e: React.DragEvent, mediatorId: string) {
    e.preventDefault();
    if (!draggedItem) return;

    const track = (e.currentTarget as HTMLElement).closest('.daily-mediator-track');
    if (!track) return;

    // The drag indicator's BOOKING time (computed at the last dragover)
    // is the time the user aims at; fall back to recomputing from the drop
    // coordinates with the same rounded calculation.
    const cursorTime = dragIndicator ? dragIndicator.startTime : getDropTimeFromX(track as HTMLElement, e.clientX);

    if (draggedItem.type === 'offer') {
      const offer = data.offers.find(o => o.id === draggedItem.id);
      if (offer) {
        // Cursor aims at the BOOKING start (public time).
        // Setup extends before it, teardown after it.
        const toMin = (t: string) => {
          const [h, m] = t.split(':').map(Number);
          return h * 60 + m;
        };
        const bookingStartMin = toMin(cursorTime);
        const bookingEndMin = bookingStartMin + offer.duration;
        const booking = {
          startTime: formatTime(Math.floor(bookingStartMin / 60), bookingStartMin % 60),
          endTime: formatTime(Math.floor(bookingEndMin / 60), bookingEndMin % 60),
        };

        const newSlot: Slot = {
          id: `slot_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          scheduleId: '',
          date: selectedDateStr,
          startTime: booking.startTime,
          endTime: booking.endTime,
          offerId: offer.id,
          mediatorIds: [mediatorId],
          status: 'planned',
          origin: 'manual',
          participantCount: 0,
          notes: '',
          importSource: '',
          importedAt: '',
          modifiedAfterImport: false,
          groupName: '',
          guide: '',
          location: '',
          groupNature: '',
          contactName: '',
          contactPhone: '',
          contactEmail: '',
          // Initialize per-slot durations from the offer (editable later)
          ...(offer.setupTime !== undefined ? { setupTime: offer.setupTime } : {}),
          ...(offer.teardownTime !== undefined ? { teardownTime: offer.teardownTime } : {}),
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
    setDragIndicator(null);
  }

  // Format time as HH:mm
  function formatTime(hour: number, minute: number): string {
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
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
    
    // Only show indicator for offer drags (not for slot drags)
    if (!draggedItem || draggedItem.type !== 'offer') {
      const track = (e.currentTarget as HTMLElement);
      track.classList.add('drag-over');
      return;
    }
    
    const track = (e.currentTarget as HTMLElement);
    track.classList.add('drag-over');
    
    // Calculate drop position
    const rect = track.getBoundingClientRect();
    const x = e.clientX - rect.left;
    
    // Round to 10-minute precision: the cursor aims at the BOOKING start.
    // The setup block extends BEFORE it (possibly left of the cursor).
    const totalMinutes = Math.round(x / pxPerMin / 10) * 10;
    const hour = START_HOUR + Math.floor(totalMinutes / 60);
    const minute = totalMinutes % 60;

    const bookingStartTime = formatTime(hour, minute);

    // Get offer duration
    const offer = data.offers.find(o => o.id === draggedItem.id);
    if (!offer) return;

    // Booking = cursor position, duration = offer duration (public time).
    // The setup/teardown extend the block around it.
    const setup = offer.setupTime || 0;
    const teardown = offer.teardownTime || 0;
    const bookingEndTime = formatTime(
      START_HOUR + Math.floor((totalMinutes + offer.duration) / 60),
      (totalMinutes + offer.duration) % 60
    );

    // Total block geometry: starts BEFORE the cursor by setup
    const blockStartMinutes = totalMinutes - setup;
    const blockEndMinutes = totalMinutes + offer.duration + teardown;
    const blockStartTime = formatTime(
      START_HOUR + Math.floor(blockStartMinutes / 60),
      ((blockStartMinutes % 60) + 60) % 60
    );
    const blockEndTime = formatTime(
      START_HOUR + Math.floor(blockEndMinutes / 60),
      blockEndMinutes % 60
    );

    // Indicator position and width (from block start)
    const left = blockStartMinutes * pxPerMin;
    const width = (setup + offer.duration + teardown) * pxPerMin;

    setDragIndicator({
      left,
      width,
      startTime: bookingStartTime,
      endTime: bookingEndTime,
      blockStart: blockStartTime,
      blockEnd: blockEndTime,
    });
  }

  // Handle drag leave mediator track
  function handleDragLeave(e: React.DragEvent) {
    const track = (e.currentTarget as HTMLElement);
    track.classList.remove('drag-over');
    setDragIndicator(null);
  }

  // Handle drag end
  function handleDragEnd() {
    setDraggedItem(null);
    setDragIndicator(null);
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
    return (toMinutes(slot.startTime) - START_HOUR * 60) * pxPerMin;
  }

  function getSlotHeight(slot: Slot): number {
    return (toMinutes(slot.endTime) - toMinutes(slot.startTime)) * pxPerMin;
  }

  function getAbsenceTop(absence: Absence): number {
    return (toMinutes(absence.startTime || '00:00') - START_HOUR * 60) * pxPerMin;
  }

  function getAbsenceWidth(absence: Absence): number {
    return (toMinutes(absence.endTime || '23:59') - toMinutes(absence.startTime || '00:00')) * pxPerMin;
  }

  // Filter absences for a specific mediator on the selected day
  function getMediatorAbsences(mediatorId: string): Absence[] {
    return dayAbsences.filter(a => a.mediatorId === mediatorId);
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
              Plan Jour — {selectedDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
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
          <label className="filter-label" htmlFor="daily-mediator-filter">
            Médiateurs
          </label>
          <select
            id="daily-mediator-filter"
            className="select"
            value={mediatorFilter}
            onChange={(e) => setMediatorFilter(e.target.value)}
          >
            <option value="libres">Libres</option>
            <option value="occupes">Occupés</option>
            <option value="tous">Tous</option>
            {activeMediators.map(m => (
              <option key={m.id} value={m.id}>
                {m.lastName} {m.firstName}
              </option>
            ))}
          </select>
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

      <div className="daily-grid" ref={gridRef}>
        {/* Time axis — horizontal, hours as columns */}
        <div className="daily-time-axis">
        <div className="daily-time-spacer" style={{ minWidth: `${MEDIATOR_LABEL_WIDTH}px`, width: `${MEDIATOR_LABEL_WIDTH}px` }}></div>
        {HOURS.map(hour => (
          <div
            key={hour}
            className="daily-hour-label"
            style={{ width: `${pxPerHour}px` }}
          >
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
              <span
                className="daily-unassigned-count"
                title="Réservations non affectées / réservations du jour"
              >
                {unassignedSlots.length}/{daySlots.length}
              </span>
            </div>
            <div
              className="daily-mediator-track"
              style={{ width: `${totalGridWidth}px`, height: `${TRACK_HEIGHT}px`, position: 'relative' }}
            >
              {HOURS.map((hour, i) => (
                <div
                  key={hour}
                  className="daily-hour-line"
                  style={{ left: `${i * pxPerHour}px`, width: `${pxPerHour}px` }}
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
                        setSlotModal({ slot, mediatorOnly: locked && isImported, defaultDate: slot.date });
                      }}
                      draggable
                      onDragStart={(e) => handleDragStart(e, 'slot', slot.id)}
                      onDragEnd={handleDragEnd}
                      title={`${formatSlotBookingSummary(slot, offer)}\nMédiateur : non assigné`}
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
          {visibleMediators.length === 0 && (
            <div className="daily-empty">Aucun médiateur ne correspond au filtre.</div>
          )}
          {visibleMediators.map(mediator => {
            const mediatorSlots = assignedSlots.filter(slot =>
              slot.mediatorIds.includes(mediator.id)
            );
            const mediatorAbsences = getMediatorAbsences(mediator.id);

            // Get competence status for the highlighted offer (drag or selection)
            const competenceStatus = highlightOfferId ? 
              getMediatorCompetenceStatus(mediator, highlightOfferId) : null;

            return (
              <div 
                key={mediator.id} 
                className={`daily-mediator-row${competenceStatus ? ` competence-${competenceStatus}` : ''}`}
              >
                <div className="daily-mediator-label">
                  <span className="slot-mediator-glyph daily-mediator-color" style={{ color: mediator.color || '#ccc' }}>●</span>
                  <span className="daily-mediator-name">{mediator.lastName} {mediator.firstName}</span>
                </div>
                <div
                  className="daily-mediator-track"
                  style={{
                    width: `${totalGridWidth}px`,
                    height: `${TRACK_HEIGHT}px`,
                    position: 'relative',
                  }}
                  onDrop={(e) => handleDropOnMediator(e, mediator.id)}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                >
                  {/* Hour grid lines */}
                  {HOURS.map((hour, i) => (
                    <div
                      key={hour}
                      className="daily-hour-line"
                      style={{ left: `${i * pxPerHour}px`, width: `${pxPerHour}px` }}
                    />
                  ))}
                  
                  {/* Drag indicator (red bar) */}
                  {dragIndicator && (
                    <div
                      className="daily-drag-indicator"
                      style={{
                        left: `${dragIndicator.left}px`,
                        width: `${dragIndicator.width}px`,
                      }}
                      title={`Bloc total : ${dragIndicator.blockStart} – ${dragIndicator.blockEnd}\nRéservation : ${dragIndicator.startTime} – ${dragIndicator.endTime}`}
                    >
                      <div className="drag-indicator-time">
                        {dragIndicator.startTime} – {dragIndicator.endTime}
                      </div>
                    </div>
                  )}
                  
                  {/* Absence blocks */}
                  {mediatorAbsences.map(abs => {
                    const color = getAbsenceColor(abs.type);
                    const label = getAbsenceLabel(abs.type);
                    const left = getAbsenceTop(abs);
                    const width = getAbsenceWidth(abs);
                    
                    // Only show if absence overlaps with visible time range
                    if (width <= 0) return null;
                    
                    return (
                      <div
                        key={`abs_${abs.id}`}
                        className="daily-absence-block"
                        style={{
                          left: `${left}px`,
                          width: `${width}px`,
                          backgroundColor: color + '40', // 25% opacity
                          borderLeft: `3px solid ${color}`,
                        }}
                        title={`${label} (${abs.startTime || '00:00'} – ${abs.endTime || '23:59'})`}
                      >
                        <span className="absence-label">{label}</span>
                      </div>
                    );
                  })}
                  
                  {/* Slots */}
                  {mediatorSlots.map(slot => {
                    const offer = data.offers.find(o => o.id === slot.offerId);
                    const mediatorColor = mediator.color || '#ccc';
                    const isSelected = selectedSlot?.id === slot.id;
                    const isImported = slot.origin === 'imported';

                    // Total block = setup + booking + teardown.
                    // Durations: slot values override offer values (per-slot editable)
                    const total = getSlotTotalRange(slot, offer);
                    const effSetup = slot.setupTime ?? offer?.setupTime ?? 0;
                    const effTeardown = slot.teardownTime ?? offer?.teardownTime ?? 0;
                    const hasSetup = effSetup > 0;
                    const hasTeardown = effTeardown > 0;
                    const totalLeft = (toMinutes(total.start) - START_HOUR * 60) * pxPerMin;
                    const totalWidth = (toMinutes(total.end) - toMinutes(total.start)) * pxPerMin;
                    // Absolute children are positioned from the PADDING edge,
                    // i.e. after the left border (3px, 4px for imported).
                    // Compensate so the delimiters land exactly on the
                    // minute-grid positions.
                    const borderWidth = isImported ? 4 : 3;
                    const bookingStartOffset = (toMinutes(slot.startTime) - toMinutes(total.start)) * pxPerMin - borderWidth;
                    const bookingEndOffset = (toMinutes(slot.endTime) - toMinutes(total.start)) * pxPerMin - borderWidth;

                    return (
                      <div
                        key={slot.id}
                        className={`daily-slot assigned${isSelected ? ' selected' : ''}${isImported ? ' imported' : ''}`}
                        style={{
                          left: `${totalLeft}px`,
                          width: `${totalWidth}px`,
                          borderLeftColor: mediatorColor,
                        }}
                        onClick={() => {
                          setSelectedSlot(slot);
                          setSlotModal({ slot, mediatorOnly: locked && isImported, defaultDate: slot.date });
                        }}
                        draggable
                        onDragStart={(e) => handleDragStart(e, 'slot', slot.id)}
                        onDragEnd={handleDragEnd}
                        title={`${formatSlotBookingSummary(slot, offer)}\nRéservation : ${slot.startTime} – ${slot.endTime}${hasSetup ? ` (mise en place ${effSetup} min avant)` : ''}${hasTeardown ? ` (rangement ${effTeardown} min après)` : ''}`}
                      >
                        {hasSetup && (
                          <div
                            className="slot-boundary setup-boundary"
                            style={{ left: `${bookingStartOffset}px` }}
                          ></div>
                        )}
                        <div className="slot-time">{slot.startTime} – {slot.endTime}</div>
                        <div className="slot-title">{offer?.name || '—'}</div>
                        {hasTeardown && (
                          <div
                            className="slot-boundary teardown-boundary"
                            style={{ left: `${bookingEndOffset}px` }}
                          ></div>
                        )}
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
          <input
            id="daily-offer-search"
            type="text"
            className="daily-offer-search"
            placeholder="Rechercher une offre…"
            value={offerSearch}
            onChange={(e) => setOfferSearch(e.target.value)}
          />
          <div className="daily-offers-list">
            {visibleOffers.length === 0 ? (
              <div className="daily-empty">
                {data.offers.length === 0
                  ? 'Aucune offre libre disponible.'
                  : 'Aucune offre ne correspond à la recherche.'}
              </div>
            ) : (
              visibleOffers.map(offer => (
                <div key={offer.id} className="daily-offer" draggable
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
