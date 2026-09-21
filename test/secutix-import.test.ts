// test/secutix-import.test.ts — Secutix import domain logic (pure, no SheetJS)
import { describe, it, expect } from 'vitest';
import {
  normalizeSecutixRows,
  reconcileOffers,
  buildSecutixImportPlan,
  applySecutixImport,
  suggestOfferFromLabel,
  resolveSecutixChoices,
  type SecutixRow,
} from '../src/domain/secutix-import';
import { createOffer, createSlot } from '../src/domain/models';
import type { AppData, Slot } from '../src/domain/types';

// Invented data — plausible Secutix export shape, no real bookings
function row(overrides: Partial<SecutixRow> = {}): SecutixRow {
  return {
    productDateTime: '22.09.2026 09:45',
    product: 'MHN GRP - Visite Guidée Découverte',
    groupName: 'ECOLE LES TOURNESOLS - CE1',
    guide: '',
    theme: 'G/ Visite découverte',
    contractNumber: '3100001',
    duration: '1:30',
    site: 'DCSTI_MHN',
    location: 'RZA_MHN_EXPOSITION PERMANENTE',
    visitLanguage: '',
    operationType: 'Vente',
    groupNature: 'SCOLAIRES C2',
    participantCount: '28',
    contactName: '(50100421) MERLANDE, Céleste',
    contactPhone: '06 71 24 85 19',
    contactEmail: 'celeste.merlande@exemple.fr',
    remark: 'Prévoir des chaises',
    visitState: 'En exploitation',
    plannedArrivalTime: '09:45',
    ...overrides,
  };
}

const NOW = new Date('2026-09-20T08:00:00.000Z');

describe('normalizeSecutixRows', () => {
  it('parses the product datetime into ISO date + start time, and computes the end time from the duration', () => {
    const result = normalizeSecutixRows([row()]);
    expect(result.bookings.length).toBe(1);
    const b = result.bookings[0];
    expect(b.date).toBe('2026-09-22');
    expect(b.startTime).toBe('09:45');
    expect(b.endTime).toBe('11:15');
  });

  it('maps the booking-detail fields and the remark into notes', () => {
    const b = normalizeSecutixRows([row()]).bookings[0];
    expect(b.theme).toBe('G/ Visite découverte');
    expect(b.contractNumber).toBe('3100001');
    expect(b.groupName).toBe('ECOLE LES TOURNESOLS - CE1');
    expect(b.location).toBe('RZA_MHN_EXPOSITION PERMANENTE');
    expect(b.groupNature).toBe('SCOLAIRES C2');
    expect(b.participantCount).toBe(28);
    expect(b.contactName).toBe('(50100421) MERLANDE, Céleste');
    expect(b.contactPhone).toBe('06 71 24 85 19');
    expect(b.contactEmail).toBe('celeste.merlande@exemple.fr');
    expect(b.notes).toBe('Prévoir des chaises');
  });

  it('clamps the end time at 23:59 when start + duration crosses midnight', () => {
    const result = normalizeSecutixRows([row({ productDateTime: '22.09.2026 10:00', duration: '15:00' })]);
    expect(result.bookings[0].endTime).toBe('23:59');
  });

  it('defaults the participant count to 0 when missing', () => {
    const result = normalizeSecutixRows([row({ participantCount: '' })]);
    expect(result.bookings[0].participantCount).toBe(0);
  });

  it('skips "G/ Droit d\'accès" rows (entry fees) and counts them', () => {
    const result = normalizeSecutixRows([
      row(),
      row({ theme: "G/ Droit d'accès", product: "MHN GRP - Droit d'Entrée EXPO PERM FORFAIT" }),
    ]);
    expect(result.bookings.length).toBe(1);
    expect(result.accessRightRows).toBe(1);
  });

  it('skips the trailing Total row and rows without a parsable datetime', () => {
    const result = normalizeSecutixRows([
      row(),
      row({ productDateTime: ' Total', groupName: '', contractNumber: '' }),
      row({ productDateTime: '' }),
    ]);
    expect(result.bookings.length).toBe(1);
    expect(result.skippedRows).toBe(2);
  });

  it('deduplicates rows sharing the composite key (contract + theme + date + time + group)', () => {
    const result = normalizeSecutixRows([
      row(),
      row(), // exact duplicate
      row({ groupName: 'ECOLE LES TOURNESOLS - CE2' }), // same contract, other group
    ]);
    expect(result.bookings.length).toBe(2);
    expect(result.duplicateRowCount).toBe(1);
  });
});

