// history-diff.ts — Derived change summary between two history snapshots
//
// Pure functions: compare two AppData states by entity id and produce a
// compact French summary for the history panel. Nothing here is persisted —
// the diff is derived at DISPLAY time from adjacent snapshots (per the
// stakeholder-validated design).

import type { AppData, Slot } from './types';

export interface EntityDiffCounts {
  added: number;
  removed: number;
  changed: number;
}

export interface SlotDetail {
  slotId: string;
  offerName: string | null;
  date: string;
}

export interface ChangedSlotDetail extends SlotDetail {
  // Machine-readable change kinds, e.g. ['mediators', 'time']
  changes: string[];
}

export interface AppDataDiff {
  slots: EntityDiffCounts;
  mediators: EntityDiffCounts;
  offers: EntityDiffCounts;
  absences: EntityDiffCounts;
  // Detail for REMOVED slots (cap 3) — offer name + date
  removedSlotDetails: SlotDetail[];
  // Detail for CHANGED slots (cap 3) — offer name + date + what changed
  changedSlotDetails: ChangedSlotDetail[];
}

// Max number of changed/removed slots described one-by-one in the summary
const MAX_SLOT_DETAILS = 3;

interface WithId {
  id: string;
}

// Compare two id-keyed collections: counts of added/removed/changed entities.
// A changed entity is any field difference (JSON deep equality). O(n) via
// id maps.
function diffCollections<T extends WithId>(
  prev: T[],
  next: T[]
): {
  added: number;
  removed: number;
  changed: number;
  removedItems: T[];
  changedPairs: Array<{ prev: T; next: T }>;
} {
  const prevById = new Map(prev.map((item) => [item.id, item]));
  const nextById = new Map(next.map((item) => [item.id, item]));
  let added = 0;
  let removed = 0;
  let changed = 0;
  const removedItems: T[] = [];
  const changedPairs: Array<{ prev: T; next: T }> = [];

  for (const item of next) {
    if (!prevById.has(item.id)) added++;
  }
  for (const item of prev) {
    const counterpart = nextById.get(item.id);
    if (!counterpart) {
      removed++;
      removedItems.push(item);
    } else if (JSON.stringify(item) !== JSON.stringify(counterpart)) {
      changed++;
      changedPairs.push({ prev: item, next: counterpart });
    }
  }
  return { added, removed, changed, removedItems, changedPairs };
}

// Classify what changed on a slot into summary keywords
function slotChangeKinds(prev: Slot, next: Slot): string[] {
  const kinds: string[] = [];
  if (
    JSON.stringify([...prev.mediatorIds].sort()) !==
    JSON.stringify([...next.mediatorIds].sort())
  ) {
    kinds.push('mediators');
  }
  if (prev.startTime !== next.startTime || prev.endTime !== next.endTime || prev.date !== next.date) {
    kinds.push('time');
  }
  if (prev.status !== next.status) {
    kinds.push('status');
  }
  // Any other field difference (notes, participants, logistics...)
  if (kinds.length === 0) kinds.push('details');
  return kinds;
}

const CHANGE_KIND_LABELS: Record<string, string> = {
  mediators: 'médiateurs',
  time: 'horaires',
  status: 'statut',
  details: 'détails',
};

// Pure diff of two AppData snapshots. O(n) per entity kind via id maps.
export function diffAppData(prev: AppData, next: AppData): AppDataDiff {
  const slots = diffCollections(prev.slots, next.slots);
  const mediators = diffCollections(prev.mediators, next.mediators);
  const offers = diffCollections(prev.offers, next.offers);
  const absences = diffCollections(prev.absences, next.absences);

  // Offer name resolution: from next first, then prev (an offer renamed or
  // created in the same step still yields a readable name)
  const offerNameById = new Map<string, string>();
  for (const o of [...next.offers, ...prev.offers]) {
    if (!offerNameById.has(o.id)) offerNameById.set(o.id, o.name);
  }

  const removedSlotDetails: SlotDetail[] = slots.removedItems
    .slice(0, MAX_SLOT_DETAILS)
    .map((s) => ({
      slotId: s.id,
      offerName: offerNameById.get(s.offerId) ?? null,
      date: s.date,
    }));

  const changedSlotDetails: ChangedSlotDetail[] = slots.changedPairs
    .slice(0, MAX_SLOT_DETAILS)
    .map(({ prev: p, next: n }) => ({
      slotId: n.id,
      offerName: offerNameById.get(n.offerId) ?? offerNameById.get(p.offerId) ?? null,
      date: n.date,
      changes: slotChangeKinds(p, n),
    }));

  return {
    slots: { added: slots.added, removed: slots.removed, changed: slots.changed },
    mediators: { added: mediators.added, removed: mediators.removed, changed: mediators.changed },
    offers: { added: offers.added, removed: offers.removed, changed: offers.changed },
    absences: { added: absences.added, removed: absences.removed, changed: absences.changed },
    removedSlotDetails,
    changedSlotDetails,
  };
}

