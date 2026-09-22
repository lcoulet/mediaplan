// test/print-selection.test.ts — mediator rows to print in the daily view
import { describe, it, expect } from 'vitest';
import { mediatorsForPrint } from '../src/domain/print-selection';
import type { AppData, Mediator, Slot, Absence } from '../src/domain/types';

const med = (id: string, active = true): Mediator =>
  ({ id, lastName: id.toUpperCase(), firstName: '', email: '', phone: '', notes: '', color: '#ccc', active, competences: [] } as Mediator);

const slot = (id: string, mediatorIds: string[], date = '2026-09-22'): Slot =>
  ({ id, offerId: 'o1', mediatorIds, date, startTime: '10:00', endTime: '11:00', status: 'ok', origin: 'manual', createdAt: '', modifiedAfterImport: false, setupTime: 0, teardownTime: 0, participantCount: 0, groupName: '', guide: '', location: '', groupNature: '', contactName: '', contactPhone: '', contactEmail: '', notes: '', contractNumber: '', site: '' } as unknown as Slot);

const absence = (id: string, mediatorId: string, date = '2026-09-22'): Absence =>
  ({ id, mediatorId, startDate: date, endDate: date, halfDay: 'none', type: 'leave', notes: '' } as Absence);

describe('mediatorsForPrint', () => {
  it('keeps only mediators with a slot or an absence on the day', () => {
    const data = {
      mediators: [med('m1'), med('m2'), med('m3')],
      offers: [],
      schedules: [],
      slots: [slot('s1', ['m1']), slot('s2', ['m2', 'm3'])],
      absences: [absence('a1', 'm2')],
    } as unknown as AppData;
    // m1: slot; m2: slot + absence; m3: slot
    const ids = mediatorsForPrint(data, '2026-09-22');
    expect(ids).toEqual(['m1', 'm2', 'm3']);
  });

  it('excludes mediators with nothing on the day', () => {
    const data = {
      mediators: [med('m1'), med('m2'), med('m3')],
      offers: [],
      schedules: [],
      slots: [slot('s1', ['m2'])],
      absences: [],
    } as unknown as AppData;
    const ids = mediatorsForPrint(data, '2026-09-22');
    expect(ids).toEqual(['m2']);
  });

  it('keeps a mediator with only an absence', () => {
    const data = {
      mediators: [med('m1'), med('m2')],
      offers: [],
      schedules: [],
      slots: [],
      absences: [absence('a1', 'm1')],
    } as unknown as AppData;
    const ids = mediatorsForPrint(data, '2026-09-22');
    expect(ids).toEqual(['m1']);
  });

  it('ignores other days and cancelled slots', () => {
    const data = {
      mediators: [med('m1'), med('m2'), med('m3')],
      offers: [],
      schedules: [],
      slots: [
        slot('s1', ['m1'], '2026-09-21'), // other day
        { ...slot('s2', ['m2']), status: 'cancelled' } as Slot,
      ],
      absences: [absence('a1', 'm3', '2026-09-23')], // other day
    } as unknown as AppData;
    expect(mediatorsForPrint(data, '2026-09-22')).toEqual([]);
  });

  it('preserves the input mediator order', () => {
    const data = {
      mediators: [med('m3'), med('m1'), med('m2')],
      offers: [],
      schedules: [],
      slots: [slot('s1', ['m2']), slot('s2', ['m3'])],
      absences: [],
    } as unknown as AppData;
    expect(mediatorsForPrint(data, '2026-09-22')).toEqual(['m3', 'm2']);
  });
});