describe('reconcileOffers', () => {
  const offers = [
    createOffer({ id: 'off_1', name: 'Visite découverte', secutixLabel: 'G/ Visite découverte' }),
    createOffer({ id: 'off_2', name: 'Labo du goût', secutixLabel: 'G/  Atelier  Labo du goût' }),
  ];

  it('matches bookings to offers via secutixLabel, tolerating whitespace differences', () => {
    const bookings = normalizeSecutixRows([
      row(),
      row({ theme: 'G/ Atelier Labo du goût', productDateTime: '23.09.2026 14:00', duration: '2:00' }),
    ]).bookings;
    const rec = reconcileOffers(bookings, offers);
    expect(rec.matched.length).toBe(2);
    expect(rec.matched[0].offerId).toBe('off_1');
    expect(rec.matched[1].offerId).toBe('off_2');
    expect(rec.unmatchedLabels).toEqual([]);
  });

  it('reports the distinct unmatched labels and their bookings', () => {
    const bookings = normalizeSecutixRows([
      row({ theme: 'G/ Nouveau thème', productDateTime: '23.09.2026 14:00' }),
      row({ theme: 'G/ Nouveau thème', productDateTime: '24.09.2026 14:00' }),
      row({ theme: 'G/ Autre inconnu', productDateTime: '25.09.2026 14:00' }),
    ]).bookings;
    const rec = reconcileOffers(bookings, offers);
    expect(rec.unmatchedLabels).toEqual(['G/ Autre inconnu', 'G/ Nouveau thème']);
    expect(rec.unmatchedBookings.length).toBe(3);
    expect(rec.matched.length).toBe(0);
  });
});

describe('resolveSecutixChoices', () => {
  const offers = [
    createOffer({ id: 'off_1', name: 'Visite découverte', secutixLabel: 'G/ Visite découverte' }),
    createOffer({ id: 'off_2', name: 'Atelier anniversaire' }),
  ];

  const bookings = () =>
    normalizeSecutixRows([
      row(),                                                            // auto-matched
      row({ theme: 'G/ Nouveau thème', productDateTime: '23.09.2026 14:00' }),
      row({ theme: 'G/ Nouveau thème', productDateTime: '24.09.2026 14:00' }),
      row({ theme: 'G/ Sans libellé', productDateTime: '25.09.2026 14:00' }),
      row({ theme: '', productDateTime: '26.09.2026 14:00' }),
    ]).bookings;

  it('auto-matches labels via secutixLabel and leaves the rest pending without choices', () => {
    const res = resolveSecutixChoices(bookings(), offers, [], {});
    expect(res.matched.length).toBe(1);
    expect(res.matched[0].offerId).toBe('off_1');
    expect(res.pendingLabels).toEqual(['', 'G/ Nouveau thème', 'G/ Sans libellé']);
    expect(res.ignoredCount).toBe(0);
  });

  it('re-links an unmatched label to a chosen existing offer (manual mapping)', () => {
    const res = resolveSecutixChoices(bookings(), offers, [], {
      'G/ Nouveau thème': { action: 'map', offerId: 'off_2' },
    });
    expect(res.matched.filter((m) => m.offerId === 'off_2').length).toBe(2);
    expect(res.pendingLabels).toEqual(['', 'G/ Sans libellé']);
  });

  it('matches bookings to the created offer of their label (create choice)', () => {
    const created = [createOffer({ id: 'off_new', name: 'Nouveau thème', secutixLabel: 'G/ Nouveau thème' })];
    const res = resolveSecutixChoices(bookings(), offers, created, {});
    expect(res.matched.filter((m) => m.offerId === 'off_new').length).toBe(2);
    expect(res.pendingLabels).toEqual(['', 'G/ Sans libellé']);
  });

  it('excludes ignored bookings from the import and counts them', () => {
    const res = resolveSecutixChoices(bookings(), offers, [], {
      '': { action: 'ignore' },
      'G/ Sans libellé': { action: 'ignore' },
    });
    expect(res.ignoredCount).toBe(2);
    expect(res.matched.length).toBe(1);
    expect(res.pendingLabels).toEqual(['G/ Nouveau thème']);
  });

  it('treats a mapping to an unknown offer id as still pending', () => {
    const res = resolveSecutixChoices(bookings(), offers, [], {
      'G/ Nouveau thème': { action: 'map', offerId: 'off_inconnu' },
    });
    expect(res.pendingLabels).toContain('G/ Nouveau thème');
    expect(res.matched.filter((m) => m.booking.theme === 'G/ Nouveau thème').length).toBe(0);
  });
});

