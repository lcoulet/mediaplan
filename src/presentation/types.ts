// types.ts — Presentation-layer state and actions

import type {
  AppData,
  Mediator,
  Offer,
  Slot,
  Absence,
  SlotStatus,
  AbsenceType,
  AbsenceHalfDay,
} from '../domain/types';

export type ViewName = 'weekly' | 'daily' | 'mediators' | 'offers' | 'absences' | 'import-export';

export interface Filters {
  mediatorId: string;
  offerId: string;
}

export interface AbsenceFilter {
  mediatorId: string;
}

export interface AppState {
  data: AppData;
  currentView: ViewName;
  currentWeekStart: Date;
  filters: Filters;
  absenceFilter: AbsenceFilter;
  locked: boolean;
  showAbsences: boolean;
}

// ---- Modal state ----

export type ModalType =
  | 'mediator'
  | 'offer'
  | 'slot'
  | 'absence'
  | 'slot-detail'
  | null;

export interface ModalState {
  type: ModalType;
  // Entity being edited (null = new entity)
  mediator: Mediator | null;
  offer: Offer | null;
  slot: Slot | null;
  absence: Absence | null;
  // Slot modal options
  mediatorOnly: boolean;
  defaultDate: string;
}

// ---- Actions ----

export type Action =
  | { type: 'SET_DATA'; data: AppData }
  | { type: 'SET_VIEW'; view: ViewName }
  | { type: 'SET_WEEK_START'; date: Date }
  | { type: 'SET_FILTER_MEDIATOR'; mediatorId: string }
  | { type: 'SET_FILTER_OFFER'; offerId: string }
  | { type: 'SET_ABSENCE_FILTER_MEDIATOR'; mediatorId: string }
  | { type: 'SET_LOCKED'; locked: boolean }
  | { type: 'SET_SHOW_ABSENCES'; show: boolean }
  // CRUD operations that also commit to history
  | { type: 'ADD_MEDIATOR'; mediator: Mediator }
  | { type: 'UPDATE_MEDIATOR'; mediator: Mediator }
  | { type: 'DELETE_MEDIATOR'; id: string }
  | { type: 'ADD_OFFER'; offer: Offer }
  | { type: 'UPDATE_OFFER'; offer: Offer }
  | { type: 'DELETE_OFFER'; id: string }
  | { type: 'ADD_SLOT'; slot: Slot }
  | { type: 'UPDATE_SLOT'; slot: Slot }
  | { type: 'DELETE_SLOT'; id: string }
  | { type: 'ADD_ABSENCE'; absence: Absence }
  | { type: 'UPDATE_ABSENCE'; absence: Absence }
  | { type: 'DELETE_ABSENCE'; id: string }
  // Undo/redo
  | { type: 'UNDO'; data: AppData }
  | { type: 'REDO'; data: AppData }
  | { type: 'RESET_DATA'; data: AppData };

export const SlotStatusValues: SlotStatus[] = ['planned', 'confirmed', 'cancelled', 'completed'];
export const AbsenceTypeValues: AbsenceType[] = ['leave', 'mission', 'training', 'sick', 'other'];
export const AbsenceHalfDayValues: AbsenceHalfDay[] = ['none', 'morning', 'afternoon'];

export const HALF_DAY_LABELS: Record<AbsenceHalfDay, string> = {
  none: 'Journée complète',
  morning: 'Matin',
  afternoon: 'Après-midi',
};
