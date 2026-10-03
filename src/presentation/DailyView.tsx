// DailyView.tsx — Day Planning View (Vue planning du jour)
// Layout per LEXICON.md: mediators as rows, time as columns (10-min grid lines),
// unassigned lane, standard offers lane.
import { useState, useMemo } from 'react';
import { useData, useCRUD } from './DataContext';
import type { Slot, Mediator, Absence, AbsenceType, Offer } from '../domain/types';
import { mediatorConfirmedForOffer, mediatorLearningOffer, getAbsenceTimeRange, getDefaultHalfDayConfig, toLocalDateString, getSlotTotalRange, formatSlotBookingSummary, getISOWeekNumber, isFreeVisitOffer } from '../domain/models';
import { ABSENCE_TYPE_LABELS } from '../domain/models';
import { useElementWidth, pxPerHourFromWidth } from './useElementWidth';
import { computeParallelLanes } from '../domain/parallel-lanes';
import { getDynamicMasking, setDynamicMasking } from '../infrastructure/ui-settings';
import { mediatorsForPrint } from '../domain/print-selection';
import { getPillsForMediator, hatchingForDate } from '../domain/cycle-display';
import { getWorkedHoursForDate } from '../domain/cycles';
import { spaceForSlot, blockTextColor, legendSpacesForDay } from '../domain/space-display';
import { offerShortLabel } from '../domain/spaces';
import { SECUTIX_SPACE_COLOR } from '../domain/spaces';
import { usePrint, printDateLine } from './usePrint';
import { usePrintMode } from './usePrintMode';
import { printAxisBounds } from '../domain/print-axis';
import SlotModal from './SlotModal';

const START_HOUR = 8;
const END_HOUR = 19;
// Screen axis in minutes from midnight (unchanged on-screen behavior)
const AXIS_START_MIN = START_HOUR * 60;
const AXIS_END_MIN = END_HOUR * 60;
const FALLBACK_PX_PER_HOUR = 60; // used until the container is measured
const TRACK_HEIGHT = 32; // Fixed height for mediator tracks

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/** Hour ticks (minutes from midnight) covered by an axis [startMin, endMin].
    Whole hours, plus the axis start itself when it is not a whole hour
    (e.g. the fixed 08:30 print start). An axis ending between whole hours
    (e.g. a teardown extension to 19:50) keeps its last whole-hour label;
    the remaining minutes extend the final column's width. */
function hourTicksFor(startMin: number, endMin: number): number[] {
  const ticks: number[] = [];
  for (let t = Math.ceil(startMin / 60) * 60; t <= endMin; t += 60) ticks.push(t);
  // Always include the axis start itself when it is not a whole hour
  if (ticks.length === 0 || ticks[0] > startMin) ticks.unshift(startMin);
  return ticks;
}

/** 510 -> "8:30" — matches the previous on-screen label format (no
    zero-padding on the hour). */
