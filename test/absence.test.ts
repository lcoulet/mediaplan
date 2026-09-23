// test/absence.test.ts — Tests for mediator unavailability (absence)
import { describe, it, expect } from 'vitest';
import { createAbsence, isMediatorAvailable, ABSENCE_TYPE_LABELS } from '../src/domain/models';

describe('createAbsence', () => {
  it('should create an absence with default values', () => {
    const a = createAbsence();
    expect(a.id.startsWith('abs_')).toBe(true);
    expect(a.mediatorId).toBe('');
    expect(a.startDate).toBe('');
    expect(a.endDate).toBe('');
    expect(a.halfDay).toBe('none');
    expect(a.type).toBe('other');
    expect(a.notes).toBe('');
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
    expect(a.mediatorId).toBe('med_1');
    expect(a.startDate).toBe('2026-09-15');
    expect(a.endDate).toBe('2026-09-15');
    expect(a.halfDay).toBe('morning');
    expect(a.type).toBe('leave');
    expect(a.notes).toBe('CP');
  });

  it('should preserve a provided id', () => {
    const a = createAbsence({ id: 'custom_abs' });
    expect(a.id).toBe('custom_abs');
  });
});

describe('isMediatorAvailable', () => {
  const mediatorId = 'med_1';

  it('should return true when no absences', () => {
    const absences: Parameters<typeof isMediatorAvailable>[4] = [];
    const result = isMediatorAvailable(mediatorId, '2026-09-15', '10:00', '11:00', absences);
    expect(result).toBe(true);
  });

  it('should return false when mediator has a full-day absence on that date', () => {
    const absences = [
      createAbsence({ mediatorId, startDate: '2026-09-15', endDate: '2026-09-15', halfDay: 'none' }),
    ];
    const result = isMediatorAvailable(mediatorId, '2026-09-15', '10:00', '11:00', absences);
    expect(result).toBe(false);
  });

  it('should return false when mediator has morning absence and slot is in the morning', () => {
    const absences = [
      createAbsence({ mediatorId, startDate: '2026-09-15', endDate: '2026-09-15', halfDay: 'morning' }),
    ];
    const morning = isMediatorAvailable(mediatorId, '2026-09-15', '09:00', '11:00', absences);
    expect(morning).toBe(false);
  });

  it('should return true when mediator has morning absence but slot is in the afternoon', () => {
    const absences = [
      createAbsence({ mediatorId, startDate: '2026-09-15', endDate: '2026-09-15', halfDay: 'morning' }),
    ];
    const afternoon = isMediatorAvailable(mediatorId, '2026-09-15', '14:00', '16:00', absences);
    expect(afternoon).toBe(true);
  });

  it('should return false when mediator has afternoon absence and slot is in the afternoon', () => {
    const absences = [
      createAbsence({ mediatorId, startDate: '2026-09-15', endDate: '2026-09-15', halfDay: 'afternoon' }),
    ];
    const afternoon = isMediatorAvailable(mediatorId, '2026-09-15', '14:00', '16:00', absences);
    expect(afternoon).toBe(false);
  });

  it('should return true when mediator has afternoon absence but slot is in the morning', () => {
    const absences = [
      createAbsence({ mediatorId, startDate: '2026-09-15', endDate: '2026-09-15', halfDay: 'afternoon' }),
    ];
    const morning = isMediatorAvailable(mediatorId, '2026-09-15', '09:00', '11:00', absences);
    expect(morning).toBe(true);
  });

  it('should return false when mediator has a multi-day absence covering the date', () => {
    const absences = [
      createAbsence({ mediatorId, startDate: '2026-09-10', endDate: '2026-09-20', halfDay: 'none' }),
    ];
    const result = isMediatorAvailable(mediatorId, '2026-09-15', '10:00', '11:00', absences);
    expect(result).toBe(false);
  });

  it('should ignore absences from other mediators', () => {
    const absences = [
      createAbsence({ mediatorId: 'med_2', startDate: '2026-09-15', endDate: '2026-09-15', halfDay: 'none' }),
    ];
    const result = isMediatorAvailable(mediatorId, '2026-09-15', '10:00', '11:00', absences);
    expect(result).toBe(true);
  });
});

describe('ABSENCE_TYPE_LABELS', () => {
  it('should contain French labels for all absence types', () => {
    expect(ABSENCE_TYPE_LABELS.leave).toBe('Congés (CP/RTT)');
    expect(ABSENCE_TYPE_LABELS.mission).toBe('Mission');
    expect(ABSENCE_TYPE_LABELS.training).toBe('Formation');
    expect(ABSENCE_TYPE_LABELS.sick).toBe('Maladie');
    expect(ABSENCE_TYPE_LABELS.other).toBe('Autre');
  });
});
