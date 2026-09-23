// history-diff.test.ts — Tests for the derived diff summary between two
// history snapshots (pure domain function)
import { describe, it, expect } from 'vitest';
import { diffAppData, summarizeDiff } from '../src/domain/history-diff';
import type { AppData, Slot, Offer, Mediator, Absence } from '../src/domain/types';

// ---- Fixtures ----

function offer(id: string, name: string): Offer {
  return {
    id,
    name,
    description: '',
    duration: 60,
    capacity: 20,
    location: 'Salle 1',
    welcomeType: 'Réservable encadrée par médiateur',
  };
}

function slot(id: string, offerId: string, overrides: Partial<Slot> = {}): Slot {
  return {
    id,
    scheduleId: 'sched1',
    offerId,
    mediatorIds: [],
    date: '2026-10-12',
    startTime: '10:00',
    endTime: '11:00',
    participantCount: 15,
    status: 'planned',
    notes: '',
    origin: 'manual',
    importSource: '',
    importedAt: '',
    modifiedAfterImport: false,
    groupName: '',
    guide: '',
    location: '',
    groupNature: '',
    contactName: '',
    contactPhone: '',
    contactEmail: '',
    ...overrides,
  };
}

function mediator(id: string, lastName: string): Mediator {
  return {
    id,
    lastName,
    firstName: '',
    email: '',
    phone: '',
    competences: [],
    active: true,
    color: '#FF0000',
    notes: '',
  };
}

function absence(id: string, mediatorId: string, overrides: Partial<Absence> = {}): Absence {
  return {
    id,
    mediatorId,
    startDate: '2026-10-13',
    endDate: '2026-10-13',
    halfDay: 'none',
    type: 'leave',
    notes: '',
    ...overrides,
  };
}

function data(overrides: Partial<AppData> = {}): AppData {
  return {
    mediators: [],
    offers: [],
    schedules: [],
    slots: [],
    absences: [],
    ...overrides,
  };
}

describe('diffAppData', () => {
  it('returns zero counts for identical data', () => {
    const d = data({ slots: [slot('s1', 'o1')] });
    const diff = diffAppData(d, d);
    expect(diff.slots).toEqual({ added: 0, removed: 0, changed: 0 });
    expect(diff.mediators).toEqual({ added: 0, removed: 0, changed: 0 });
    expect(diff.offers).toEqual({ added: 0, removed: 0, changed: 0 });
    expect(diff.absences).toEqual({ added: 0, removed: 0, changed: 0 });
    expect(summarizeDiff(diff)).toEqual([]);
  });

  it('returns zero counts for empty data', () => {
    const diff = diffAppData(data(), data());
    expect(summarizeDiff(diff)).toEqual([]);
  });

  it('detects added, removed and changed slots', () => {
    const prev = data({
      offers: [offer('o1', 'Visite guidée')],
      slots: [slot('s1', 'o1'), slot('s2', 'o1'), slot('s3', 'o1', { status: 'confirmed' })],
    });
    const next = data({
      offers: [offer('o1', 'Visite guidée')],
      slots: [slot('s2', 'o1'), slot('s3', 'o1', { status: 'cancelled' }), slot('s4', 'o1')],
    });
    const diff = diffAppData(prev, next);
    expect(diff.slots.added).toBe(1); // s4
    expect(diff.slots.removed).toBe(1); // s1
    expect(diff.slots.changed).toBe(1); // s3 status
  });

  it('detects added, removed and changed mediators', () => {
    const prev = data({ mediators: [mediator('m1', 'A'), mediator('m2', 'B'), mediator('m3', 'C')] });
    const next = data({
      mediators: [mediator('m2', 'B'), mediator('m3', 'Renamed'), mediator('m4', 'D')],
    });
    const diff = diffAppData(prev, next);
    expect(diff.mediators).toEqual({ added: 1, removed: 1, changed: 1 });
  });

  it('detects added, removed and changed offers', () => {
    const prev = data({ offers: [offer('o1', 'A'), offer('o2', 'B'), offer('o3', 'C')] });
    const next = data({ offers: [offer('o2', 'B'), offer('o3', 'Renamed'), offer('o4', 'D')] });
    const diff = diffAppData(prev, next);
    expect(diff.offers).toEqual({ added: 1, removed: 1, changed: 1 });
  });

  it('detects added, removed and changed absences', () => {
    const prev = data({
      mediators: [mediator('m1', 'A')],
      absences: [absence('a1', 'm1'), absence('a2', 'm1'), absence('a3', 'm1')],
    });
    const next = data({
      mediators: [mediator('m1', 'A')],
      absences: [absence('a2', 'm1'), absence('a3', 'm1', { type: 'training' }), absence('a4', 'm1')],
    });
    const diff = diffAppData(prev, next);
    expect(diff.absences).toEqual({ added: 1, removed: 1, changed: 1 });
  });

  it('detects multiple entity kinds at once', () => {
    const prev = data({
      mediators: [mediator('m1', 'A')],
      offers: [offer('o1', 'Visite guidée')],
    });
    const next = data({
      mediators: [mediator('m1', 'A'), mediator('m2', 'B')],
      offers: [offer('o1', 'Visite guidée modifiée')],
      slots: [slot('s1', 'o1')],
    });
    const diff = diffAppData(prev, next);
    expect(diff.mediators.added).toBe(1);
    expect(diff.offers.changed).toBe(1);
    expect(diff.slots.added).toBe(1);
    const lines = summarizeDiff(diff);
    expect(lines).toContain('1 médiateur ajouté');
    expect(lines).toContain('1 offre modifiée');
    expect(lines).toContain('1 créneau ajouté');
  });
});

