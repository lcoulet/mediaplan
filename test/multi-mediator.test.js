// test/multi-mediator.test.js — Tests for multi-mediator slot model
// TDD: RED first, then GREEN

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const { createSlot, hasMediatorOverlap } = await import('../js/models.js');

describe('createSlot — multi-mediator', () => {
    it('should default mediatorIds to empty array', () => {
        const slot = createSlot();
        assert.deepEqual(slot.mediatorIds, []);
    });

    it('should accept mediatorIds array', () => {
        const slot = createSlot({ mediatorIds: ['med_1', 'med_2'] });
        assert.deepEqual(slot.mediatorIds, ['med_1', 'med_2']);
    });

    it('should accept a single mediatorId and convert to mediatorIds array', () => {
        const slot = createSlot({ mediatorId: 'med_1' });
        assert.deepEqual(slot.mediatorIds, ['med_1']);
    });

    it('should handle empty mediatorId as empty mediatorIds', () => {
        const slot = createSlot({ mediatorId: '' });
        assert.deepEqual(slot.mediatorIds, []);
    });

    it('should not duplicate mediatorId if both mediatorId and mediatorIds provided', () => {
        const slot = createSlot({ mediatorId: 'med_1', mediatorIds: ['med_2'] });
        assert.deepEqual(slot.mediatorIds, ['med_2']);
    });
});

describe('hasMediatorOverlap — multi-mediator', () => {
    const baseSlots = [
        { id: 'slot_a', mediatorIds: ['med_1'], date: '2026-09-15', startTime: '09:00', endTime: '10:30' },
        { id: 'slot_b', mediatorIds: ['med_2', 'med_3'], date: '2026-09-15', startTime: '11:00', endTime: '12:00' },
    ];

    it('should detect overlap when mediator is in mediatorIds of existing slot', () => {
        const result = hasMediatorOverlap('med_1', '2026-09-15', '10:00', '11:00', baseSlots, 'new_slot');
        assert.equal(result, true);
    });

    it('should detect overlap for second mediator in a multi-mediator slot', () => {
        const result = hasMediatorOverlap('med_3', '2026-09-15', '11:30', '12:30', baseSlots, 'new_slot');
        assert.equal(result, true);
    });

    it('should return false when no overlap with any mediator', () => {
        const result = hasMediatorOverlap('med_1', '2026-09-15', '11:00', '12:00', baseSlots, 'new_slot');
        assert.equal(result, false);
    });

    it('should return false for empty mediatorId', () => {
        const result = hasMediatorOverlap('', '2026-09-15', '09:00', '10:00', baseSlots, 'new_slot');
        assert.equal(result, false);
    });

    it('should exclude the slot being edited', () => {
        const result = hasMediatorOverlap('med_1', '2026-09-15', '09:00', '10:00', baseSlots, 'slot_a');
        assert.equal(result, false);
    });

    it('should handle backward-compatible slots with mediatorId instead of mediatorIds', () => {
        const legacySlots = [
            { id: 'slot_old', mediatorId: 'med_1', date: '2026-09-15', startTime: '09:00', endTime: '10:00' },
        ];
        const result = hasMediatorOverlap('med_1', '2026-09-15', '09:30', '10:30', legacySlots, 'new_slot');
        assert.equal(result, true);
    });
});
