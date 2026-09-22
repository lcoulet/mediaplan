// parallel-lanes.test.ts — Tests for computeParallelLanes (daily view lanes)
import { describe, it, expect } from 'vitest';
import { computeParallelLanes } from '../src/domain/parallel-lanes';
import type { Slot } from '../src/domain/types';

// Minimal slot factory: only id + startTime/endTime matter for lane layout
function s(id: string, startTime: string, endTime: string): Slot {
  return {
    id,
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
    groupName: '',
    guide: '',
    location: '',
    groupNature: '',
    contactName: '',
    contactPhone: '',
    contactEmail: '',
  } as Slot;
}

describe('computeParallelLanes', () => {
  it('returns a single lane when no slots overlap', () => {
    const lanes = computeParallelLanes([
      s('a', '09:00', '10:00'),
      s('b', '10:00', '11:00'), // touching, not overlapping
      s('c', '14:00', '15:00'),
    ]);
    expect(lanes).toHaveLength(1);
    expect(lanes[0].map(x => x.id)).toEqual(['a', 'b', 'c']);
  });

  it('puts overlapping slots on separate lanes', () => {
    const lanes = computeParallelLanes([
      s('a', '10:00', '11:00'),
      s('b', '10:30', '11:30'),
      s('c', '10:45', '11:45'),
    ]);
    expect(lanes).toHaveLength(3);
    lanes.forEach(lane => expect(lane).toHaveLength(1));
  });

  it('packs slots into the first lane where they fit (lane packing)', () => {
    // a and b overlap; c starts after b ends and fits on lane 0 after a
    const lanes = computeParallelLanes([
      s('a', '10:00', '11:00'),
      s('b', '10:30', '11:30'),
      s('c', '11:30', '12:30'),
    ]);
    expect(lanes).toHaveLength(2);
    expect(lanes[0].map(x => x.id)).toEqual(['a', 'c']);
    expect(lanes[1].map(x => x.id)).toEqual(['b']);
  });

  it('handles containment (one slot inside another)', () => {
    const lanes = computeParallelLanes([
      s('a', '10:00', '12:00'),
      s('b', '10:30', '11:00'),
    ]);
    expect(lanes).toHaveLength(2);
  });

  it('returns an empty array for no slots', () => {
    expect(computeParallelLanes([])).toEqual([]);
  });

  it('sorts slots by start time before packing', () => {
    // Input order must not affect lane assignment
    const lanes = computeParallelLanes([
      s('c', '11:30', '12:30'),
      s('b', '10:30', '11:30'),
      s('a', '10:00', '11:00'),
    ]);
    expect(lanes[0].map(x => x.id)).toEqual(['a', 'c']);
    expect(lanes[1].map(x => x.id)).toEqual(['b']);
  });

  it('treats end == start of next slot as NOT overlapping (touching ok)', () => {
    const lanes = computeParallelLanes([
      s('a', '09:00', '10:00'),
      s('b', '10:00', '11:00'),
    ]);
    expect(lanes).toHaveLength(1);
  });
});
