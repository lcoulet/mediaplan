// parallel-lanes.ts — Pack slots into parallel lanes for the daily view.
// Each lane holds only NON-overlapping slots, so blocks rendered side by
// side in the same lane never visually stack. Overlapping slots get
// separate lanes (greedy interval-partition packing).
import type { Slot } from './types';

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Partition slots into the minimum number of parallel lanes such that no
 * two slots in the same lane overlap. Touching ranges (a.end === b.start)
 * are allowed on the same lane. Slots are sorted by start time first, so
 * input order does not affect the result.
 */
export function computeParallelLanes(slots: Slot[]): Slot[][] {
  const sorted = [...slots].sort((a, b) => {
    const sa = toMinutes(a.startTime);
    const sb = toMinutes(b.startTime);
    if (sa !== sb) return sa - sb;
    return toMinutes(a.endTime) - toMinutes(b.endTime);
  });

  // laneEnds[i] = end time (minutes) of the last slot placed on lane i
  const laneEnds: number[] = [];
  const lanes: Slot[][] = [];

  for (const slot of sorted) {
    const start = toMinutes(slot.startTime);
    let placed = false;
    for (let i = 0; i < laneEnds.length; i++) {
      // Touching (start === laneEnds[i]) is NOT an overlap
      if (laneEnds[i] <= start) {
        lanes[i].push(slot);
        laneEnds[i] = toMinutes(slot.endTime);
        placed = true;
        break;
      }
    }
    if (!placed) {
      lanes.push([slot]);
      laneEnds.push(toMinutes(slot.endTime));
    }
  }

  return lanes;
}
