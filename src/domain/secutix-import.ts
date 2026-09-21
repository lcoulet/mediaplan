// secutix-import.ts — Secutix export synchronization (pure logic, no browser APIs)
//
// The Secutix ticketing system exports an Excel file ("visitPlanning" sheet,
// header on row 2, one booking per row, trailing "Total" row). This module
// turns raw rows into a full synchronization plan:
//   normalize → filter + dedupe + parse
//   reconcile → match THÈME labels to offers via offer.secutixLabel
//   plan      → create / update / deallocate slots
//   apply     → merge the plan into the AppData in one pass (single undo step)
//
// Rules (see docs/business-specs.md "Secutix Import"):
// - rows with theme "G/ Droit d'accès" (entry fees) are not mediation bookings
// - booking times from the file take priority over the offer's default duration
// - the dossier d'achat covers several slots: the dedup key is the composite
//   (contract + theme + date + startTime + groupName)
// - "deallocate" = a Secutix-imported slot whose booking left the file: its
//   mediator assignments are removed and its status becomes "cancelled"
//   (the slot stays visible so the team sees the cancellation)

import { createSlot, createOffer } from './models';
import type { AppData, Offer, Slot } from './types';

/** Theme of rows that are entry fees, not mediation bookings. */
export const ACCESS_RIGHT_THEME = "G/ Droit d'accès";

/** Source label stamped on slots created by the Secutix import. */
export const SECUTIX_SOURCE = 'Secutix';

// ---------------------------------------------------------------------------
// Raw row straight from the export (cell strings, one entry per column)
// ---------------------------------------------------------------------------
export interface SecutixRow {
  /** "DATE HEURE DU PRODUIT" — "dd.mm.yyyy HH:MM" */
  productDateTime: string;
  /** "PRODUIT" — product name (informational) */
  product: string;
  /** "NOM DU GROUPE" */
  groupName: string;
  /** "GUIDE" — free text, usually empty */
  guide: string;
  /** "THÈME" — the Secutix offer label (matches offer.secutixLabel) */
  theme: string;
  /** "N° DOSSIER D'ACHAT" — purchase contract, NOT unique per booking */
  contractNumber: string;
  /** "DURÉE" — "H:MM" booking duration */
  duration: string;
  /** "SITE" — not imported */
  site: string;
  /** "ESPACE" — the space used by this booking */
  location: string;
  /** "LANGUE DE VISITE" — not imported */
  visitLanguage: string;
  /** "TYPE OPÉRATION" — not imported */
  operationType: string;
  /** "NATURE DU GROUPE" */
  groupNature: string;
  /** "NB TOTAL DE PERSONNES PAR GUIDE" */
  participantCount: string;
  /** "CONTACT DU DOSSIER D'ACHAT" */
  contactName: string;
  /** "TÉLÉPHONE DU CONTACT DU DOSSIER" */
  contactPhone: string;
  /** "EMAIL DU CONTACT DU DOSSIER" */
  contactEmail: string;
  /** "REMARQUE" — lands in slot notes */
  remark: string;
  /** "ETAT DE LA VISITE" — not imported */
  visitState: string;
  /** "HEURE D'ARRIVÉE PRÉVUE" — not imported */
  plannedArrivalTime: string;
}

/** A normalized, importable Secutix booking. */
export interface SecutixBooking {
  /** ISO 8601 date */
  date: string;
  /** HH:MM */
  startTime: string;
  /** HH:MM — start + DURÉE, clamped to 23:59 */
  endTime: string;
  /** Secutix offer label */
  theme: string;
  contractNumber: string;
  groupName: string;
  guide: string;
  location: string;
  groupNature: string;
  participantCount: number;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  notes: string;
}

export interface SecutixNormalization {
  /** Deduplicated, importable bookings */
  bookings: SecutixBooking[];
  /** Rows dropped because they share the composite key with an earlier row */
  duplicateRowCount: number;
  /** Rows without a parsable "DATE HEURE DU PRODUIT" (empty rows, Total row) */
  skippedRows: number;
  /** Rows with theme "G/ Droit d'accès" (entry fees) */
  accessRightRows: number;
}

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

