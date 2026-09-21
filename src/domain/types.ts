// types.ts — Entity interfaces for the MediaPlan domain

export interface Mediator {
  id: string;
  lastName: string;
  firstName: string;
  email: string;
  phone: string;
  competences: { offerId: string; status: 'confirmed' | 'learning' }[];
  active: boolean;
  color: string;
  notes: string;
}

export interface Offer {
  id: string;
  name: string;
  description: string;
  duration: number;
  capacity: number;
  location: string;
  setupTime?: number;
  teardownTime?: number;
  color?: string;
  welcomeType: 'Accueil Libre' | 'Réservable encadrée par médiateur' | 'Animation par médiateur';
  // Label of this offer in Secutix exports ("THÈME" column), used to
  // reconcile imported reservations with the offer catalog. Optional:
  // offers never imported from Secutix have none.
  secutixLabel?: string;
}

export type ScheduleStatus = 'draft' | 'published' | 'archived';

export interface Schedule {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  status: ScheduleStatus;
  locked: boolean;
}

export type SlotStatus = 'planned' | 'confirmed' | 'cancelled' | 'completed';
export type SlotOrigin = 'manual' | 'imported';

export interface Slot {
  id: string;
  scheduleId: string;
  offerId: string;
  mediatorIds: string[];
  date: string;
  startTime: string;
  endTime: string;
  participantCount: number;
  status: SlotStatus;
  notes: string;
  origin: SlotOrigin;
  importSource: string;
  importedAt: string;
  // Creation timestamp (ISO 8601), stamped at creation for every slot.
  // Optional: slots persisted before the field existed have none.
  createdAt?: string;
  modifiedAfterImport: boolean;
  // Secutix "N° DOSSIER D'ACHAT" — the purchase contract. NOT unique per
  // slot: one contract can cover several bookings (e.g. entry + guided
  // tour). Used for reconciliation together with offer, date, time and
  // group name.
  contractNumber?: string;
  // Booking details, from the Secutix import or manual entry
  // ("NOM DU GROUPE")
  groupName: string;
  // Secutix "GUIDE" column — free text, usually empty in exports
  guide: string;
  // Secutix "ESPACE" — overrides the offer's default location when set
  location: string;
  // Secutix "SITE" (e.g. DCSTI_MHN) — informational, shown in tooltips.
  // Optional: manual slots and legacy data have none.
  site?: string;
  // Secutix "NATURE DU GROUPE" — free text (e.g. SCOLAIRES C2, PSH)
  groupNature: string;
  // Secutix contact details of the purchase contract
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  // Logistics durations in minutes, editable per-slot regardless of lock
  // state. Default to the offer's values at creation. When undefined
  // (legacy data), the offer's values are used.
  setupTime?: number;
  teardownTime?: number;
}

export type AbsenceHalfDay = 'none' | 'morning' | 'afternoon';
export type AbsenceType = 'leave' | 'mission' | 'training' | 'sick' | 'other' | 'leave_request';

export interface Absence {
  id: string;
  mediatorId: string;
  startDate: string;
  endDate: string;
  halfDay: AbsenceHalfDay;
  type: AbsenceType;
  notes: string;
  // Hidden time properties for display as slots
  startTime?: string; // HH:mm
  endTime?: string;   // HH:mm
}

export interface AppData {
  mediators: Mediator[];
  offers: Offer[];
  schedules: Schedule[];
  slots: Slot[];
  absences: Absence[];
  halfDayConfig?: {
    morningEnd: string;
    afternoonStart: string;
  };
}

export interface ExportMetadata {
  lastModified: string;
  exportedAt: string;
  version: number;
}
