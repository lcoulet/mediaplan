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
  // The mediator's active work cycle (see WorkCycle). A mediator has ONE
  // active cycle at a time; undefined = no cycle defined (legacy data).
  activeCycleId?: string;
  // Contract type (type de contrat): 'temps plein', 'stagiaire', ...
  // Free text, INDEPENDENT of the arrangement below (spec decision 1).
  contractType?: string;
  // Working-time arrangement (aménagement du temps de travail): 'temps
  // partiel', 'mi-temps thérapeutique', '80%', ... Free text. The quarterly
  // hour quota applies ONLY to mediators with an arrangement set; undefined
  // = no arrangement (no quota tracking).
  arrangement?: string;
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
  // Optional short label ("label court") shown in day-view blocks and
  // plan-accueil banners; falls back to the offer name when empty.
  shortLabel?: string;
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

// Work Cycle (Cycle de travail) — a mediator's recurring weekly schedule
// pattern: 1..N named cycle weeks rotating one per ISO week, anchored on an
// ISO week, with optional per-ISO-week forcing. See docs/LEXICON.md.

/** One day in a cycle week. startTime/endTime are absent when not worked. */
export interface CycleWeekDay {
  /** Day of week: 1 = Monday .. 7 = Sunday (ISO 8601). */
  day: number;
  /** Work start, 'HH:MM'. Undefined when the day is not worked. */
  startTime?: string;
  /** Work end, 'HH:MM'. Undefined when the day is not worked. */
  endTime?: string;
}

/** A named cycle week (S1, S2, ...) with one entry per day, Mon..Sun. */
export interface CycleWeek {
  id: string;
  name: string;
  /** Exactly 7 entries, one per day of week in Mon..Sun order. */
  days: CycleWeekDay[];
}

/** ISO week key of the form 'YYYY-Www', e.g. '2026-W41'. */
export type IsoWeekKey = string;

export interface WorkCycle {
  id: string;
  mediatorId: string;
  /** Ordered cycle weeks; the rotation walks them in order, then loops. */
  weeks: CycleWeek[];
  /**
   * ISO week where the rotation starts: weeks[0] is active during
   * anchorIsoWeek. Dates before the anchor follow the rotation backwards.
   */
  anchorIsoWeek: IsoWeekKey;
  /** Manual overrides: ISO week key -> cycle week NAME. Absolute precedence. */
  forcedWeeks: Record<IsoWeekKey, string>;
}

/**
 * Quarterly hour quota for a mediator with a working-time arrangement
 * (aménagement). One entry per mediator/year/quarter; a quarter without an
 * entry tracks nothing. `effectiveFrom` is the date the quota configuration
 * became effective: only slots ON OR AFTER that date consume it (mid-quarter
 * arrangement changes don't retroactively count earlier slots).
 */
export interface QuarterlyQuota {
  id: string;
  mediatorId: string;
  /** Calendar year of the quarter (e.g. 2026). */
  year: number;
  /** Calendar quarter: 1 (Jan-Mar) .. 4 (Oct-Dec). */
  quarter: 1 | 2 | 3 | 4;
  /** Quota in hours; may be fractional (e.g. 120.5). */
  hours: number;
  /** ISO date from which the quota counts (inclusive). */
  effectiveFrom: string;
}

/**
 * App-level valorisation settings (persisted). Public holidays count ×2
 * (fixed); the Sunday and valued-Saturday multipliers are configurable.
 * The French holiday list is auto-computed per year; `holidayOverrides`
 * stores per-year modifications (add/remove) against that default.
 */
export interface ValorisationConfig {
  /** Multiplier for Sundays (default 1.5). */
  sundayMultiplier: number;
  /**
   * Saturdays from the Nth Saturday of the year ONWARD are valued
   * (1-based index, default 12); earlier Saturdays count ×1.
   */
  valuedSaturdayThreshold: number;
  /** Multiplier for valued Saturdays (default 1.5). */
  valuedSaturdayMultiplier: number;
  /**
   * Per-year holiday list overrides: year ('2026') -> full list of ISO
   * dates replacing the auto-computed French holidays for that year.
   * Years absent from this map use the auto-computed list.
   */
  holidayOverrides: Record<string, string[]>;
}

/**
 * Space (Espace) — a named, colored place where offers and slots take
 * place (Salle Bronze, Auditorium, …). Referenced BY NAME from
 * offer.location / slot.location. White (#FFFFFF) is reserved for spaces
 * auto-created by the Secutix import (unmapped ESPACE values).
 */
export interface Space {
  id: string;
  name: string;
  /** Hexadecimal color, e.g. #4A90D9. */
  color: string;
}

export interface AppData {
  mediators: Mediator[];
  offers: Offer[];
  schedules: Schedule[];
  slots: Slot[];
  absences: Absence[];
  // Work cycles, one active per mediator (see WorkCycle). Legacy data
  // persisted before the feature existed loads as [].
  cycles: WorkCycle[];
  // Quarterly hour quotas (see QuarterlyQuota). Legacy data persisted
  // before the feature existed loads as [].
  quotas: QuarterlyQuota[];
  // Spaces (see Space). Legacy data persisted before the feature existed
  // is migrated from free-text locations on load.
  spaces: Space[];
  // Valorisation settings (multipliers, holiday overrides). Legacy data
  // loads with defaults.
  valorisation?: ValorisationConfig;
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
