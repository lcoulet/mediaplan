import { describe, it, expect } from 'vitest';
import {
  getSlotTotalRange,
  slotBookingFromDropPosition,
  getOfferTotalDuration,
} from '../src/domain/models';
import type { Offer, Slot } from '../src/domain/types';

const offer = (setup?: number, teardown?: number): Offer => ({
  id: 'o1',
  name: 'Visite',
  description: '',
  duration: 60,
  capacity: 20,
  location: '',
  ...(setup !== undefined ? { setupTime: setup } : {}),
  ...(teardown !== undefined ? { teardownTime: teardown } : {}),
  welcomeType: 'Réservable encadrée par médiateur',
});

const slot = (startTime: string, endTime: string): Slot => ({
  id: 's1',
  scheduleId: '',
  date: '2026-09-19',
  startTime,
  endTime,
  offerId: 'o1',
  mediatorIds: [],
  status: 'planned',
  origin: 'manual',
  participantCount: 0,
  notes: '',
  importSource: '',
  importedAt: '',
  modifiedAfterImport: false,
});

describe('getSlotTotalRange', () => {
  it('returns the booking period when the offer has no setup/teardown', () => {
    const r = getSlotTotalRange(slot('10:00', '12:00'), offer());
    expect(r.start).toBe('10:00');
    expect(r.end).toBe('12:00');
  });

  it('extends before with setup and after with teardown', () => {
    const r = getSlotTotalRange(slot('10:00', '11:00'), offer(15, 10));
    expect(r.start).toBe('09:45');
    expect(r.end).toBe('11:10');
  });

  it('slot durations override the offer durations', () => {
    // Offer says 15/10 but the slot overrides with 5/5
    const s = { ...slot('10:00', '11:00'), setupTime: 5, teardownTime: 5 };
    const r = getSlotTotalRange(s, offer(15, 10));
    expect(r.start).toBe('09:55');
    expect(r.end).toBe('11:05');
  });

  it('slot setupTime overrides only setup when teardown undefined', () => {
    const s = { ...slot('10:00', '11:00'), setupTime: 0 };
    const r = getSlotTotalRange(s, offer(15, 10));
    expect(r.start).toBe('10:00'); // slot overrides setup to 0
    expect(r.end).toBe('11:10');   // teardown still from offer
  });

  it('slot durations of 0 are honored (not treated as missing)', () => {
    const s = { ...slot('10:00', '11:00'), setupTime: 0, teardownTime: 0 };
    const r = getSlotTotalRange(s, offer(30, 20));
    expect(r.start).toBe('10:00');
    expect(r.end).toBe('11:00');
  });

  it('extends with setup only', () => {
    const r = getSlotTotalRange(slot('10:00', '11:00'), offer(30));
    expect(r.start).toBe('09:30');
    expect(r.end).toBe('11:00');
  });

  it('handles setup crossing midnight-hour boundaries in minutes', () => {
    // 60 min setup before 08:30 -> 07:30
    const r = getSlotTotalRange(slot('08:30', '09:30'), offer(60, 0));
    expect(r.start).toBe('07:30');
    expect(r.end).toBe('09:30');
  });

  it('returns null-safe fallback when slot times are missing', () => {
    const s = slot('', '');
    const r = getSlotTotalRange(s, offer(15, 10));
    expect(r.start).toBe('00:00');
    expect(r.end).toBe('00:00');
  });
});

describe('slotBookingFromDropPosition', () => {
  it('places booking start after setup when cursor marks total-block start', () => {
    // Cursor at 09:00, setup 15 min -> booking 09:15, duration 60 -> bookingEnd 10:15
    const r = slotBookingFromDropPosition('09:00', offer(15, 10));
    expect(r.startTime).toBe('09:15');
    expect(r.endTime).toBe('10:15');
  });

  it('keeps booking equal to drop position when no setup/teardown', () => {
    const r = slotBookingFromDropPosition('09:00', offer());
    expect(r.startTime).toBe('09:00');
    expect(r.endTime).toBe('10:00');
  });

  it('rounds across hour boundaries correctly', () => {
    // Drop 08:50, setup 30 -> booking 09:20, duration 60 -> 10:20
    const r = slotBookingFromDropPosition('08:50', offer(30, 20));
    expect(r.startTime).toBe('09:20');
    expect(r.endTime).toBe('10:20');
  });
});

describe('getOfferTotalDuration', () => {
  it('sums duration + setup + teardown', () => {
    expect(getOfferTotalDuration(offer(15, 10))).toBe(85);
  });

  it('returns duration alone when no setup/teardown', () => {
    expect(getOfferTotalDuration(offer())).toBe(60);
  });

  it('handles partial values', () => {
    expect(getOfferTotalDuration(offer(30))).toBe(90);
  });
});
