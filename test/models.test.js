// test/models.test.js — Tests for data models
// TDD: RED first, then GREEN

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// These will fail until models.js is implemented
import { generateId, createMediator, createOffer, createSchedule, createSlot, STATUS_LABELS } from '../js/models.js';

describe('generateId', () => {
    it('should generate a unique string with a prefix', () => {
        const id = generateId('med');
        assert.ok(typeof id === 'string');
        assert.ok(id.startsWith('med_'));
    });

    it('should generate different ids on subsequent calls', () => {
        const id1 = generateId('test');
        const id2 = generateId('test');
        assert.notEqual(id1, id2);
    });
});

describe('createMediator', () => {
    it('should create a mediator with default values', () => {
        const m = createMediator();
        assert.ok(m.id.startsWith('med_'));
        assert.equal(m.lastName, '');
        assert.equal(m.firstName, '');
        assert.equal(m.email, '');
        assert.equal(m.phone, '');
        assert.deepEqual(m.skills, []);
        assert.equal(m.active, true);
        assert.equal(m.notes, '');
    });

    it('should create a mediator from provided data', () => {
        const m = createMediator({
            lastName: 'Dupont',
            firstName: 'Marie',
            email: 'marie@museum.fr',
            phone: '0600000000',
            skills: ['off_1', 'off_2'],
            active: false,
            notes: 'Disponible le matin',
        });
        assert.equal(m.lastName, 'Dupont');
        assert.equal(m.firstName, 'Marie');
        assert.equal(m.email, 'marie@museum.fr');
        assert.equal(m.phone, '0600000000');
        assert.deepEqual(m.skills, ['off_1', 'off_2']);
        assert.equal(m.active, false);
        assert.equal(m.notes, 'Disponible le matin');
    });

    it('should preserve a provided id', () => {
        const m = createMediator({ id: 'custom_id' });
        assert.equal(m.id, 'custom_id');
    });
});

describe('createOffer', () => {
    it('should create an offer with default values', () => {
        const o = createOffer();
        assert.ok(o.id.startsWith('off_'));
        assert.equal(o.name, '');
        assert.equal(o.description, '');
        assert.equal(o.duration, 60);
        assert.equal(o.capacity, 30);
        assert.equal(o.location, '');
    });

    it('should create an offer from provided data', () => {
        const o = createOffer({
            name: 'Visite Dinosauria',
            description: 'Galerie des dinosaures',
            duration: 90,
            capacity: 25,
            location: 'Galerie Dinosauria',
        });
        assert.equal(o.name, 'Visite Dinosauria');
        assert.equal(o.duration, 90);
        assert.equal(o.capacity, 25);
        assert.equal(o.location, 'Galerie Dinosauria');
    });
});

describe('createSchedule', () => {
    it('should create a schedule with default values', () => {
        const s = createSchedule();
        assert.ok(s.id.startsWith('sch_'));
        assert.equal(s.title, '');
        assert.equal(s.startDate, '');
        assert.equal(s.endDate, '');
        assert.equal(s.status, 'draft');
    });

    it('should create a schedule from provided data', () => {
        const s = createSchedule({
            title: 'Planning septembre 2026',
            startDate: '2026-09-01',
            endDate: '2026-09-30',
            status: 'published',
        });
        assert.equal(s.title, 'Planning septembre 2026');
        assert.equal(s.startDate, '2026-09-01');
        assert.equal(s.status, 'published');
    });
});

describe('createSlot', () => {
    it('should create a slot with default values', () => {
        const s = createSlot();
        assert.ok(s.id.startsWith('slot_'));
        assert.equal(s.scheduleId, '');
        assert.equal(s.offerId, '');
        assert.deepEqual(s.mediatorIds, []);
        assert.equal(s.date, '');
        assert.equal(s.startTime, '09:00');
        assert.equal(s.endTime, '10:00');
        assert.equal(s.participantCount, 0);
        assert.equal(s.status, 'planned');
        assert.equal(s.notes, '');
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
        assert.equal(s.offerId, 'off_1');
        assert.deepEqual(s.mediatorIds, ['med_1']);
        assert.equal(s.date, '2026-09-15');
        assert.equal(s.startTime, '14:00');
        assert.equal(s.endTime, '16:00');
        assert.equal(s.participantCount, 20);
        assert.equal(s.status, 'confirmed');
        assert.equal(s.notes, 'Groupe scolaire');
    });
});

describe('STATUS_LABELS', () => {
    it('should contain French labels for schedule statuses', () => {
        assert.equal(STATUS_LABELS.schedule.draft, 'Brouillon');
        assert.equal(STATUS_LABELS.schedule.published, 'Publié');
        assert.equal(STATUS_LABELS.schedule.archived, 'Archivé');
    });

    it('should contain French labels for slot statuses', () => {
        assert.equal(STATUS_LABELS.slot.planned, 'Planifié');
        assert.equal(STATUS_LABELS.slot.confirmed, 'Confirmé');
        assert.equal(STATUS_LABELS.slot.cancelled, 'Annulé');
        assert.equal(STATUS_LABELS.slot.completed, 'Terminé');
    });
});
