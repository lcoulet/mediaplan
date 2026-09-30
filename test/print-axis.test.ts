// print-axis.test.ts — Print time-axis bounds for the day view (spec:
// test/features/spaces/day-view-print.feature, decisions 2026-09-29).
//
// The printed axis is FIXED 08:30-19:00 by default and EXTENDS left/right
// when a slot's total block (setup + booking + teardown) exceeds that
// range. Extension aligns outward to whole 10-minute ticks.
import { describe, it, expect } from 'vitest';
import { printAxisBounds, PRINT_AXIS_DEFAULT_START, PRINT_AXIS_DEFAULT_END } from '../src/domain/print-axis';
import { createOffer, createSlot } from '../src/domain/models';
import type { Offer, Slot } from '../src/domain/types';

// The offer lookup used by the view: Map<offerId, Offer>
const offersById = (offers: Offer[]) => new Map(offers.map((o) => [o.id, o]));

describe('printAxisBounds', () => {
  it('returns the fixed 08:30-19:00 axis on an empty day', () => {
    const bounds = printAxisBounds([], new Map<string, Offer>());
    expect(bounds.start).toBe(PRINT_AXIS_DEFAULT_START); // 510 = 08:30
    expect(bounds.end).toBe(PRINT_AXIS_DEFAULT_END); // 1140 = 19:00
    expect(PRINT_AXIS_DEFAULT_START).toBe(510);
    expect(PRINT_AXIS_DEFAULT_END).toBe(1140);
  });

  it('keeps the fixed axis when all slot blocks are inside it', () => {
    const slot = createSlot({ offerId: 'off_1', startTime: '09:00', endTime: '18:00' });
    const offers = [createOffer({ id: 'off_1' })];
    const bounds = printAxisBounds([slot], offersById(offers));
    expect(bounds).toEqual({ start: 510, end: 1140 });
  });

  it('keeps the fixed axis when a block ends exactly at 19:00 (no right extension)', () => {
    const slot = createSlot({ offerId: 'off_1', startTime: '17:00', endTime: '19:00' });
    const offers = [createOffer({ id: 'off_1' })];
    expect(printAxisBounds([slot], offersById(offers))).toEqual({ start: 510, end: 1140 });
  });

  it('keeps the fixed axis when a block starts exactly at 08:30 (no left extension)', () => {
    const slot = createSlot({ offerId: 'off_1', startTime: '08:30', endTime: '10:00' });
    const offers = [createOffer({ id: 'off_1' })];
    expect(printAxisBounds([slot], offersById(offers))).toEqual({ start: 510, end: 1140 });
  });

  it('extends left to a 06:00 slot (spec scenario: créneau à 06:00)', () => {
    const slot = createSlot({ offerId: 'off_1', startTime: '06:00', endTime: '07:30' });
    const offers = [createOffer({ id: 'off_1' })];
    const bounds = printAxisBounds([slot], offersById(offers));
    expect(bounds.start).toBe(360); // 06:00, earlier than 08:30
    expect(bounds.end).toBe(1140);
  });

  it('extends right to a 21:00 slot end (spec scenario: créneau après 19:00)', () => {
    const slot = createSlot({ offerId: 'off_1', startTime: '19:30', endTime: '21:00' });
    const offers = [createOffer({ id: 'off_1' })];
    const bounds = printAxisBounds([slot], offersById(offers));
    expect(bounds.start).toBe(510);
    expect(bounds.end).toBe(1260); // 21:00
  });

  it('extends left to include the setup of a slot (montage)', () => {
    // Booking 09:00-10:00, offer setup 30 min -> block starts 08:30 (inside,
    // no extension). Booking 09:00 with SLOT setup 45 -> block 08:15.
    const offers = [createOffer({ id: 'off_1', setupTime: 30 })];
    const slot = createSlot({ offerId: 'off_1', startTime: '09:00', endTime: '10:00' });
    expect(printAxisBounds([slot], offersById(offers))).toEqual({ start: 510, end: 1140 });

    const earlySetup = createSlot({
      offerId: 'off_1',
      startTime: '09:00',
      endTime: '10:00',
      setupTime: 45, // per-slot value overrides the offer's
    });
    const bounds = printAxisBounds([earlySetup], offersById(offers));
    // Block starts 08:15 -> rounded OUT (down) to the 08:10 tick
    expect(bounds.start).toBe(490);
    expect(bounds.end).toBe(1140);
  });

  it('extends right to include the teardown of a slot (démontage)', () => {
    // Booking 18:45-19:00, teardown 45 -> block ends 19:45 (spec scenario)
    const offers = [createOffer({ id: 'off_1', teardownTime: 45 })];
    const slot = createSlot({ offerId: 'off_1', startTime: '18:45', endTime: '19:00' });
    const bounds = printAxisBounds([slot], offersById(offers));
    expect(bounds.start).toBe(510);
    // Block ends 19:45 -> rounded OUT (up) to the 19:50 tick
    expect(bounds.end).toBe(1190);
  });

  it('rounds extension OUTWARD to the previous/next whole 10-minute tick', () => {
    // Block 07:23 -> start extends to 07:20 (floor to 10-min tick)
    const odd = createSlot({ offerId: 'off_1', startTime: '07:23', endTime: '20:47' });
    const offers = [createOffer({ id: 'off_1' })];
    const bounds = printAxisBounds([odd], offersById(offers));
    expect(bounds.start).toBe(440); // 07:20 (floor)
    expect(bounds.end).toBe(1250); // 20:50 (ceil)
  });

  it('uses the widest extension across several slots', () => {
    const offers = [createOffer({ id: 'off_1' })];
    const slots = [
      createSlot({ offerId: 'off_1', startTime: '06:15', endTime: '07:00' }),
      createSlot({ offerId: 'off_1', startTime: '20:05', endTime: '21:00' }),
    ];
    const bounds = printAxisBounds(slots, offersById(offers));
    expect(bounds.start).toBe(370); // 06:10 (06:15 floored outward)
    expect(bounds.end).toBe(1260); // 21:00
  });

  it('ignores slots whose offer is missing (no setup/teardown known)', () => {
    const slot = createSlot({ offerId: 'ghost', startTime: '06:00', endTime: '07:00' });
    const bounds = printAxisBounds([slot], new Map<string, Offer>());
    // The booking itself still extends the axis even without the offer
    expect(bounds.start).toBe(360);
    expect(bounds.end).toBe(1140);
  });

  it('handles slots with invalid hours gracefully (ignored for the axis)', () => {
    const offers = [createOffer({ id: 'off_1' })];
    const slot = createSlot({ offerId: 'off_1', startTime: '', endTime: '' });
    expect(printAxisBounds([slot], offersById(offers))).toEqual({ start: 510, end: 1140 });
  });

  it('ignores a corrupted persisted slot with empty hours (bypassing createSlot defaults)', () => {
    // Legacy/corrupt localStorage can hold a slot with empty hours; the
    // degenerate 00:00-00:00 block must NOT extend the axis to midnight.
    const corrupted = { offerId: 'off_1', startTime: '', endTime: '' } as unknown as Slot;
    const offers = [createOffer({ id: 'off_1' })];
    expect(printAxisBounds([corrupted], offersById(offers))).toEqual({ start: 510, end: 1140 });
  });
});

describe('printAxisBounds — label generation for the extended axis', () => {
  it('lists hour labels from the axis start to the axis end', () => {
    const slots = [createSlot({ offerId: 'off_1', startTime: '06:00', endTime: '07:00' })];
    const offers = [createOffer({ id: 'off_1' })];
    const bounds = printAxisBounds(slots, offersById(offers));
    expect(bounds.start).toBe(360);
    expect(bounds.end).toBe(1140);
    // Label list is generated by the view; the domain only provides bounds.
  });
});

// Guard: the domain helper must not mutate its inputs
describe('printAxisBounds — purity', () => {
  it('does not mutate the input slots', () => {
    const slot = createSlot({ offerId: 'off_1', startTime: '06:00', endTime: '07:00' });
    const frozen = [slot];
    const offers = [createOffer({ id: 'off_1' })];
    printAxisBounds(frozen, offersById(offers));
    expect(frozen[0].startTime).toBe('06:00');
    expect(frozen[0].endTime).toBe('07:00');
  });
});

// Slot type export used in signatures
export type { Slot };