describe('suggestOfferFromLabel', () => {
  it('suggests an offer with the label, the most common espace and duration', () => {
    const bookings = normalizeSecutixRows([
      row({ location: 'RZA_MHN_EXPOSITION PERMANENTE', duration: '1:30' }),
      row({ location: 'RZA_MHN_EXPOSITION PERMANENTE', duration: '1:30' }),
      row({ location: 'SALLE ATELIER', duration: '2:00' }),
    ]).bookings;
    const offer = suggestOfferFromLabel('G/ Visite découverte', bookings);
    expect(offer.secutixLabel).toBe('G/ Visite découverte');
    expect(offer.name).toBe('G/ Visite découverte');
    expect(offer.location).toBe('RZA_MHN_EXPOSITION PERMANENTE');
    expect(offer.duration).toBe(90);
  });
});

function importedSlot(overrides: Partial<Slot> = {}): Slot {
  return createSlot({
    id: 'slot_1',
    offerId: 'off_1',
    date: '2026-09-22',
    startTime: '09:45',
    endTime: '11:15',
    participantCount: 28,
    groupName: 'ECOLE LES TOURNESOLS - CE1',
    guide: '',
    location: 'RZA_MHN_EXPOSITION PERMANENTE',
    groupNature: 'SCOLAIRES C2',
    contactName: '(50100421) MERLANDE, Céleste',
    contactPhone: '06 71 24 85 19',
    contactEmail: 'celeste.merlande@exemple.fr',
    notes: 'Prévoir des chaises',
    contractNumber: '3100001',
    origin: 'imported',
    importSource: 'Secutix',
    importedAt: '2026-09-01T10:00:00.000Z',
    modifiedAfterImport: false,
    status: 'confirmed',
    mediatorIds: ['med_1'],
    setupTime: 10,
    teardownTime: 5,
    createdAt: '2026-09-01T10:00:00.000Z',
    ...overrides,
  });
}

describe('buildSecutixImportPlan', () => {
  const offer = createOffer({ id: 'off_1', name: 'Visite découverte', secutixLabel: 'G/ Visite découverte' });

  it('creates slots for new bookings with all Secutix fields and import metadata', () => {
    const bookings = normalizeSecutixRows([row()]).bookings;
    const matched = reconcileOffers(bookings, [offer]).matched;
    const plan = buildSecutixImportPlan(matched, [offer], [], NOW);
    expect(plan.create.length).toBe(1);
    const s = plan.create[0];
    expect(s.date).toBe('2026-09-22');
    expect(s.startTime).toBe('09:45');
    expect(s.endTime).toBe('11:15');
    expect(s.offerId).toBe('off_1');
    expect(s.origin).toBe('imported');
    expect(s.importSource).toBe('Secutix');
    expect(s.importedAt).toBe(NOW.toISOString());
    expect(s.createdAt).toBe(NOW.toISOString());
    expect(s.contractNumber).toBe('3100001');
    expect(s.groupName).toBe('ECOLE LES TOURNESOLS - CE1');
    expect(s.participantCount).toBe(28);
    expect(s.mediatorIds).toEqual([]);
    expect(plan.update).toEqual([]);
    expect(plan.deallocate).toEqual([]);
    expect(plan.coveredRange).toEqual({ start: '2026-09-22', end: '2026-09-22' });
  });

  it('updates an existing imported slot when the booking changed, preserving mediators, logistics and status', () => {
    const existing = importedSlot();
    const bookings = normalizeSecutixRows([row({ participantCount: '30', duration: '2:00' })]).bookings;
    const matched = reconcileOffers(bookings, [offer]).matched;
    const plan = buildSecutixImportPlan(matched, [offer], [existing], NOW);
    expect(plan.create.length).toBe(0);
    expect(plan.update.length).toBe(1);
    const u = plan.update[0];
    expect(u.id).toBe('slot_1');
    expect(u.participantCount).toBe(30);
    expect(u.endTime).toBe('11:45');
    expect(u.mediatorIds).toEqual(['med_1']);
    expect(u.setupTime).toBe(10);
    expect(u.teardownTime).toBe(5);
    expect(u.status).toBe('confirmed');
    expect(u.importedAt).toBe(NOW.toISOString());
    // re-synced with the file: no longer diverges from the import
    expect(u.modifiedAfterImport).toBe(false);
  });

  it('does not update unchanged slots', () => {
    const existing = importedSlot({ participantCount: 28 });
    const bookings = normalizeSecutixRows([row()]).bookings;
    const matched = reconcileOffers(bookings, [offer]).matched;
    const plan = buildSecutixImportPlan(matched, [offer], [existing], NOW);
    expect(plan.update.length).toBe(0);
  });

  it('deallocates imported Secutix slots inside the covered range that left the file', () => {
    const existing = importedSlot({ id: 'slot_gone', date: '2026-09-23', startTime: '14:00' });
    // A booking on 09-23 extends the covered range over the disappeared slot
    const bookings = normalizeSecutixRows([
      row(),
      row({ groupName: 'COLLEGE DES CYPRES - 6E', productDateTime: '23.09.2026 09:45' }),
    ]).bookings;
    const matched = reconcileOffers(bookings, [offer]).matched;
    const plan = buildSecutixImportPlan(matched, [offer], [existing], NOW);
    expect(plan.deallocate.length).toBe(1);
    const d = plan.deallocate[0];
    expect(d.id).toBe('slot_gone');
    expect(d.mediatorIds).toEqual([]);
    expect(d.status).toBe('cancelled');
    expect(plan.coveredRange).toEqual({ start: '2026-09-22', end: '2026-09-23' });
  });

  it('never touches manual slots, other import sources, slots outside the covered range, or offers without a secutixLabel', () => {
    const manual = importedSlot({ id: 'slot_manual', origin: 'manual', importSource: '' });
    const otherSource = importedSlot({ id: 'slot_coord', importSource: 'Coordination' });
    const outside = importedSlot({ id: 'slot_out', date: '2026-10-23' });
    const noLabelOffer = createOffer({ id: 'off_nl', name: 'Sans libellé' });
    const orphan = importedSlot({ id: 'slot_nl', offerId: 'off_nl' });
    const bookings = normalizeSecutixRows([row()]).bookings;
    const matched = reconcileOffers(bookings, [offer]).matched;
    const plan = buildSecutixImportPlan(matched, [offer, noLabelOffer], [manual, otherSource, outside, orphan], NOW);
    expect(plan.deallocate).toEqual([]);
    expect(plan.update).toEqual([]);
  });

  it('returns a null covered range for an empty booking set (no deallocation either)', () => {
    const existing = importedSlot();
    const plan = buildSecutixImportPlan([], [offer], [existing], NOW);
    expect(plan.coveredRange).toBeNull();
    expect(plan.deallocate).toEqual([]);
    expect(plan.create).toEqual([]);
  });
});