function minutesToLabel(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
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

  // Assigned vs unassigned. Free visits (Accueil Libre, no mediator
  // needed) leave the unassigned lane for their own section and COUNT AS
  // ASSIGNED in the lane badge.
  const { assignedSlots, unassignedSlots, freeVisitSlots } = useMemo(() => {
    const offerById = new Map(data.offers.map(o => [o.id, o]));
    const assigned = daySlots.filter(slot => slot.mediatorIds.length > 0);
    const withoutMediator = daySlots.filter(slot => slot.mediatorIds.length === 0);
    const unassigned = withoutMediator.filter(slot => !isFreeVisitOffer(offerById.get(slot.offerId)));
    const freeVisits = withoutMediator.filter(slot => isFreeVisitOffer(offerById.get(slot.offerId)));
    return { assignedSlots: assigned, unassignedSlots: unassigned, freeVisitSlots: freeVisits };
  }, [daySlots, data.offers]);

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

  // Time axis bounds (minutes from midnight). On screen the axis is the
  // fixed 08:00-19:00 grid; WHILE PRINTING it follows the spec (feature
  // day-view-print): fixed 08:30-19:00, extended left/right to cover any
  // slot's total block (setup/teardown included), rounded outward to
  // 10-minute ticks. Screen geometry is untouched outside print mode.
  const printing = usePrintMode();
  const printBounds = useMemo(
    () => printAxisBounds(daySlots, new Map(data.offers.map((o) => [o.id, o]))),
    [daySlots, data.offers]
  );
  const axisStartMin = printing ? printBounds.start : AXIS_START_MIN;
  const axisEndMin = printing ? printBounds.end : AXIS_END_MIN;
  const axisHours = hourTicksFor(axisStartMin, axisEndMin);
  const axisSpanHours = (axisEndMin - axisStartMin) / 60;

  // Responsive scale: measure the grid container and fill the width.
  // The 200px mediator-label column is subtracted from the available width.
  // The span follows the ACTIVE axis (screen: 08:00-19:00; print: the
  // extended print axis) so every hour column keeps the same width.
  const { ref: gridRef, width: gridWidth } = useElementWidth();
  const MEDIATOR_LABEL_WIDTH = 200;
  // WHILE PRINTING, the grid is pinned by the print CSS (@media print)
  // to 1062 CSS px (A4 landscape printable width). useElementWidth keeps
  // measuring the SCREEN window, so the scale must be derived from the
  // pinned print width instead — otherwise a narrow screen window
  // shrinks the printed grid and wastes the page width.
  const PRINT_GRID_WIDTH = 1062;
  const effectiveGridWidth = printing ? PRINT_GRID_WIDTH : gridWidth;
  const pxPerHour = effectiveGridWidth > 0
    ? pxPerHourFromWidth(effectiveGridWidth - MEDIATOR_LABEL_WIDTH, axisSpanHours)
    : FALLBACK_PX_PER_HOUR;
  const pxPerMin = pxPerHour / 60;

  // Calculate minutes per pixel for the grid
  const totalGridWidth = axisSpanHours * pxPerHour;

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

  // While dragging an offer or an unassigned slot, hide the mediator rows of
  // mediators totally incompetent for that offer ("Masquage dynamique").
  // - Free-visit offers (Accueil Libre) are exempt: no mediator is required.
  // - Safety: if NO mediator is competent, hide nobody (assignment stays
  //   possible — incompetence is flagged, not forbidden).
  // - Incompetent rows are removed from the layout (compact grid); the drag
  //   image offset bug this causes is accepted by the stakeholder.
  // - Persisted per browser in ui-settings (localStorage, NOT in AppData).
  const [dynamicMasking, setDynamicMaskingState] = useState(() => getDynamicMasking());

  // Print: hide mediator rows with nothing on the day (mediatorsForPrint is
  // the tested domain rule; the visible list drives both screen and print,
  // the print stylesheet only hides the app chrome).
  const print = usePrint();
  const printableMediatorIds = useMemo(
    () => new Set(mediatorsForPrint(data, selectedDateStr)),
    [data, selectedDateStr]
  );

  const setDynamicMaskingAndPersist = (value: boolean) => {
    setDynamicMaskingState(value);
    setDynamicMasking(value);
  };

  const draggedOfferId = useMemo(() => {
    if (!draggedItem) return null;
    if (draggedItem.type === 'offer') return draggedItem.id;
    // Slot drag: only UNASSIGNED slots are "offres à assigner"
    const slot = data.slots.find(s => s.id === draggedItem.id);
    if (!slot || slot.mediatorIds.length > 0) return null;
    return slot.offerId;
  }, [draggedItem, data.slots]);

  const hiddenMediatorIds = useMemo(() => {
    if (!dynamicMasking || !draggedOfferId) return new Set<string>();
    const offer = data.offers.find(o => o.id === draggedOfferId);
    if (!offer || isFreeVisitOffer(offer)) return new Set<string>();
    const incompetent = visibleMediators.filter(m => {
      const status = getMediatorCompetenceStatus(m, draggedOfferId);
      return status !== 'confirmed' && status !== 'learning';
    });
    if (incompetent.length >= visibleMediators.length) return new Set<string>();
    return new Set(incompetent.map(m => m.id));
  }, [dynamicMasking, draggedOfferId, visibleMediators, data.offers]);

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

  // Space-colored blocks (spec: the SPACE color is the block background,
  // the primary signal; the OFFRE color moves to the dot). Resolved per
  // slot; a slot with no space keeps the neutral lane styling.
  function spaceStyleFor(slot: Slot, offer: { location: string } | undefined): {
    spaceClass: string;
    style: React.CSSProperties;
  } {
    const space = spaceForSlot(data.spaces, slot, offer as Offer | undefined);
    if (!space) return { spaceClass: '', style: {} };
    const isWhite = space.color.toUpperCase() === SECUTIX_SPACE_COLOR;
    return {
      spaceClass: ` has-space${isWhite ? ' space-white' : ''}`,
      style: {
        backgroundColor: space.color,
        color: blockTextColor(space),
        ...(isWhite ? { border: '1.5px solid #8a8a8a' } : {}),
      },
    };
  }

  // Offer dot + short label row inside a block (dot color = offer color,
  // white ring for contrast per the validated mockup; label carries the
  // text info, the dot is aria-hidden).
  function renderBlockLabel(offer: typeof data.offers[number] | undefined): React.ReactNode {
    return (
      <div className="slot-label-row">
        <span
          className="offer-dot"
          style={{ backgroundColor: offer?.color || '#ccc' }}
          aria-hidden="true"
        ></span>
        <span className="slot-label" title={offer ? offerShortLabel(offer) : undefined}>
          {offer ? offerShortLabel(offer) : '—'}
        </span>
      </div>
    );
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
    return (toMinutes(slot.startTime) - axisStartMin) * pxPerMin;
  }

  function getSlotHeight(slot: Slot): number {
    return (toMinutes(slot.endTime) - toMinutes(slot.startTime)) * pxPerMin;
  }

  function getAbsenceTop(absence: Absence): number {
    return (toMinutes(absence.startTime || '00:00') - axisStartMin) * pxPerMin;
  }

  function getAbsenceWidth(absence: Absence): number {
    return (toMinutes(absence.endTime || '23:59') - toMinutes(absence.startTime || '00:00')) * pxPerMin;
  }

  /** Width of one axis tick column: full hour, or the shorter partial hour
      at the axis start (e.g. an 08:30 axis start: the first column is
      08:30-09:00, half an hour wide). */
  function tickWidth(tick: number): number {
    const next = Math.min(tick + 60, axisEndMin);
    return (next - tick) * pxPerMin;
  }

  // Filter absences for a specific mediator on the selected day
  function getMediatorAbsences(mediatorId: string): Absence[] {
    return dayAbsences.filter(a => a.mediatorId === mediatorId);
  }

  // Legend: distinct spaces used by the day's slots (first-use order),
  // rendered under the lanes per the validated mockup.
  const legendSpaces = useMemo(
    () => legendSpacesForDay(data.spaces, daySlots, data.offers),
    [data.spaces, daySlots, data.offers]
  );

  return (
    <div className="view active daily-view">
      <div className="toolbar">
        <div className="toolbar-left">
          <button className="btn btn-secondary" onClick={() => goToDay(-1)}>←</button>
          <button className="btn btn-secondary" onClick={goToToday} title="Aujourd'hui (T)">Aujourd'hui</button>
          <button className="btn btn-secondary" onClick={() => goToDay(1)}>→</button>
          <h2>
            <label className="date-picker-label" title="Changer la date">
              Plan Jour — Semaine {getISOWeekNumber(selectedDate)} — {selectedDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
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
          <label className="toggle-switch" title="Masquer les médiateurs incompétents pendant le glisser-déposer d'une offre ou d'une réservation à affecter">
            <input
              type="checkbox"
              id="toggle-dynamic-masking"
              checked={dynamicMasking}
              onChange={(e) => setDynamicMaskingAndPersist(e.target.checked)}
            />
            <span className="toggle-slider"></span>
            <span className="toggle-label">Masquage dynamique</span>
          </label>
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
          <button
            className="btn btn-secondary print-btn"
            id="btn-print-daily"
            onClick={print}
            title="Imprimer la vue du jour (A4 paysage)"
          >
            🖨️ Imprimer
          </button>
        </div>
      </div>

      {/* Print header: view title + day date (screen-hidden, print-only) */}
      <div className="print-header">
        <h1>
          Plan Jour — Semaine {getISOWeekNumber(selectedDate)} —{' '}
          {selectedDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </h1>
        <div className="print-date">{printDateLine()}</div>
      </div>

      <div className="daily-grid" ref={gridRef}>
        {/* Time axis — horizontal header with hour labels */}
        <div className="daily-time-axis">
        <div className="daily-time-spacer" style={{ minWidth: `${MEDIATOR_LABEL_WIDTH}px`, width: `${MEDIATOR_LABEL_WIDTH}px` }}></div>
        {axisHours.map(tick => (
          <div
            key={tick}
            className="daily-hour-label"
            style={{ width: `${tickWidth(tick)}px` }}
          >
            {minutesToLabel(tick)}
          </div>
        ))}
        </div>

        {/* Unassigned lane — above mediators */}
        <div className="daily-unassigned-section">
          <div className="daily-section-title">
            Réservations non affectées
            <span
              className="daily-unassigned-count"
              title="Réservations non affectées / réservations du jour"
            >
              {unassignedSlots.length}/{daySlots.length}
            </span>
          </div>
          {unassignedSlots.length === 0 ? (
            <div className="daily-empty">Aucune réservation non affectée pour aujourd'hui.</div>
          ) : computeParallelLanes(unassignedSlots).map((laneSlots, laneIndex) => (
            <div key={laneIndex} className="daily-unassigned-row">
              <div className="daily-mediator-label">
                <span className="daily-mediator-name">Non assigné</span>
              </div>
              <div
                className="daily-mediator-track"
                style={{ width: `${totalGridWidth}px`, height: `${TRACK_HEIGHT}px`, position: 'relative' }}
              >
                {axisHours.map(tick => (
                  <div
                    key={tick}
                    className="daily-hour-line"
                    style={{ left: `${(tick - axisStartMin) * pxPerMin}px`, width: `${tickWidth(tick)}px` }}
                  />
                ))}
                {laneSlots.map(slot => {
                    const offer = data.offers.find(o => o.id === slot.offerId);
                    const isSelected = selectedSlot?.id === slot.id;
                    const isImported = slot.origin === 'imported';
                    const space = spaceStyleFor(slot, offer);
                    return (
                      <div
                        key={slot.id}
                        className={`daily-slot unassigned${space.spaceClass}${isSelected ? ' selected' : ''}${isImported ? ' imported' : ''}`}
                        style={{
                          left: `${getSlotTop(slot)}px`,
                          width: `${getSlotHeight(slot)}px`,
                          ...space.style,
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
                        {renderBlockLabel(offer)}
                        <div className="slot-mediator">Non assigné</div>
                      </div>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>

        {/* Mediator rows — below unassigned */}
        <div className="daily-mediators-section">
          <div className="daily-section-title">Médiateurs</div>
          {visibleMediators.length === 0 && (
            <div className="daily-empty">Aucun médiateur ne correspond au filtre.</div>
          )}
          {visibleMediators.map(mediator => {
            if (hiddenMediatorIds.has(mediator.id)) return null; // removed from layout (compact grid)
            const mediatorSlots = assignedSlots.filter(slot =>
              slot.mediatorIds.includes(mediator.id)
            );
            const mediatorAbsences = getMediatorAbsences(mediator.id);
            // Print: rows with nothing on the day are hidden by the print
            // stylesheet (screen display unchanged)
            const printEmpty = !printableMediatorIds.has(mediator.id);

            // Get competence status for the highlighted offer (drag or selection)
            const competenceStatus = highlightOfferId ? 
              getMediatorCompetenceStatus(mediator, highlightOfferId) : null;

            // Work cycle display: pills (cycle week / contract type /
            // arrangement) + hatching for the displayed date
            const activeCycle = mediator.activeCycleId
              ? data.cycles.find(c => c.id === mediator.activeCycleId)
              : undefined;
            const pills = getPillsForMediator(mediator, data.cycles, selectedDate);
            const hatching = hatchingForDate(activeCycle, selectedDate, axisStartMin, axisEndMin);
            const workedHours = activeCycle
              ? getWorkedHoursForDate(activeCycle, selectedDate)
              : undefined;
            const dayName = selectedDate.toLocaleDateString('fr-FR', { weekday: 'long' });

            return (
              <div 
                key={mediator.id} 
                className={`daily-mediator-row${competenceStatus ? ` competence-${competenceStatus}` : ''}${printEmpty ? ' print-hidden' : ''}`}
              >
                <div className="daily-mediator-label">
                  <span className="slot-mediator-glyph daily-mediator-color" style={{ color: mediator.color || '#ccc' }}>●</span>
                  <span className="daily-mediator-idbox">
                    <span className="daily-mediator-name">
                      <span className="daily-mediator-nametext">{mediator.lastName} {mediator.firstName}</span>
                      {pills.cycleWeek && (
                        <span className="pill pill-week" title={`Semaine de cycle active : ${pills.cycleWeek}`}>{pills.cycleWeek}</span>
                      )}
                      {pills.contractType && (
                        <span className="pill pill-contract" title={`Type de contrat : ${pills.contractType}`}>{pills.contractType}</span>
                      )}
                      {pills.arrangement && (
                        <span className="pill pill-arrangement" title={`Aménagement du temps de travail : ${pills.arrangement}`}>{pills.arrangement}</span>
                      )}
                    </span>
                    {mediator.phone && <span className="daily-mediator-phone">{mediator.phone}</span>}
                  </span>
                </div>
                <div
                  className={`daily-mediator-track${hatching.kind === 'full' ? ' cycle-nonworked' : ''}`}
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
                  {axisHours.map(tick => (
                    <div
                      key={tick}
                      className="daily-hour-line"
                      style={{ left: `${(tick - axisStartMin) * pxPerMin}px`, width: `${tickWidth(tick)}px` }}
                    />
                  ))}

                  {/* Work-cycle hatching (outside the worked range, or the
                      whole track on a non-worked day). pointer-events: none
                      in CSS so slots stay clickable/draggable. */}
                  {hatching.kind === 'segments' && hatching.segments.map((seg, i) => (
                    <div
                      key={`hatch_${i}`}
                      className="daily-work-hatch"
                      style={{
                        left: `${(seg.startMin - axisStartMin) * pxPerMin}px`,
                        width: `${(seg.endMin - seg.startMin) * pxPerMin}px`,
                      }}
                      aria-hidden="true"
                    />
                  ))}
                  {hatching.kind === 'full' && (
                    <span className="daily-nonworked-note" aria-hidden="true">
                      {dayName} — jour non travaillé{pills.cycleWeek ? ` (semaine ${pills.cycleWeek})` : ''}
                    </span>
                  )}
                  {workedHours?.worked && (
                    <>
                      <span
                        className="daily-work-hours-tag"
                        style={{ left: `${(toMinutes(workedHours.startTime) - axisStartMin) * pxPerMin + 2}px` }}
                        aria-hidden="true"
                      >
                        {workedHours.startTime}
                      </span>
                      <span
                        className="daily-work-hours-tag"
                        style={{
                          left: `${(toMinutes(workedHours.endTime) - axisStartMin) * pxPerMin - 30}px`,
                        }}
                        aria-hidden="true"
                      >
                        {workedHours.endTime}
                      </span>
                    </>
                  )}

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
                    const space = spaceStyleFor(slot, offer);

                    // Total block = setup + booking + teardown.
                    // Durations: slot values override offer values (per-slot editable)
                    const total = getSlotTotalRange(slot, offer);
                    const effSetup = slot.setupTime ?? offer?.setupTime ?? 0;
                    const effTeardown = slot.teardownTime ?? offer?.teardownTime ?? 0;
                    const hasSetup = effSetup > 0;
                    const hasTeardown = effTeardown > 0;
                    const totalLeft = (toMinutes(total.start) - axisStartMin) * pxPerMin;
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
                        className={`daily-slot assigned${space.spaceClass}${isSelected ? ' selected' : ''}${isImported ? ' imported' : ''}`}
                        style={{
                          left: `${totalLeft}px`,
                          width: `${totalWidth}px`,
                          borderLeftColor: mediatorColor,
                          ...space.style,
                        }}
                        onClick={() => {
                          setSelectedSlot(slot);
                          setSlotModal({ slot, mediatorOnly: locked && isImported, defaultDate: slot.date });
                        }}
                        draggable
                        onDragStart={(e) => handleDragStart(e, 'slot', slot.id)}
                        onDragEnd={handleDragEnd}
                        title={`${formatSlotBookingSummary(slot, offer)}`}
                      >
                        {hasSetup && (
                          <div
                            className="slot-boundary setup-boundary"
                            style={{ left: `${bookingStartOffset}px` }}
                          ></div>
                        )}
                        <div className="slot-time">{slot.startTime} – {slot.endTime}</div>
                        {renderBlockLabel(offer)}
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

        {/* Free visits lane (Accueil Libre) — below mediators, above offers */}
        {freeVisitSlots.length > 0 && (
          <div className="daily-freevisits-section">
            <div className="daily-section-title">
              Réservations visites libres
              <span
                className="daily-unassigned-count"
                title="Réservations visites libres / réservations du jour"
              >
                {freeVisitSlots.length}/{daySlots.length}
              </span>
            </div>
            {computeParallelLanes(freeVisitSlots).map((laneSlots, laneIndex) => (
              <div key={laneIndex} className="daily-unassigned-row">
                <div className="daily-mediator-label">
                  <span className="daily-mediator-name">Libre</span>
                </div>
                <div
                  className="daily-mediator-track"
                  style={{
                    width: `${totalGridWidth}px`,
                    height: `${TRACK_HEIGHT}px`,
                    position: 'relative',
                  }}
                >
                  {axisHours.map(tick => (
                    <div
                      key={tick}
                      className="daily-hour-line"
                      style={{ left: `${(tick - axisStartMin) * pxPerMin}px`, width: `${tickWidth(tick)}px` }}
                    />
                  ))}
                  {laneSlots.map(slot => {
                    const offer = data.offers.find(o => o.id === slot.offerId);
                    const isSelected = selectedSlot?.id === slot.id;
                    const isImported = slot.origin === 'imported';
                    const space = spaceStyleFor(slot, offer);
                    return (
                      <div
                        key={slot.id}
                        className={`daily-slot free${space.spaceClass}${isSelected ? ' selected' : ''}${isImported ? ' imported' : ''}`}
                        style={{
                          left: `${getSlotTop(slot)}px`,
                          width: `${getSlotHeight(slot)}px`,
                          ...space.style,
                        }}
                        onClick={() => {
                          setSelectedSlot(slot);
                          setSlotModal({ slot, mediatorOnly: locked && isImported, defaultDate: slot.date });
                        }}
                        title={`${formatSlotBookingSummary(slot, offer)}\nVisite libre : aucun médiateur requis`}
                      >
                        <div className="slot-time">{slot.startTime} – {slot.endTime}</div>
                        {renderBlockLabel(offer)}
                        <div className="slot-mediator">Libre</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Space legend: swatches + names under the lanes (per mockup).
            Only rendered when the day uses at least one space. */}
        {legendSpaces.length > 0 && (
          <div className="daily-space-legend" aria-label="Légende des couleurs d'espace">
            <span className="daily-space-legend-title">Espaces :</span>
            {legendSpaces.map((space) => (
              <span key={space.id} className="daily-space-legend-item">
                <span
                  className="daily-space-swatch"
                  style={{ backgroundColor: space.color }}
                  aria-hidden="true"
                ></span>
                {space.name}
              </span>
            ))}
            <span className="daily-space-legend-item daily-space-legend-hint">
              <span className="offer-dot" aria-hidden="true"></span>
              pastille = couleur de l'offre
            </span>
          </div>
        )}

        {/* Standard offers lane — no time positioning */}
        <div className="daily-offers-section">
          <div className="daily-section-title">Offres non programmées (glissables)</div>
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
                  ? 'Aucune offre non programmée disponible.'
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