// ---- Rendering helpers ----

function plural(n: number, singular: string, pluralWord: string): string {
  return `${n} ${n > 1 ? pluralWord : singular}`;
}

// DD/MM/YYYY from an ISO date (data dates are local, never UTC-converted)
function formatFrDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function slotOfferLabel(offerName: string | null, date: string): string {
  return `${offerName ?? 'créneau inconnu'} — ${formatFrDate(date)}`;
}

function kindLabel(kinds: string[]): string {
  return kinds.map((k) => CHANGE_KIND_LABELS[k] ?? k).join(', ');
}

// Render a diff as French summary lines, e.g.:
//   '3 créneaux ajoutés'
//   '1 créneau supprimé (Visite guidée — 12/10/2026)'
//   '1 créneau modifié (Atelier nature — 13/10/2026 : médiateurs)'
// Up to 3 changed slots get one detail line each (numbered when >1); above
// that, counts only. An empty diff renders no lines.
export function summarizeDiff(diff: AppDataDiff): string[] {
  const lines: string[] = [];

  // Slots
  const s = diff.slots;
  if (s.added > 0) lines.push(plural(s.added, 'créneau ajouté', 'créneaux ajoutés'));

  if (s.removed === 1 && diff.removedSlotDetails.length === 1) {
    const d = diff.removedSlotDetails[0];
    lines.push(`1 créneau supprimé (${slotOfferLabel(d.offerName, d.date)})`);
  } else if (s.removed > 0) {
    lines.push(plural(s.removed, 'créneau supprimé', 'créneaux supprimés'));
  }

  if (s.changed === 1 && diff.changedSlotDetails.length === 1) {
    const d = diff.changedSlotDetails[0];
    lines.push(`1 créneau modifié (${slotOfferLabel(d.offerName, d.date)} : ${kindLabel(d.changes)})`);
  } else if (s.changed > 0) {
    lines.push(plural(s.changed, 'créneau modifié', 'créneaux modifiés'));
    if (s.changed <= MAX_SLOT_DETAILS) {
      diff.changedSlotDetails.slice(0, s.changed).forEach((d, i) => {
        lines.push(`${i + 1}. ${slotOfferLabel(d.offerName, d.date)} : ${kindLabel(d.changes)}`);
      });
    }
  }

  // Mediators
  const m = diff.mediators;
  if (m.added > 0) lines.push(plural(m.added, 'médiateur ajouté', 'médiateurs ajoutés'));
  if (m.removed > 0) lines.push(plural(m.removed, 'médiateur supprimé', 'médiateurs supprimés'));
  if (m.changed > 0) lines.push(plural(m.changed, 'médiateur modifié', 'médiateurs modifiés'));

  // Offers
  const o = diff.offers;
  if (o.added > 0) lines.push(plural(o.added, 'offre ajoutée', 'offres ajoutées'));
  if (o.removed > 0) lines.push(plural(o.removed, 'offre supprimée', 'offres supprimées'));
  if (o.changed > 0) lines.push(plural(o.changed, 'offre modifiée', 'offres modifiées'));

  // Absences
  const a = diff.absences;
  if (a.added > 0) lines.push(plural(a.added, 'absence ajoutée', 'absences ajoutées'));
  if (a.removed > 0) lines.push(plural(a.removed, 'absence supprimée', 'absences supprimées'));
  if (a.changed > 0) lines.push(plural(a.changed, 'absence modifiée', 'absences modifiées'));

  return lines;
}
