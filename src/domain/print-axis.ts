// print-axis.ts — Print time-axis bounds for the daily view
//
// Spec: test/features/spaces/day-view-print.feature (design decisions
// 2026-09-29): the printed axis is FIXED 08:30-19:00; it EXTENDS left
// and/or right when a slot's total block (setup + booking + teardown)
// exceeds that range. Extensions round OUTWARD to whole 10-minute ticks
// (the app's planning granularity), keeping the axis aligned with the
// grid. Pure logic, no browser APIs.

import { getSlotTotalRange } from './models';
import type { Offer, Slot } from './types';

/** Fixed default axis start: 08:30 (minutes from midnight). */
export const PRINT_AXIS_DEFAULT_START = 510;
/** Fixed default axis end: 19:00 (minutes from midnight). */
export const PRINT_AXIS_DEFAULT_END = 1140;

/** The app's planning granularity: extension ticks. */
const TICK = 10;

export interface PrintAxisBounds {
  /** Axis start, minutes from midnight. */
  start: number;
  /** Axis end, minutes from midnight (exclusive-style bound: last label). */
  end: number;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return NaN;
  return (h || 0) * 60 + (m || 0);
}
/**
 * Bounds of the printed time axis for a day's slots.
 *
 * - Default (no slot, or all blocks inside): 08:30 - 19:00.
 * - The earliest block start (setup included) extends the axis LEFT when
 *   it is earlier than 08:30; the latest block end (teardown included)
 *   extends it RIGHT when later than 19:00.
 * - Extensions round outward to the previous/next whole 10-minute tick,
 *   so the axis stays aligned with the planning grid.
 * - Slots with invalid/missing hours are ignored (they contribute no
 *   geometry, mirroring getSlotTotalRange's guard).
 * - Slots whose offer is missing still contribute their booking hours;
 *   only setup/teardown are unknowable.
 */
export function printAxisBounds(
  slots: Slot[],
  offersBySlot: Map<string, Offer>
): PrintAxisBounds {
  let start = PRINT_AXIS_DEFAULT_START;
  let end = PRINT_AXIS_DEFAULT_END;

  for (const slot of slots) {
    const offer = offersBySlot.get(slot.offerId);
    const total = getSlotTotalRange(slot, offer);
    // A slot with missing/empty hours yields the degenerate '00:00-00:00'
    // block (getSlotTotalRange's fallback) — ignore it, it must not extend
    // the axis to midnight.
    if (!slot.startTime || !slot.endTime) continue;
    const blockStart = timeToMinutes(total.start);
    const blockEnd = timeToMinutes(total.end);
    if (Number.isNaN(blockStart) || Number.isNaN(blockEnd)) continue;
    if (blockStart < start) {
      // Round OUTWARD (down) to the previous whole 10-minute tick
      start = Math.max(0, Math.floor(blockStart / TICK) * TICK);
    }
    if (blockEnd > end) {
      // Round OUTWARD (up) to the next whole 10-minute tick
      end = Math.min(24 * 60, Math.ceil(blockEnd / TICK) * TICK);
    }
  }

  return { start, end };
}
