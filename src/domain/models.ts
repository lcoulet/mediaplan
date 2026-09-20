// models.ts — Data models and ID generation

import type {
  Mediator,
  Offer,
  Schedule,
  Slot,
  Absence,
  SlotStatus,
  ScheduleStatus,
  SlotOrigin,
  AbsenceHalfDay,
  AbsenceType,
} from './types';

let idCounter = 0;

export function generateId(prefix = 'id'): string {
  idCounter++;
  return `${prefix}_${Date.now().toString(36)}_${idCounter.toString(36)}`;
}

// Format a Date as local-timezone ISO date (YYYY-MM-DD).
// toISOString() returns UTC and shifts the day for non-UTC timezones
// (e.g. Toulouse UTC+2: local Monday 00:00 becomes Sunday 22:00 UTC),
// which corrupted week-start calculations and URL date params.
export function toLocalDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Parse a YYYY-MM-DD string as LOCAL midnight.
// new Date('YYYY-MM-DD') parses as UTC midnight, which shifts the day
// in non-UTC timezones — use this for URL params and ISO dates.
export function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

// ---- Slot total range (setup + booking + teardown) ----

function timeToMinutes(t: string): number {
  const [h, m] = (t || '0:0').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function minutesToTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// Total duration an offer occupies: booking + setup before + teardown after.
export function getOfferTotalDuration(offer: Offer): number {
  return offer.duration + (offer.setupTime || 0) + (offer.teardownTime || 0);
}

// Total block covered by a slot on the planning: setup starts before the
// booking, teardown ends after it. The stored slot hours remain the REAL
// booking period; this is display/collision geometry.
// Durations: the SLOT's own values take precedence (editable per slot,
// regardless of lock state); when absent (legacy data) the OFFER's values
// apply.
export function getSlotTotalRange(
  slot: Slot,
  offer: Offer | undefined
): { start: string; end: string } {
  const setup = slot.setupTime ?? offer?.setupTime ?? 0;
  const teardown = slot.teardownTime ?? offer?.teardownTime ?? 0;
  const startMin = timeToMinutes(slot.startTime);
  const endMin = timeToMinutes(slot.endTime);
  // Guard against invalid/missing slot hours: don't derive negative times
  if (!slot.startTime || !slot.endTime) {
    return { start: '00:00', end: '00:00' };
  }
  return {
    start: minutesToTime(Math.max(0, startMin - setup)),
    end: minutesToTime(Math.max(0, endMin + teardown)),
  };
}

// When a user drops an offer at a cursor position, the cursor marks the
// START OF THE TOTAL BLOCK. The real booking starts after setup and its
// duration is the offer's booking duration.
export function slotBookingFromDropPosition(
  cursorTime: string,
  offer: Offer
): { startTime: string; endTime: string } {
  const cursorMin = timeToMinutes(cursorTime);
  const setup = offer.setupTime || 0;
  const bookingStart = cursorMin + setup;
  return {
    startTime: minutesToTime(bookingStart),
    endTime: minutesToTime(bookingStart + offer.duration),
  };
}

// Mediator
const MEDIATOR_COLORS = [
  '#2c6e49', '#d68c45', '#2980b9', '#8e44ad',
  '#c0392b', '#16a085', '#d35400', '#34495e',
];
let colorIndex = 0;

interface MediatorInput {
  id?: string;
  lastName?: string;
  firstName?: string;
  email?: string;
  phone?: string;
  competences?: { offerId: string; status: 'confirmed' | 'learning' }[];
  active?: boolean;
  color?: string;
  notes?: string;
}

export function createMediator(data: MediatorInput = {}): Mediator {
  return {
    id: data.id || generateId('med'),
    lastName: data.lastName || '',
    firstName: data.firstName || '',
    email: data.email || '',
    phone: data.phone || '',
    competences: data.competences || [],
    active: data.active !== undefined ? data.active : true,
    color: data.color || MEDIATOR_COLORS[colorIndex++ % MEDIATOR_COLORS.length],
    notes: data.notes || '',
  };
}

// Mediation Offer
const OFFER_COLORS = [
  '#8e44ad', '#2980b9', '#27ae60', '#d35400',
  '#c0392b', '#16a085', '#f39c12', '#2c3e50',
];
let offerColorIndex = 0;

interface OfferInput {
  id?: string;
  name?: string;
  description?: string;
  duration?: number;
  capacity?: number;
  location?: string;
  setupTime?: number;
  teardownTime?: number;
  color?: string;
}

export function createOffer(data: OfferInput = {}): Offer {
  return {
    id: data.id || generateId('off'),
    name: data.name || '',
    description: data.description || '',
    duration: data.duration || 60,
    capacity: data.capacity || 30,
    location: data.location || '',
    ...(data.setupTime !== undefined ? { setupTime: data.setupTime } : {}),
    ...(data.teardownTime !== undefined ? { teardownTime: data.teardownTime } : {}),
    // Assign a palette color when none provided (tests rely on this default)
    color: data.color || OFFER_COLORS[offerColorIndex++ % OFFER_COLORS.length],
  };
}

/** Default color for an offer that has none (e.g. legacy persisted data). */
export function defaultOfferColor(): string {
  return OFFER_COLORS[offerColorIndex++ % OFFER_COLORS.length];
}

// Schedule
interface ScheduleInput {
  id?: string;
  title?: string;
  startDate?: string;
  endDate?: string;
  status?: ScheduleStatus;
  locked?: boolean;
}

export function createSchedule(data: ScheduleInput = {}): Schedule {
  return {
    id: data.id || generateId('sch'),
    title: data.title || '',
    startDate: data.startDate || '',
    endDate: data.endDate || '',
    status: data.status || 'draft',
    locked: data.locked !== undefined ? data.locked : false,
  };
}

// Reservation / Slot
interface SlotInput {
  id?: string;
  scheduleId?: string;
  offerId?: string;
  mediatorIds?: string[];
  mediatorId?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  participantCount?: number;
  status?: SlotStatus;
  notes?: string;
  origin?: SlotOrigin;
  importSource?: string;
  importedAt?: string;
  modifiedAfterImport?: boolean;
  contractNumber?: string;
  setupTime?: number;
  teardownTime?: number;
}

export function createSlot(data: SlotInput = {}): Slot {
  // Migrate from mediatorId (singular) to mediatorIds (array)
  // If mediatorIds is provided, use it. Otherwise convert mediatorId.
  let mediatorIds: string[];
  if (data.mediatorIds !== undefined) {
    mediatorIds = data.mediatorIds;
  } else if (data.mediatorId) {
    mediatorIds = [data.mediatorId];
  } else {
    mediatorIds = [];
  }
  return {
    id: data.id || generateId('slot'),
    scheduleId: data.scheduleId || '',
    offerId: data.offerId || '',
    mediatorIds,
    date: data.date || '',
    startTime: data.startTime || '09:00',
    endTime: data.endTime || '10:00',
    participantCount: data.participantCount || 0,
    status: data.status || 'planned',
    notes: data.notes || '',
    origin: data.origin || 'manual',
    importSource: data.importSource || '',
    importedAt: data.importedAt || '',
    modifiedAfterImport: data.modifiedAfterImport !== undefined ? data.modifiedAfterImport : false,
    // Optional per-slot logistics durations (minutes). Left undefined on
    // purpose when not provided: the offer's values apply (legacy behavior).
    ...(data.setupTime !== undefined ? { setupTime: data.setupTime } : {}),
    ...(data.teardownTime !== undefined ? { teardownTime: data.teardownTime } : {}),
  };
}

// Mediator Unavailability (Absence)
interface AbsenceInput {
  id?: string;
  mediatorId?: string;
  startDate?: string;
  endDate?: string;
  halfDay?: AbsenceHalfDay;
  type?: AbsenceType;
  notes?: string;
  startTime?: string;
  endTime?: string;
}

export function createAbsence(data: AbsenceInput = {}): Absence {
  return {
    id: data.id || generateId('abs'),
    mediatorId: data.mediatorId || '',
    startDate: data.startDate || '',
    endDate: data.endDate || '',
    halfDay: data.halfDay || 'none',
    type: data.type || 'other',
    notes: data.notes || '',
    startTime: data.startTime,
    endTime: data.endTime,
  };
}

// Check if a mediator is available for a given date/time, given a list of absences
// Uses configurable half-day boundaries from halfDayConfig if provided
export function isMediatorAvailable(
  mediatorId: string,
  date: string,
  startTime: string,
  endTime: string,
  absences: Absence[],
  halfDayConfig?: { morningEnd: string; afternoonStart: string }
): boolean {
  // Use configurable times or fall back to noon
  const morningEnd = halfDayConfig?.morningEnd || '12:00';
  const afternoonStart = halfDayConfig?.afternoonStart || '12:00';
  
  for (const abs of absences) {
    if (abs.mediatorId !== mediatorId) continue;
    // Check if date falls within the absence range (inclusive)
    if (date < abs.startDate || date > abs.endDate) continue;

    if (abs.halfDay === 'none') {
      return false; // full-day absence
    }
    if (abs.halfDay === 'morning' && startTime < morningEnd) {
      return false;
    }
    if (abs.halfDay === 'afternoon' && endTime > afternoonStart) {
      return false;
    }
  }
  return true;
}

// Status labels (FR)
export const STATUS_LABELS = {
  schedule: {
    draft: 'Brouillon',
    published: 'Publié',
    archived: 'Archivé',
  },
  slot: {
    planned: 'Planifié',
    confirmed: 'Confirmé',
    cancelled: 'Annulé',
    completed: 'Terminé',
  },
} as const;

// Absence type labels (FR)
export const ABSENCE_TYPE_LABELS = {
  leave: 'Congés (CP/RTT)',
  mission: 'Mission',
  training: 'Formation',
  sick: 'Maladie',
  other: 'Autre',
  leave_request: 'Souhait de congés',
} as const;

// Origin labels (FR)
export const ORIGIN_LABELS = {
  manual: 'Saisie manuelle',
  imported: 'Importé',
} as const;

// Check if assigning a mediator to a time slot overlaps with their existing slots
// excludeSlotId: the slot being edited (to ignore itself)
// Supports both mediatorIds (array) and legacy mediatorId (string)
export function hasMediatorOverlap(
  mediatorId: string,
  date: string,
  startTime: string,
  endTime: string,
  slots: Slot[],
  excludeSlotId?: string
): boolean {
  if (!mediatorId) return false;
  for (const s of slots) {
    if (s.id === excludeSlotId) continue;
    if (s.date !== date) continue;
    // Check if mediator is assigned to this slot (mediatorIds or legacy mediatorId)
    const slotMediators = s.mediatorIds || ((s as Slot & { mediatorId?: string }).mediatorId ? [(s as Slot & { mediatorId?: string }).mediatorId!] : []);
    if (!slotMediators.includes(mediatorId)) continue;
    // Overlap: startA < endB && startB < endA
    if (startTime < s.endTime && s.startTime < endTime) {
      return true;
    }
  }
  return false;
}

// Validate and normalize competences: ensure no duplicate offerId with different statuses
// If an offer is both 'confirmed' and 'learning', keep only 'confirmed'
export function normalizeCompetences(competences: { offerId: string; status: 'confirmed' | 'learning' }[]): { offerId: string; status: 'confirmed' | 'learning' }[] {
  const map = new Map<string, 'confirmed' | 'learning'>();
  
  // Process in order, 'confirmed' takes precedence over 'learning'
  for (const c of competences) {
    const existing = map.get(c.offerId);
    if (existing === 'confirmed') {
      // Already confirmed, skip
      continue;
    }
    // If existing is 'learning' and new is 'confirmed', upgrade
    // Otherwise keep the existing or add the new one
    if (c.status === 'confirmed' || !existing) {
      map.set(c.offerId, c.status);
    }
  }
  
  return Array.from(map.entries()).map(([offerId, status]) => ({ offerId, status }));
}

// Check if a mediator knows an offer (confirmed or learning)
export function mediatorKnowsOffer(mediator: Mediator, offerId: string): boolean {
  return mediator.competences.some(c => c.offerId === offerId);
}

// Check if a mediator is confirmed for an offer
export function mediatorConfirmedForOffer(mediator: Mediator, offerId: string): boolean {
  return mediator.competences.some(c => c.offerId === offerId && c.status === 'confirmed');
}

// Check if a mediator is learning an offer
export function mediatorLearningOffer(mediator: Mediator, offerId: string): boolean {
  return mediator.competences.some(c => c.offerId === offerId && c.status === 'learning');
}

// Get default half-day configuration
export function getDefaultHalfDayConfig() {
  return {
    morningEnd: '13:00',
    afternoonStart: '13:00',
  };
}

// Get time range for an absence based on halfDay and config
export function getAbsenceTimeRange(
  absence: Absence,
  config?: { morningEnd: string; afternoonStart: string }
): { startTime: string; endTime: string } {
  const defaultConfig = getDefaultHalfDayConfig();
  const morningEnd = config?.morningEnd || defaultConfig.morningEnd;
  const afternoonStart = config?.afternoonStart || defaultConfig.afternoonStart;

  // If absence already has explicit times, use them
  if (absence.startTime && absence.endTime) {
    return { startTime: absence.startTime, endTime: absence.endTime };
  }

  // Derive from halfDay
  switch (absence.halfDay) {
    case 'none':
      return { startTime: '00:00', endTime: '23:59' };
    case 'morning':
      return { startTime: '00:00', endTime: morningEnd };
    case 'afternoon':
      return { startTime: afternoonStart, endTime: '23:59' };
    default:
      return { startTime: '00:00', endTime: '23:59' };
  }
}

// Migrate all future absences to use new time config
export function migrateAbsencesToConfig(
  absences: Absence[],
  config: { morningEnd: string; afternoonStart: string }
): Absence[] {
  const today = new Date().toISOString().slice(0, 10);
  
  return absences.map(abs => {
    // Only migrate future absences (endDate >= today)
    if (abs.endDate < today) {
      return abs;
    }
    
    // Get the time range based on current halfDay
    const timeRange = getAbsenceTimeRange(abs, config);
    
    return {
      ...abs,
      startTime: timeRange.startTime,
      endTime: timeRange.endTime,
    };
  });
}

// Get competence status for a mediator and offer
export function getCompetenceStatus(mediator: Mediator, offerId: string): 'confirmed' | 'learning' | null {
  const competence = mediator.competences.find(c => c.offerId === offerId);
  return competence ? competence.status : null;
}

// Format an ISO 8601 timestamp to a French human-friendly string
// e.g. "2026-09-14T19:30:00.000Z" → "14 sept. 2026 à 19:30"
export function formatImportDate(isoString: string | null | undefined): string {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    const dateStr = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
    const timeStr = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    return `${dateStr} à ${timeStr}`;
  } catch {
    return '';
  }
}
