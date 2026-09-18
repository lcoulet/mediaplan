// test/overlap.test.ts — Tests for slot overlap detection
import { describe, it, expect } from 'vitest';
import { hasMediatorOverlap } from '../src/domain/models';

describe('hasMediatorOverlap', () => {
  it('should return false when mediator has no other slots', () => {
    const slots: Parameters<typeof hasMediatorOverlap>[4] = [];
    const result = hasMediatorOverlap('med_1', '2026-09-15', '10:00', '11:00', slots, 'slot_new');
    expect(result).toBe(false);
  });

  it('should return false for slots on different dates', () => {
    const slots = [
      { id: 'slot_1', mediatorId: 'med_1', date: '2026-09-15', startTime: '10:00', endTime: '11:00' },
    ] as unknown as Parameters<typeof hasMediatorOverlap>[4];
    const result = hasMediatorOverlap('med_1', '2026-09-16', '10:00', '11:00', slots, 'slot_new');
    expect(result).toBe(false);
  });

  it('should return false for a different mediator on the same time', () => {
    const slots = [
      { id: 'slot_1', mediatorId: 'med_2', date: '2026-09-15', startTime: '10:00', endTime: '11:00' },
    ] as unknown as Parameters<typeof hasMediatorOverlap>[4];
    const result = hasMediatorOverlap('med_1', '2026-09-15', '10:00', '11:00', slots, 'slot_new');
    expect(result).toBe(false);
  });

  it('should return true when mediator has overlapping slot on same date', () => {
    const slots = [
      { id: 'slot_1', mediatorId: 'med_1', date: '2026-09-15', startTime: '10:00', endTime: '11:00' },
    ] as unknown as Parameters<typeof hasMediatorOverlap>[4];
    const result = hasMediatorOverlap('med_1', '2026-09-15', '10:30', '11:30', slots, 'slot_new');
    expect(result).toBe(true);
  });

  it('should return false when slots are adjacent but not overlapping', () => {
    const slots = [
      { id: 'slot_1', mediatorId: 'med_1', date: '2026-09-15', startTime: '10:00', endTime: '11:00' },
    ] as unknown as Parameters<typeof hasMediatorOverlap>[4];
    const result = hasMediatorOverlap('med_1', '2026-09-15', '11:00', '12:00', slots, 'slot_new');
    expect(result).toBe(false);
  });

  it('should return true when new slot fully contains existing slot', () => {
    const slots = [
      { id: 'slot_1', mediatorId: 'med_1', date: '2026-09-15', startTime: '10:00', endTime: '11:00' },
    ] as unknown as Parameters<typeof hasMediatorOverlap>[4];
    const result = hasMediatorOverlap('med_1', '2026-09-15', '09:00', '12:00', slots, 'slot_new');
    expect(result).toBe(true);
  });

  it('should return true when existing slot fully contains new slot', () => {
    const slots = [
      { id: 'slot_1', mediatorId: 'med_1', date: '2026-09-15', startTime: '09:00', endTime: '12:00' },
    ] as unknown as Parameters<typeof hasMediatorOverlap>[4];
    const result = hasMediatorOverlap('med_1', '2026-09-15', '10:00', '11:00', slots, 'slot_new');
    expect(result).toBe(true);
  });

  it('should ignore the slot being edited (excludeSelfId)', () => {
    const slots = [
      { id: 'slot_1', mediatorId: 'med_1', date: '2026-09-15', startTime: '10:00', endTime: '11:00' },
    ] as unknown as Parameters<typeof hasMediatorOverlap>[4];
    const result = hasMediatorOverlap('med_1', '2026-09-15', '10:30', '11:30', slots, 'slot_1');
    expect(result).toBe(false);
  });
});
