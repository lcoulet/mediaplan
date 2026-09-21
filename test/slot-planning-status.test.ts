// getSlotPlanningStatus — weekly view planning state of a slot
import { describe, it, expect } from 'vitest';
import { getSlotPlanningStatus } from '../src/domain/models';
import type { AppData, Mediator, Offer, Slot, Absence } from '../src/domain/types';

const offer: Offer = {
  id: 'o1', name: 'Visite', description: '', duration: 60,
  capacity: 20, location: '',
  welcomeType: 'Réservable encadrée par médiateur',
};

const libreOffer: Offer = {
  ...offer, id: 'o-libre',
  welcomeType: 'Accueil Libre',
};

const mediator = (id: string, competences: { offerId: string; status: 'confirmed' | 'learning' }[] = []): Mediator => ({
  id, firstName: 'F', lastName: 'L' + id, email: '', phone: '', notes: '',
  color: '#ccc', active: true, competences,
});

const slot = (mediatorIds: string[], over: Partial<Slot> = {}): Slot => ({
  id: 's1', scheduleId: '', offerId: 'o1', mediatorIds,
  date: '2026-09-15', startTime: '10:00', endTime: '11:00',
  participantCount: 0, status: 'planned', notes: '', origin: 'manual',
  importSource: '', importedAt: '', modifiedAfterImport: false,
  groupName: '', guide: '', location: '', groupNature: '',
  contactName: '', contactPhone: '', contactEmail: '',
  ...over,
});

const absence = (mediatorId: string): Absence => ({
  id: 'a1', mediatorId, startDate: '2026-09-15', endDate: '2026-09-15',
  halfDay: 'none', type: 'leave', notes: '',
});

const data = (slots: Slot[], absences: Absence[] = [], mediators: Mediator[] = []): AppData => ({
  mediators, offers: [offer], schedules: [], slots, absences,
});

describe('getSlotPlanningStatus', () => {
  it('is UNASSIGNED when the slot has no mediator (top priority)', () => {
    const s = slot([]);
    expect(getSlotPlanningStatus(s, data([s], [], [mediator('m1')]))).toBe('unassigned');
  });

  it('is OK for an "Accueil Libre" offer even when the slot has no mediator', () => {
    const s = slot([], { offerId: 'o-libre' });
    const d = data([s], [], [mediator('m1')]);
    d.offers = [libreOffer];
    expect(getSlotPlanningStatus(s, d)).toBe('ok');
  });

  it('is OK for an "Accueil Libre" offer with an unconfirmed mediator (no mediator needed)', () => {
    const m = mediator('m1'); // no competence on the offer
    const s = slot(['m1'], { offerId: 'o-libre' });
    const d = data([s], [], [m]);
    d.offers = [libreOffer];
    expect(getSlotPlanningStatus(s, d)).toBe('ok');
  });

  it('is OK when a mediator is available AND confirmed for the offer', () => {
    const m = mediator('m1', [{ offerId: 'o1', status: 'confirmed' }]);
    const s = slot(['m1']);
    expect(getSlotPlanningStatus(s, data([s], [], [m]))).toBe('ok');
  });

  it('is DISPO_ISSUE when the only mediator is absent (availability before competence)', () => {
    // Absent mediator who IS confirmed: availability wins over competence
    const m = mediator('m1', [{ offerId: 'o1', status: 'confirmed' }]);
    const s = slot(['m1']);
    expect(getSlotPlanningStatus(s, data([s], [absence('m1')], [m]))).toBe('dispo_issue');
  });

  it('is DISPO_ISSUE when the only mediator has an overlapping slot', () => {
    const m = mediator('m1', [{ offerId: 'o1', status: 'confirmed' }]);
    const s = slot(['m1']);
    const overlap = slot(['m1'], { id: 's2', startTime: '10:30', endTime: '11:30' });
    expect(getSlotPlanningStatus(s, data([s, overlap], [], [m]))).toBe('dispo_issue');
  });

  it('is OK when at least ONE of several mediators is available and confirmed', () => {
    const m1 = mediator('m1', [{ offerId: 'o1', status: 'confirmed' }]);
    const m2 = mediator('m2', [{ offerId: 'o1', status: 'confirmed' }]);
    const s = slot(['m1', 'm2']);
    // m1 absent, m2 fine -> slot is OK
    expect(getSlotPlanningStatus(s, data([s], [absence('m1')], [m1, m2]))).toBe('ok');
  });

  it('is DISPO_ISSUE when ALL mediators are unavailable', () => {
    const m1 = mediator('m1', [{ offerId: 'o1', status: 'confirmed' }]);
    const m2 = mediator('m2', [{ offerId: 'o1', status: 'confirmed' }]);
    const s = slot(['m1', 'm2']);
    const a2 = { ...absence('m2'), id: 'a2' };
    expect(getSlotPlanningStatus(s, data([s], [absence('m1'), a2], [m1, m2]))).toBe('dispo_issue');
  });

  it('is LEARNING when no confirmed mediator but a learning one is available', () => {
    const m = mediator('m1', [{ offerId: 'o1', status: 'learning' }]);
    const s = slot(['m1']);
    expect(getSlotPlanningStatus(s, data([s], [], [m]))).toBe('learning');
  });

  it('is INCOMPETENT when the available mediator has no competence for the offer', () => {
    const m = mediator('m1'); // no competences
    const s = slot(['m1']);
    expect(getSlotPlanningStatus(s, data([s], [], [m]))).toBe('incompetent');
  });

  it('is INCOMPETENT when the available mediator is confirmed for ANOTHER offer', () => {
    const m = mediator('m1', [{ offerId: 'other', status: 'confirmed' }]);
    const s = slot(['m1']);
    expect(getSlotPlanningStatus(s, data([s], [], [m]))).toBe('incompetent');
  });

  it('treats an unavailable learning mediator as DISPO_ISSUE (availability first)', () => {
    const m = mediator('m1', [{ offerId: 'o1', status: 'learning' }]);
    const s = slot(['m1']);
    expect(getSlotPlanningStatus(s, data([s], [absence('m1')], [m]))).toBe('dispo_issue');
  });

  it('is OK when a confirmed mediator is available even if another is incompetent', () => {
    const m1 = mediator('m1', [{ offerId: 'o1', status: 'confirmed' }]);
    const m2 = mediator('m2', [{ offerId: 'other', status: 'confirmed' }]);
    const s = slot(['m1', 'm2']);
    expect(getSlotPlanningStatus(s, data([s], [], [m1, m2]))).toBe('ok');
  });
});
