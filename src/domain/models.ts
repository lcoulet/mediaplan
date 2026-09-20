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
