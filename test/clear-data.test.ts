// test/clear-data.test.ts — clearPlanningData domain function
import { describe, it, expect } from 'vitest';
import { clearPlanningData } from '../src/domain/clear-data';
import type { AppData } from '../src/domain/types';
import { createMediator, createOffer, createSlot, createAbsence } from '../src/domain/models';

function buildData(): AppData {
  return {
    mediators: [
      createMediator({ lastName: 'Dupont', firstName: 'Jean', color: '#ff0000' }),
      createMediator({ lastName: 'Martin', firstName: 'Claude', color: '#00ff00' }),
    ],
    offers: [
      createOffer({ id: 'o1', name: 'Visite guidée', duration: 60 }),
      createOffer({ id: 'o2', name: 'Atelier', duration: 90 }),
    ],
    schedules: [
      { id: 'sch1', title: 'Septembre', startDate: '2026-09-01', endDate: '2026-09-30', status: 'published', locked: true } as AppData['schedules'][number],
    ],
    slots: [
      createSlot({ offerId: 'o1', mediatorIds: ['m1'], date: '2026-09-10', startTime: '10:00', endTime: '11:00' }),
      createSlot({ offerId: 'o2', date: '2026-09-11', startTime: '14:00', endTime: '15:30' }),
    ],
    absences: [
      createAbsence({ mediatorId: 'm1', startDate: '2026-09-12', endDate: '2026-09-12' }),
    ],
  };
}

describe('clearPlanningData', () => {
  it('clears only planning data by default (slots, absences, schedules)', () => {
    const result = clearPlanningData(buildData());
    expect(result.slots).toHaveLength(0);
    expect(result.absences).toHaveLength(0);
    expect(result.schedules).toHaveLength(0);
    // Mediators and offers survive by default
    expect(result.mediators).toHaveLength(2);
    expect(result.offers).toHaveLength(2);
  });

  it('also clears mediators when asked', () => {
    const result = clearPlanningData(buildData(), { clearMediators: true });
    expect(result.mediators).toHaveLength(0);
    expect(result.offers).toHaveLength(2);
  });

  it('also clears offers when asked', () => {
    const result = clearPlanningData(buildData(), { clearOffers: true });
    expect(result.offers).toHaveLength(0);
    expect(result.mediators).toHaveLength(2);
  });

  it('clears everything when both options are set', () => {
    const result = clearPlanningData(buildData(), { clearMediators: true, clearOffers: true });
    expect(result).toEqual({
      mediators: [],
      offers: [],
      schedules: [],
      slots: [],
      absences: [],
    });
  });

  it('does not mutate the input data', () => {
    const data = buildData();
    const before = JSON.stringify(data);
    clearPlanningData(data, { clearMediators: true, clearOffers: true });
    expect(JSON.stringify(data)).toBe(before);
  });
});
