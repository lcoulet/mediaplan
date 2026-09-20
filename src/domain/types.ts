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
  modifiedAfterImport: boolean;
  contractNumber?: string;
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
