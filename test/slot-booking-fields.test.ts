// test/slot-booking-fields.test.ts — Booking-detail fields on slots (Secutix)
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createSlot,
  createOffer,
  getSlotLocation,
  formatSlotBookingSummary,
} from '../src/domain/models';

class LocalStorageMock {
  data: Record<string, string> = {};
  getItem(key: string): string | null { return this.data[key] || null; }
  setItem(key: string, value: string): void { this.data[key] = String(value); }
  removeItem(key: string): void { delete this.data[key]; }
  clear(): void { this.data = {}; }
}
vi.stubGlobal('localStorage', new LocalStorageMock());

describe('slot booking-detail fields', () => {
  it('defaults the booking-detail fields to empty strings', () => {
    const slot = createSlot();
    expect(slot.groupName).toBe('');
    expect(slot.guide).toBe('');
    expect(slot.location).toBe('');
    expect(slot.groupNature).toBe('');
    expect(slot.contactName).toBe('');
    expect(slot.contactPhone).toBe('');
    expect(slot.contactEmail).toBe('');
  });

  it('stores the booking-detail fields provided at creation', () => {
    const slot = createSlot({
      groupName: 'ECOLE ELEMENTAIRE LES TOURNESOLS - CE1',
      guide: 'M. Dupont',
      contractNumber: '3126845',
      location: 'RZA_MHN_EXPOSITION PERMANENTE',
      groupNature: 'SCOLAIRES C2',
      contactName: '(50100421) MERLANDE, Céleste',
      contactPhone: '06 71 24 85 19',
      contactEmail: 'celeste.merlande@exemple.fr',
      notes: 'Contrat signé le 10/09/26',
    });
    expect(slot.groupName).toBe('ECOLE ELEMENTAIRE LES TOURNESOLS - CE1');
    expect(slot.guide).toBe('M. Dupont');
    expect(slot.contractNumber).toBe('3126845');
    expect(slot.location).toBe('RZA_MHN_EXPOSITION PERMANENTE');
    expect(slot.groupNature).toBe('SCOLAIRES C2');
    expect(slot.contactName).toBe('(50100421) MERLANDE, Céleste');
    expect(slot.contactPhone).toBe('06 71 24 85 19');
    expect(slot.contactEmail).toBe('celeste.merlande@exemple.fr');
    expect(slot.notes).toBe('Contrat signé le 10/09/26');
  });
});

describe('slot createdAt', () => {
  it('is stamped with the creation time', () => {
    const slot = createSlot({});
    expect(slot.createdAt).toBeTruthy();
    expect(new Date(slot.createdAt!).toISOString()).toBe(slot.createdAt);
  });

  it('keeps the provided createdAt', () => {
    const slot = createSlot({ createdAt: '2026-09-14T19:30:00.000Z' });
    expect(slot.createdAt).toBe('2026-09-14T19:30:00.000Z');
  });
});

describe('offer secutixLabel', () => {
  it('is absent when not provided (manual offer)', () => {
    const offer = createOffer({ name: 'Visite découverte' });
    expect('secutixLabel' in offer).toBe(false);
  });

  it('is stored when provided', () => {
    const offer = createOffer({
      name: "L'Arbre à Clés",
      secutixLabel: "G/ CM1 à 6e/ L'Arbre à Clés",
    });
    expect(offer.secutixLabel).toBe("G/ CM1 à 6e/ L'Arbre à Clés");
  });
});