describe('summarizeDiff', () => {
  it('pluralizes slot lines (créneaux)', () => {
    const prev = data();
    const next = data({ slots: [slot('s1', 'o1'), slot('s2', 'o1'), slot('s3', 'o1')] });
    const lines = summarizeDiff(diffAppData(prev, next));
    expect(lines).toEqual(['3 créneaux ajoutés']);
  });

  it('singularizes slot lines (créneau)', () => {
    const prev = data();
    const next = data({ slots: [slot('s1', 'o1')] });
    const lines = summarizeDiff(diffAppData(prev, next));
    expect(lines).toEqual(['1 créneau ajouté']);
  });

  it('adds offer name + date detail for a removed slot', () => {
    const prev = data({
      offers: [offer('o1', 'Visite guidée')],
      slots: [slot('s1', 'o1', { date: '2026-10-12' })],
    });
    const next = data({ offers: [offer('o1', 'Visite guidée')] });
    const lines = summarizeDiff(diffAppData(prev, next));
    expect(lines).toEqual(['1 créneau supprimé (Visite guidée — 12/10/2026)']);
  });

  it('adds offer name + date detail for a changed slot (offer from prev or next)', () => {
    // Offer exists only in prev: resolution from prev
    const prev = data({
      offers: [offer('o1', 'Atelier nature')],
      slots: [slot('s1', 'o1', { date: '2026-10-13', mediatorIds: ['m1'] })],
    });
    const next = data({
      offers: [offer('o1', 'Atelier nature')],
      slots: [slot('s1', 'o1', { date: '2026-10-13', mediatorIds: [] })],
    });
    expect(summarizeDiff(diffAppData(prev, next))).toEqual([
      '1 créneau modifié (Atelier nature — 13/10/2026 : médiateurs)',
    ]);

    // Offer exists only in next (e.g. offer created in the same step):
    // resolution from next — the added offer is also part of the summary
    const prev2 = data({ slots: [slot('s1', 'oX', { date: '2026-10-13' })] });
    const next2 = data({
      offers: [offer('oX', 'Atelier nature')],
      slots: [slot('s1', 'oX', { date: '2026-10-13', status: 'confirmed' })],
    });
    expect(summarizeDiff(diffAppData(prev2, next2))).toEqual([
      '1 créneau modifié (Atelier nature — 13/10/2026 : statut)',
      '1 offre ajoutée',
    ]);
  });

  it('lists multiple changed fields for a slot detail', () => {
    const prev = data({
      offers: [offer('o1', 'Visite guidée')],
      slots: [slot('s1', 'o1', { mediatorIds: [], startTime: '10:00', status: 'planned' })],
    });
    const next = data({
      offers: [offer('o1', 'Visite guidée')],
      slots: [slot('s1', 'o1', { mediatorIds: ['m1'], startTime: '11:00', status: 'planned' })],
    });
    const lines = summarizeDiff(diffAppData(prev, next));
    expect(lines).toEqual([
      '1 créneau modifié (Visite guidée — 12/10/2026 : médiateurs, horaires)',
    ]);
  });

  it('falls back to a plain offer-less label when the offer is unknown', () => {
    const prev = data({ slots: [slot('s1', 'unknown', { date: '2026-10-12' })] });
    const next = data({ slots: [slot('s1', 'unknown', { date: '2026-10-12', status: 'confirmed' })] });
    const lines = summarizeDiff(diffAppData(prev, next));
    expect(lines).toEqual(['1 créneau modifié (créneau inconnu — 12/10/2026 : statut)']);
  });

  it('shows per-slot details for up to 3 changed slots', () => {
    const offers = [offer('o1', 'Visite guidée'), offer('o2', 'Atelier nature')];
    const prev = data({
      offers,
      slots: [
        slot('s1', 'o1', { date: '2026-10-12', status: 'planned' }),
        slot('s2', 'o2', { date: '2026-10-13', status: 'planned' }),
        slot('s3', 'o1', { date: '2026-10-14', status: 'planned' }),
      ],
    });
    const next = data({
      offers,
      slots: [
        slot('s1', 'o1', { date: '2026-10-12', status: 'confirmed' }),
        slot('s2', 'o2', { date: '2026-10-13', status: 'confirmed' }),
        slot('s3', 'o1', { date: '2026-10-14', status: 'confirmed' }),
      ],
    });
    const lines = summarizeDiff(diffAppData(prev, next));
    expect(lines).toEqual([
      '3 créneaux modifiés',
      '1. Visite guidée — 12/10/2026 : statut',
      '2. Atelier nature — 13/10/2026 : statut',
      '3. Visite guidée — 14/10/2026 : statut',
    ]);
  });

  it('shows counts only (no detail) above 3 changed slots', () => {
    const prev = data({ slots: ['s1', 's2', 's3', 's4'].map((id) => slot(id, 'o1', { status: 'planned' })) });
    const next = data({ slots: ['s1', 's2', 's3', 's4'].map((id) => slot(id, 'o1', { status: 'confirmed' })) });
    const lines = summarizeDiff(diffAppData(prev, next));
    expect(lines).toEqual(['4 créneaux modifiés']);
  });

  it('summarizes mediators, offers and absences with singular and plural', () => {
    const prev = data({
      mediators: [mediator('m1', 'A')],
      offers: [offer('o1', 'A'), offer('o2', 'B')],
      absences: [absence('a1', 'm1')],
    });
    const next = data({
      mediators: [mediator('m1', 'A'), mediator('m2', 'B'), mediator('m3', 'C')],
      offers: [offer('o1', 'A')],
      absences: [absence('a1', 'm1'), absence('a2', 'm1')],
    });
    const lines = summarizeDiff(diffAppData(prev, next));
    expect(lines).toContain('2 médiateurs ajoutés');
    expect(lines).toContain('1 offre supprimée');
    expect(lines).toContain('1 absence ajoutée');
  });

  it('combines changed slots detail with removed slots in one summary', () => {
    const offers = [offer('o1', 'Visite guidée')];
    const prev = data({
      offers,
      slots: [
        slot('s1', 'o1', { date: '2026-10-12', status: 'planned' }),
        slot('s2', 'o1', { date: '2026-10-13' }),
      ],
    });
    const next = data({
      offers,
      slots: [slot('s1', 'o1', { date: '2026-10-12', status: 'confirmed' })],
    });
    const lines = summarizeDiff(diffAppData(prev, next));
    expect(lines).toEqual([
      '1 créneau supprimé (Visite guidée — 13/10/2026)',
      '1 créneau modifié (Visite guidée — 12/10/2026 : statut)',
    ]);
  });
});
