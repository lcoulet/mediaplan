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
  skills?: string[];
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
    skills: data.skills || [],
    active: data.active !== undefined ? data.active : true,
    color: data.color || MEDIATOR_COLORS[colorIndex++ % MEDIATOR_COLORS.length],
    notes: data.notes || '',
  };
}

// Mediation Offer
interface OfferInput {
  id?: string;
  name?: string;
  description?: string;
  duration?: number;
  capacity?: number;
  location?: string;
  setupTime?: number;
  teardownTime?: number;
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
  };
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
export function isMediatorAvailable(
  mediatorId: string,
  date: string,
  startTime: string,
  endTime: string,
  absences: Absence[]
): boolean {
  const noon = '12:00';
  for (const abs of absences) {
    if (abs.mediatorId !== mediatorId) continue;
    // Check if date falls within the absence range (inclusive)
    if (date < abs.startDate || date > abs.endDate) continue;

    if (abs.halfDay === 'none') {
      return false; // full-day absence
    }
    if (abs.halfDay === 'morning' && startTime < noon) {
      return false;
    }
    if (abs.halfDay === 'afternoon' && endTime > noon) {
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
