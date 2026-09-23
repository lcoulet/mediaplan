// Demo data consistency: booking duration must equal the offer duration;
// setup/teardown extend the block but are NEVER part of the booking.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AppData } from '../src/domain/types';
import { seedDemoData } from '../src/presentation/DemoData';
import { getSlotTotalRange, getOfferTotalDuration } from '../src/domain/models';

function t2m(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function emptyData(): AppData {
  return { mediators: [], offers: [], schedules: [], slots: [], absences: [] };
}

describe('seedDemoData consistency', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    });
  });

  it('booking duration == offer duration for EVERY demo slot', () => {
    const data = emptyData();
    seedDemoData(data);

    expect(data.slots.length).toBeGreaterThan(100);

    const offerMap = new Map(data.offers.map(o => [o.id, o]));
    for (const slot of data.slots) {
      const offer = offerMap.get(slot.offerId);
      expect(offer, `slot ${slot.id} offer ${slot.offerId}`).toBeTruthy();
      const booking = t2m(slot.endTime) - t2m(slot.startTime);
      expect(
        booking,
        `slot ${slot.id} (${slot.startTime}-${slot.endTime}) booking ${booking} != offer "${offer!.name}" duration ${offer!.duration}`
      ).toBe(offer!.duration);
    }
  });

  it('total block = duration + setup + teardown (never includes booking overlap)', () => {
    const data = emptyData();
    seedDemoData(data);

    const offerMap = new Map(data.offers.map(o => [o.id, o]));
    for (const slot of data.slots) {
      const offer = offerMap.get(slot.offerId)!;
      const r = getSlotTotalRange(slot, offer);
      const block = t2m(r.end) - t2m(r.start);
      const expected = offer.duration
        + (slot.setupTime ?? offer.setupTime ?? 0)
        + (slot.teardownTime ?? offer.teardownTime ?? 0);
      expect(block, `slot ${slot.id}`).toBe(expected);
    }
  });

  it('offer logistics durations within {0..15} min and totals consistent', () => {
    const data = emptyData();
    seedDemoData(data);
    const setups = new Set(data.offers.map(o => o.setupTime ?? 0));
    expect(setups.has(0)).toBe(true);
    for (const o of data.offers) {
      expect(o.setupTime ?? 0).toBeLessThanOrEqual(15);
      expect(o.teardownTime ?? 0).toBeLessThanOrEqual(15);
      expect(getOfferTotalDuration(o)).toBe(
        o.duration + (o.setupTime ?? 0) + (o.teardownTime ?? 0)
      );
    }
  });

  it('slot setup/teardown copied from the offer at seed time', () => {
    const data = emptyData();
    seedDemoData(data);
    const offerMap = new Map(data.offers.map(o => [o.id, o]));
    for (const slot of data.slots) {
      const offer = offerMap.get(slot.offerId)!;
      expect(slot.setupTime).toBe(offer.setupTime);
      expect(slot.teardownTime).toBe(offer.teardownTime);
    }
  });
});