describe('formatSlotBookingSummary', () => {
  const offer = createOffer({
    name: 'Découvrons le Muséum',
    secutixLabel: 'G/ CP à CE2/ Découvrons le Muséum',
    location: 'RZA_MHN_EXPOSITION PERMANENTE',
  });

  it('formats an imported booking in the Secutix style', () => {
    const slot = createSlot({
      site: 'CSTI_MHN',
      location: 'RZA_MHN_EXPOSITION PERMANENTE',
      startTime: '10:45',
      endTime: '11:45',
      participantCount: 30,
      groupNature: 'SCOLAIRES C2',
      contractNumber: '2456008',
      groupName: 'ECOLE PRIMAIRE DE TERRE CLAPIER GROUPE 1',
      notes: 'RJV OU BDC CP + QUELQUES GS. Contrat signé + BDC reçus le 07/08/2026',
      origin: 'imported',
      importSource: 'Secutix',
      importedAt: '2026-09-07T10:00:00.000Z',
      createdAt: '2026-09-07T10:00:00.000Z',
    });
    expect(formatSlotBookingSummary(slot, offer)).toBe(
      'CSTI_MHN ___ RZA_MHN_EXPOSITION PERMANENTE ___ 10h45 - 11h45\n' +
      '___ (30 pers. SCOLAIRES C2)\n' +
      'Client : 2456008     ECOLE PRIMAIRE DE TERRE CLAPIER GROUPE 1     G/ CP à CE2/ Découvrons le Muséum (importé le 07/09/2026)\n' +
      'Commentaires : RJV OU BDC CP + QUELQUES GS. Contrat signé + BDC reçus le 07/08/2026'
    );
  });

  it('shows "créé le" for manual slots and uses the offer name without a secutix label', () => {
    const manualOffer = createOffer({ name: 'Visite libre' });
    const slot = createSlot({
      location: 'JARDIN',
      startTime: '14:00',
      endTime: '15:00',
      groupName: 'GROUPE INCONNU',
      origin: 'manual',
      createdAt: '2026-09-21T08:00:00.000Z',
    });
    expect(formatSlotBookingSummary(slot, manualOffer)).toBe(
      'JARDIN ___ 14h00 - 15h00\n' +
      'Client : GROUPE INCONNU     Visite libre (créé le 21/09/2026)'
    );
  });

  it('falls back to the offer location when the slot has none', () => {
    const slot = createSlot({ startTime: '09:00', endTime: '10:00' });
    expect(formatSlotBookingSummary(slot, offer)).toContain('RZA_MHN_EXPOSITION PERMANENTE ___ 09h00 - 10h00');
  });

  it('skips the headcount line when there is no participant count and no group nature', () => {
    const slot = createSlot({ startTime: '09:00', endTime: '10:00' });
    const summary = formatSlotBookingSummary(slot, offer);
    expect(summary).not.toContain('pers.');
    expect(summary).not.toContain('Commentaires :');
  });
});

describe('getSlotLocation', () => {
  const offer = createOffer({ name: 'Visite', location: 'Exposition permanente' });

  it('returns the slot location when set (overrides the offer default)', () => {
    const slot = createSlot({ location: 'Labo' });
    expect(getSlotLocation(slot, offer)).toBe('Labo');
  });

  it('falls back to the offer location when the slot has none', () => {
    const slot = createSlot({});
    expect(getSlotLocation(slot, offer)).toBe('Exposition permanente');
  });

  it('returns an empty string when neither slot nor offer has one', () => {
    const slot = createSlot({});
    expect(getSlotLocation(slot, undefined)).toBe('');
  });
});

describe('store migration of legacy slots', () => {
  beforeEach(() => localStorage.clear());

  it('fills the booking-detail fields on legacy persisted slots', async () => {
    const legacy = {
      mediators: [],
      offers: [],
      schedules: [],
      absences: [],
      slots: [{ id: 'slot_1', offerId: 'off_1', date: '2026-09-22', startTime: '09:45', endTime: '10:45' }],
    };
    localStorage.setItem('mediaplan_data_v1', JSON.stringify(legacy));
    const { load } = await import('../src/infrastructure/store');
    const data = load();
    expect(data.slots[0].groupName).toBe('');
    expect(data.slots[0].guide).toBe('');
    expect(data.slots[0].location).toBe('');
    expect(data.slots[0].groupNature).toBe('');
    expect(data.slots[0].contactName).toBe('');
    expect(data.slots[0].contactPhone).toBe('');
    expect(data.slots[0].contactEmail).toBe('');
    // existing values are preserved
    expect(data.slots[0].startTime).toBe('09:45');
  });
});
