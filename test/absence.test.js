// test/absence.test.js — Tests for mediator unavailability (absence)
// TDD: RED first, then GREEN

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { createAbsence, isMediatorAvailable, ABSENCE_TYPE_LABELS } from '../js/models.js';

describe('createAbsence', () => {
    it('should create an absence with default values', () => {
        const a = createAbsence();
        assert.ok(a.id.startsWith('abs_'));
        assert.equal(a.mediatorId, '');
        assert.equal(a.startDate, '');
        assert.equal(a.endDate, '');
        assert.equal(a.halfDay, 'none');
        assert.equal(a.type, 'other');
        assert.equal(a.notes, '');
    });

    it('should create an absence from provided data', () => {
        const a = createAbsence({
            mediatorId: 'med_1',
            startDate: '2026-09-15',
            endDate: '2026-09-15',
            halfDay: 'morning',
            type: 'leave',
            notes: 'CP',
        });
        assert.equal(a.mediatorId, 'med_1');
        assert.equal(a.startDate, '2026-09-15');
        assert.equal(a.endDate, '2026-09-15');
        assert.equal(a.halfDay, 'morning');
        assert.equal(a.type, 'leave');
        assert.equal(a.notes, 'CP');
    });

    it('should preserve a provided id', () => {
        const a = createAbsence({ id: 'custom_abs' });
        assert.equal(a.id, 'custom_abs');
    });
});

describe('isMediatorAvailable', () => {
    const mediatorId = 'med_1';

    it('should return true when no absences', () => {
        const absences = [];
        const result = isMediatorAvailable(mediatorId, '2026-09-15', '10:00', '11:00', absences);
        assert.equal(result, true);
    });

    it('should return false when mediator has a full-day absence on that date', () => {
        const absences = [
            createAbsence({ mediatorId, startDate: '2026-09-15', endDate: '2026-09-15', halfDay: 'none' }),
        ];
        const result = isMediatorAvailable(mediatorId, '2026-09-15', '10:00', '11:00', absences);
        assert.equal(result, false);
    });

    it('should return false when mediator has morning absence and slot is in the morning', () => {
        const absences = [
            createAbsence({ mediatorId, startDate: '2026-09-15', endDate: '2026-09-15', halfDay: 'morning' }),
        ];
        const morning = isMediatorAvailable(mediatorId, '2026-09-15', '09:00', '11:00', absences);
        assert.equal(morning, false);
    });

    it('should return true when mediator has morning absence but slot is in the afternoon', () => {
        const absences = [
            createAbsence({ mediatorId, startDate: '2026-09-15', endDate: '2026-09-15', halfDay: 'morning' }),
        ];
        const afternoon = isMediatorAvailable(mediatorId, '2026-09-15', '14:00', '16:00', absences);
        assert.equal(afternoon, true);
    });

    it('should return false when mediator has afternoon absence and slot is in the afternoon', () => {
        const absences = [
            createAbsence({ mediatorId, startDate: '2026-09-15', endDate: '2026-09-15', halfDay: 'afternoon' }),
        ];
        const afternoon = isMediatorAvailable(mediatorId, '2026-09-15', '14:00', '16:00', absences);
        assert.equal(afternoon, false);
    });

    it('should return true when mediator has afternoon absence but slot is in the morning', () => {
        const absences = [
            createAbsence({ mediatorId, startDate: '2026-09-15', endDate: '2026-09-15', halfDay: 'afternoon' }),
        ];
        const morning = isMediatorAvailable(mediatorId, '2026-09-15', '09:00', '11:00', absences);
        assert.equal(morning, true);
    });

    it('should return false when mediator has a multi-day absence covering the date', () => {
        const absences = [
            createAbsence({ mediatorId, startDate: '2026-09-10', endDate: '2026-09-20', halfDay: 'none' }),
        ];
        const result = isMediatorAvailable(mediatorId, '2026-09-15', '10:00', '11:00', absences);
        assert.equal(result, false);
    });

    it('should ignore absences from other mediators', () => {
        const absences = [
            createAbsence({ mediatorId: 'med_2', startDate: '2026-09-15', endDate: '2026-09-15', halfDay: 'none' }),
        ];
        const result = isMediatorAvailable(mediatorId, '2026-09-15', '10:00', '11:00', absences);
        assert.equal(result, true);
    });
});

describe('ABSENCE_TYPE_LABELS', () => {
    it('should contain French labels for all absence types', () => {
        assert.equal(ABSENCE_TYPE_LABELS.leave, 'Congés (CP/RTT)');
        assert.equal(ABSENCE_TYPE_LABELS.mission, 'Mission');
        assert.equal(ABSENCE_TYPE_LABELS.training, 'Formation');
        assert.equal(ABSENCE_TYPE_LABELS.sick, 'Maladie');
        assert.equal(ABSENCE_TYPE_LABELS.other, 'Autre');
    });
});