describe('applySecutixImport', () => {
  const offer = createOffer({ id: 'off_1', name: 'Visite découverte', secutixLabel: 'G/ Visite découverte' });
  const newOffer = createOffer({ id: 'off_new', name: 'Nouveau thème', secutixLabel: 'G/ Nouveau thème' });

  it('merges created offers, created/updated/deallocated slots into the data in one pass', () => {
    const existing = importedSlot();
    const data: AppData = {
      mediators: [],
      offers: [offer],
      schedules: [],
      slots: [existing],
      absences: [],
    };
    const bookings = normalizeSecutixRows([
      row({ participantCount: '30' }),               // same key as existing, changed headcount
      row({ theme: 'G/ Nouveau thème', productDateTime: '23.09.2026 14:00' }), // new booking
    ]).bookings;
    const allOffers = [offer, newOffer];
    const matched = reconcileOffers(bookings, allOffers).matched;
    const plan = buildSecutixImportPlan(matched, allOffers, [existing], NOW);
    const next = applySecutixImport(data, plan, [newOffer]);

    expect(next.offers.length).toBe(2);
    expect(next.offers.some((o) => o.id === 'off_new')).toBe(true);
    // unchanged slot kept, updated slot replaced, created slot appended
    const updated = next.slots.find((s) => s.id === 'slot_1');
    expect(updated?.participantCount).toBe(30);
    const created = next.slots.find((s) => s.id !== 'slot_1');
    expect(created?.offerId).toBe('off_new');
    expect(next.slots.length).toBe(2);
  });

  it('is a pure function — the input data is not mutated', () => {
    const existing = importedSlot();
    const data: AppData = { mediators: [], offers: [offer], schedules: [], slots: [existing], absences: [] };
    const bookings = normalizeSecutixRows([row({ participantCount: '30' })]).bookings;
    const matched = reconcileOffers(bookings, [offer]).matched;
    const plan = buildSecutixImportPlan(matched, [offer], [existing], NOW);
    applySecutixImport(data, plan, []);
    expect(data.slots[0].participantCount).toBe(28);
    expect(data.offers.length).toBe(1);
  });
});
