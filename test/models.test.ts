// test/models.test.ts — Tests for data models
import { describe, it, expect } from 'vitest';
import { generateId, createMediator, createOffer, createSchedule, createSlot, STATUS_LABELS } from '../src/domain/models';

describe('generateId', () => {
  it('should generate a unique string with a prefix', () => {
    const id = generateId('med');
    expect(typeof id).toBe('string');
    expect(id.startsWith('med_')).toBe(true);
  });

  it('should generate different ids on subsequent calls', () => {
    const id1 = generateId('test');
    const id2 = generateId('test');
    expect(id1).not.toBe(id2);
  });
});

describe('createMediator', () => {
  it('should create a mediator with default values', () => {
    const m = createMediator();
    expect(m.id.startsWith('med_')).toBe(true);
    expect(m.lastName).toBe('');
    expect(m.firstName).toBe('');
    expect(m.email).toBe('');
    expect(m.phone).toBe('');
    expect(m.competences).toEqual([]);
    expect(m.active).toBe(true);
    expect(m.notes).toBe('');
  });

  it('should create a mediator from provided data', () => {
    const m = createMediator({
      lastName: 'Dupont',
      firstName: 'Marie',
      email: 'marie@museum.fr',
      phone: '0600000000',
      competences: [{ offerId: 'off_1', status: 'confirmed' }, { offerId: 'off_2', status: 'learning' }],
      active: false,
      notes: 'Disponible le matin',
    });
    expect(m.lastName).toBe('Dupont');
    expect(m.firstName).toBe('Marie');
    expect(m.email).toBe('marie@museum.fr');
    expect(m.phone).toBe('0600000000');
    expect(m.competences).toEqual([{ offerId: 'off_1', status: 'confirmed' }, { offerId: 'off_2', status: 'learning' }]);
    expect(m.active).toBe(false);
    expect(m.notes).toBe('Disponible le matin');
  });

  it('should preserve a provided id', () => {
    const m = createMediator({ id: 'custom_id' });
    expect(m.id).toBe('custom_id');
  });
});

describe('createOffer', () => {
  it('should create an offer with default values', () => {
    const o = createOffer();
    expect(o.id.startsWith('off_')).toBe(true);
    expect(o.name).toBe('');
    expect(o.description).toBe('');
    expect(o.duration).toBe(60);
    expect(o.capacity).toBe(30);
    expect(o.location).toBe('');
  });

  it('should create an offer from provided data', () => {
    const o = createOffer({
      name: 'Visite Dinosauria',
      description: 'Galerie des dinosaures',
      duration: 90,
      capacity: 25,
      location: 'Galerie Dinosauria',
    });
    expect(o.name).toBe('Visite Dinosauria');
    expect(o.duration).toBe(90);
    expect(o.capacity).toBe(25);
    expect(o.location).toBe('Galerie Dinosauria');
  });
});

describe('createSchedule', () => {
  it('should create a schedule with default values', () => {
    const s = createSchedule();
    expect(s.id.startsWith('sch_')).toBe(true);
    expect(s.title).toBe('');
    expect(s.startDate).toBe('');
    expect(s.endDate).toBe('');
    expect(s.status).toBe('draft');
  });

  it('should create a schedule from provided data', () => {
    const s = createSchedule({
      title: 'Planning septembre 2026',
      startDate: '2026-09-01',
      endDate: '2026-09-30',
      status: 'published',
    });
    expect(s.title).toBe('Planning septembre 2026');
    expect(s.startDate).toBe('2026-09-01');
    expect(s.status).toBe('published');
  });
});

describe('createSlot', () => {
  it('should create a slot with default values', () => {
    const s = createSlot();
    expect(s.id.startsWith('slot_')).toBe(true);
    expect(s.scheduleId).toBe('');
    expect(s.offerId).toBe('');
    expect(s.mediatorIds).toEqual([]);
    expect(s.date).toBe('');
    expect(s.startTime).toBe('09:00');
    expect(s.endTime).toBe('10:00');
    expect(s.participantCount).toBe(0);
    expect(s.status).toBe('planned');
    expect(s.notes).toBe('');
  });

  it('should create a slot from provided data', () => {
    const s = createSlot({
      offerId: 'off_1',
      mediatorIds: ['med_1'],
      date: '2026-09-15',
      startTime: '14:00',
      endTime: '16:00',
      participantCount: 20,
      status: 'confirmed',
      notes: 'Groupe scolaire',
    });
    expect(s.offerId).toBe('off_1');
    expect(s.mediatorIds).toEqual(['med_1']);
    expect(s.date).toBe('2026-09-15');
    expect(s.startTime).toBe('14:00');
    expect(s.endTime).toBe('16:00');
    expect(s.participantCount).toBe(20);
    expect(s.status).toBe('confirmed');
    expect(s.notes).toBe('Groupe scolaire');
  });
});

describe('STATUS_LABELS', () => {
  it('should contain French labels for schedule statuses', () => {
    expect(STATUS_LABELS.schedule.draft).toBe('Brouillon');
    expect(STATUS_LABELS.schedule.published).toBe('Publié');
    expect(STATUS_LABELS.schedule.archived).toBe('Archivé');
  });

  it('should contain French labels for slot statuses', () => {
    expect(STATUS_LABELS.slot.planned).toBe('Planifié');
    expect(STATUS_LABELS.slot.confirmed).toBe('Confirmé');
    expect(STATUS_LABELS.slot.cancelled).toBe('Annulé');
    expect(STATUS_LABELS.slot.completed).toBe('Terminé');
  });
});