const DATE_TIME_RE = /^(\d{2})\.(\d{2})\.(\d{4})[ T](\d{2}):(\d{2})/;
const DAY_END = '23:59';

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Parse "H:MM" (Secutix DURÉE) into minutes; 0 when unparsable. */
function parseDurationMinutes(raw: string): number {
  const match = /^(\d+):(\d{2})$/.exec(raw.trim());
  if (!match) return 0;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

/** Composite dedup key: contract + theme + date + startTime + groupName. */
export function getSecutixBookingKey(booking: {
  contractNumber: string;
  theme: string;
  date: string;
  startTime: string;
  groupName: string;
}): string {
  return [booking.contractNumber, booking.theme, booking.date, booking.startTime, booking.groupName]
    .map((p) => p.trim())
    .join('§');
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

/**
 * Parse raw export rows into importable bookings:
 * - skip rows without a parsable product datetime (empty rows, Total row)
 * - skip "G/ Droit d'accès" rows (entry fees, not mediation bookings)
 * - compute endTime = startTime + DURÉE (file times take priority over the
 *   offer's default duration), clamped to 23:59
 * - deduplicate rows sharing the composite key (first occurrence wins)
 */
export function normalizeSecutixRows(rows: SecutixRow[]): SecutixNormalization {
  const bookings: SecutixBooking[] = [];
  const seenKeys = new Set<string>();
  let duplicateRowCount = 0;
  let skippedRows = 0;
  let accessRightRows = 0;

  for (const raw of rows) {
    const match = DATE_TIME_RE.exec(raw.productDateTime || '');
    if (!match) {
      skippedRows++;
      continue;
    }
    if (raw.theme?.trim() === ACCESS_RIGHT_THEME) {
      accessRightRows++;
      continue;
    }

    const date = `${match[3]}-${match[2]}-${match[1]}`;
    const startTime = `${match[4]}:${match[5]}`;
    const endMinutes = Math.min(
      toMinutes(startTime) + parseDurationMinutes(raw.duration),
      toMinutes(DAY_END)
    );

    const booking: SecutixBooking = {
      date,
      startTime,
      endTime: minutesToTime(endMinutes),
      theme: raw.theme?.trim() || '',
      contractNumber: raw.contractNumber?.trim() || '',
      groupName: raw.groupName?.trim() || '',
      guide: raw.guide?.trim() || '',
      location: raw.location?.trim() || '',
      groupNature: raw.groupNature?.trim() || '',
      participantCount: parseInt(raw.participantCount, 10) || 0,
      contactName: raw.contactName?.trim() || '',
      contactPhone: raw.contactPhone?.trim() || '',
      contactEmail: raw.contactEmail?.trim() || '',
      notes: raw.remark?.trim() || '',
    };

    const key = getSecutixBookingKey(booking);
    if (seenKeys.has(key)) {
      duplicateRowCount++;
      continue;
    }
    seenKeys.add(key);
    bookings.push(booking);
  }

  return { bookings, duplicateRowCount, skippedRows, accessRightRows };
}

// ---------------------------------------------------------------------------
// Offer reconciliation
// ---------------------------------------------------------------------------

/** Collapsed-key comparison: the export contains double spaces in labels. */
function normalizeLabel(label: string): string {
  return label.trim().replace(/\s+/g, ' ');
}

export interface OfferMatch {
  booking: SecutixBooking;
  offerId: string;
}

export interface OfferReconciliation {
  /** Bookings whose THÈME matched an offer's secutixLabel */
  matched: OfferMatch[];
  /** Distinct unmatched labels, sorted (import cannot proceed until mapped) */
  unmatchedLabels: string[];
  /** Bookings behind the unmatched labels */
  unmatchedBookings: SecutixBooking[];
}

/**
 * Match booking THÈME labels to offers via offer.secutixLabel, tolerating
 * whitespace differences. Unmatched labels are reported so the user can map
 * or create the offers — the import must not silently create slots.
 */
export function reconcileOffers(bookings: SecutixBooking[], offers: Offer[]): OfferReconciliation {
  const byLabel = new Map<string, string>();
  for (const offer of offers) {
    if (offer.secutixLabel) {
      byLabel.set(normalizeLabel(offer.secutixLabel), offer.id);
    }
  }

  const matched: OfferMatch[] = [];
  const unmatchedBookings: SecutixBooking[] = [];
  const unmatchedLabelSet = new Set<string>();

  for (const booking of bookings) {
    const offerId = byLabel.get(normalizeLabel(booking.theme));
    if (offerId !== undefined) {
      matched.push({ booking, offerId });
    } else {
      unmatchedBookings.push(booking);
      unmatchedLabelSet.add(booking.theme);
    }
  }

  return {
    matched,
    unmatchedLabels: Array.from(unmatchedLabelSet).sort((a, b) => a.localeCompare(b)),
    unmatchedBookings,
  };
}

/**
 * Suggest an offer for an unmatched Secutix label: name and secutixLabel from
 * the label, most common espace as default location, most common booking
 * duration as default duration. The user can adjust before creating it.
 */
export function suggestOfferFromLabel(label: string, bookings: SecutixBooking[]): Offer {
  const forLabel = bookings.filter((b) => b.theme === label);
  const countMostCommon = (values: string[]): string | undefined => {
    const counts = new Map<string, number>();
    for (const v of values) {
      if (v) counts.set(v, (counts.get(v) || 0) + 1);
    }
    let best: string | undefined;
    let bestCount = 0;
    for (const [v, c] of counts) {
      if (c > bestCount) {
        best = v;
        bestCount = c;
      }
    }
    return best;
  };

  const location = countMostCommon(forLabel.map((b) => b.location));
  const durationLabel = countMostCommon(forLabel.map((b) => String(toMinutes(b.endTime) - toMinutes(b.startTime))));

  return createOffer({
    name: label,
    secutixLabel: label,
    ...(location ? { location } : {}),
    ...(durationLabel ? { duration: parseInt(durationLabel, 10) } : {}),
  });
}

// ---------------------------------------------------------------------------
// User choices on top of the reconciliation
// ---------------------------------------------------------------------------

/** Per-label user decision during the import review. */
export type SecutixLabelChoice =
  | { action: 'map'; offerId: string } // re-link to an existing/created offer
  | { action: 'ignore' }; // do not import these bookings

export interface SecutixChoiceResolution {
  /** Bookings that will be imported, with their target offer */
  matched: OfferMatch[];
  /** Distinct labels still lacking a valid decision (blocking the import) */
  pendingLabels: string[];
  /** Bookings dropped by an explicit "ignore" decision */
  ignoredCount: number;
}

/**
 * Compose the automatic reconciliation with the user's per-label choices:
 * - a "map" choice re-links every booking of the label to the chosen offer
 *   (existing, or created from the label during this import)
 * - an "ignore" choice drops the label's bookings from the import — they are
 *   not created, not updated, and their slots are never deallocated
 * - labels with no valid choice stay pending and block the import
 * Auto-matching (secutixLabel) applies first, so created offers match their
 * label without an explicit "map" entry.
 */
export function resolveSecutixChoices(
  bookings: SecutixBooking[],
  offers: Offer[],
  createdOffers: Offer[],
  choices: Record<string, SecutixLabelChoice | undefined>
): SecutixChoiceResolution {
  const allOffers = [...offers, ...createdOffers];
  const rec = reconcileOffers(bookings, allOffers);

  const byId = new Map(allOffers.map((o) => [o.id, o]));
  const matched = [...rec.matched];
  const pendingLabelSet = new Set<string>();
  let ignoredCount = 0;

  for (const booking of rec.unmatchedBookings) {
    const choice = choices[booking.theme];
    if (choice?.action === 'ignore') {
      ignoredCount++;
      continue;
    }
    if (choice?.action === 'map') {
      const offer = byId.get(choice.offerId);
      if (offer) {
        matched.push({ booking, offerId: offer.id });
        continue;
      }
    }
    pendingLabelSet.add(booking.theme);
  }

  return {
    matched,
    pendingLabels: Array.from(pendingLabelSet).sort((a, b) => a.localeCompare(b)),
    ignoredCount,
  };
}

// ---------------------------------------------------------------------------
// Import plan
// ---------------------------------------------------------------------------

export interface SecutixImportPlan {
  /** New slots to add (bookings with no existing slot) */
  create: Slot[];
  /** Updated slots (booking changed: headcount, time, contact…). Mediator
   *  assignments, setup/teardown and status are preserved. */
  update: Slot[];
  /** Slots whose booking left the file: mediators removed, status cancelled */
  deallocate: Slot[];
  /** Min/max booking dates covered by the file (null when no bookings) */
  coveredRange: { start: string; end: string } | null;
}

/** Booking fields owned by the Secutix file — anything else is local work. */
function bookingDiffersFromSlot(booking: SecutixBooking, slot: Slot): boolean {
  return (
    booking.date !== slot.date ||
    booking.startTime !== slot.startTime ||
    booking.endTime !== slot.endTime ||
    booking.participantCount !== slot.participantCount ||
    booking.groupName !== slot.groupName ||
    booking.guide !== slot.guide ||
    booking.location !== slot.location ||
    booking.groupNature !== slot.groupNature ||
    booking.contactName !== slot.contactName ||
    booking.contactPhone !== slot.contactPhone ||
    booking.contactEmail !== slot.contactEmail ||
    booking.notes !== slot.notes ||
    booking.contractNumber !== (slot.contractNumber || '')
  );
}

function bookingToSlot(booking: SecutixBooking, offerId: string, now: Date): Slot {
  return createSlot({
    offerId,
    date: booking.date,
    startTime: booking.startTime,
    endTime: booking.endTime,
    participantCount: booking.participantCount,
    groupName: booking.groupName,
    guide: booking.guide,
    location: booking.location,
    groupNature: booking.groupNature,
    contactName: booking.contactName,
    contactPhone: booking.contactPhone,
    contactEmail: booking.contactEmail,
    notes: booking.notes,
    contractNumber: booking.contractNumber || undefined,
    origin: 'imported',
    importSource: SECUTIX_SOURCE,
    importedAt: now.toISOString(),
    createdAt: now.toISOString(),
  });
}

/**
 * Build the full synchronization plan from reconciled bookings:
 * - create a slot per booking that has no matching imported slot
 * - update imported slots whose booking changed (preserving mediators,
 *   setup/teardown, status; modifiedAfterImport resets — values are re-synced)
 * - deallocate Secutix-imported slots INSIDE the covered date range whose
 *   booking left the file. Manual slots, other import sources, slots outside
 *   the range and slots of offers without a secutixLabel are never touched.
 */
export function buildSecutixImportPlan(
  matched: OfferMatch[],
  offers: Offer[],
  existingSlots: Slot[],
  now: Date = new Date()
): SecutixImportPlan {
  const offerLabelById = new Map<string, string>();
  for (const offer of offers) {
    if (offer.secutixLabel) {
      offerLabelById.set(offer.id, normalizeLabel(offer.secutixLabel));
    }
  }

  const coveredRange = matched.length
    ? matched.reduce(
        (acc, m) => ({
          start: !acc.start || m.booking.date < acc.start ? m.booking.date : acc.start,
          end: !acc.end || m.booking.date > acc.end ? m.booking.date : acc.end,
        }),
        { start: '' as string, end: '' as string }
      )
    : null;

  // Key the existing Secutix slots by the composite key (label side)
  const slotByKey = new Map<string, Slot>();
  for (const slot of existingSlots) {
    if (slot.origin !== 'imported' || slot.importSource !== SECUTIX_SOURCE) continue;
    const label = slot.offerId ? offerLabelById.get(slot.offerId) : undefined;
    if (!label) continue; // offer without a label: not Secutix-managed, never touched
    slotByKey.set(
      getSecutixBookingKey({
        contractNumber: slot.contractNumber || '',
        theme: label,
        date: slot.date,
        startTime: slot.startTime,
        groupName: slot.groupName,
      }),
      slot
    );
  }

  const create: Slot[] = [];
  const update: Slot[] = [];
  const fileKeys = new Set<string>();
  const matchedSlotIds = new Set<string>();

  for (const { booking, offerId } of matched) {
    const key = getSecutixBookingKey(booking);
    fileKeys.add(key);
    const existing = slotByKey.get(key);
    if (!existing) {
      create.push(bookingToSlot(booking, offerId, now));
      continue;
    }
    matchedSlotIds.add(existing.id);
    if (bookingDiffersFromSlot(booking, existing)) {
      update.push({
        ...existing,
        date: booking.date,
        startTime: booking.startTime,
        endTime: booking.endTime,
        participantCount: booking.participantCount,
        groupName: booking.groupName,
        guide: booking.guide,
        location: booking.location,
        groupNature: booking.groupNature,
        contactName: booking.contactName,
        contactPhone: booking.contactPhone,
        contactEmail: booking.contactEmail,
        notes: booking.notes,
        contractNumber: booking.contractNumber || undefined,
        offerId, // keep in sync with the (re)mapped offer
        importedAt: now.toISOString(),
        modifiedAfterImport: false,
      });
    }
  }

  const deallocate: Slot[] = [];
  if (coveredRange) {
    for (const slot of existingSlots) {
      if (matchedSlotIds.has(slot.id)) continue;
      if (slot.origin !== 'imported' || slot.importSource !== SECUTIX_SOURCE) continue;
      if (slot.date < coveredRange.start || slot.date > coveredRange.end) continue;
      const label = slot.offerId ? offerLabelById.get(slot.offerId) : undefined;
      if (!label) continue;
      deallocate.push({ ...slot, mediatorIds: [], status: 'cancelled' });
    }
  }

  return { create, update, deallocate, coveredRange };
}

// ---------------------------------------------------------------------------
// Apply
// ---------------------------------------------------------------------------

/**
 * Merge the plan into the data in a single pass (offers first, then slot
 * replacements and additions), so one undo step reverts the whole import.
 * Pure: the input data is not mutated.
 */
export function applySecutixImport(
  data: AppData,
  plan: SecutixImportPlan,
  newOffers: Offer[]
): AppData {
  const replacedIds = new Set<string>([...plan.update, ...plan.deallocate].map((s) => s.id));
  return {
    ...data,
    offers: [...data.offers, ...newOffers],
    slots: [
      ...data.slots.filter((s) => !replacedIds.has(s.id)),
      ...plan.update,
      ...plan.deallocate,
      ...plan.create,
    ],
  };
}
