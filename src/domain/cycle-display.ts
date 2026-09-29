// cycle-display.ts — Pure display helpers for the daily view's work-cycle
// integration: lane pills (cycle week + contract type + arrangement),
// working-hours hatching segments, and the light non-blocking slot
// assignment warning. Pure functions only, no browser APIs.
// Spec: test/features/cycles/cycle-model.feature (display + warning
// scenarios) and contract-type.feature (pill scenarios).

import type { Mediator, WorkCycle } from './types';
import { cycleWeekForDate, getWorkedHoursForDate } from './cycles';

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** « Alice Dupont » — display name of a mediator in French UI messages. */
function mediatorDisplayName(mediator: Mediator): string {
  return `${mediator.firstName} ${mediator.lastName}`.trim();
}

/** The mediator's active work cycle from the cycle list, or undefined. */
function activeCycleOf(mediator: Mediator, cycles: WorkCycle[]): WorkCycle | undefined {
  if (!mediator.activeCycleId) return undefined;
  return cycles.find((c) => c.id === mediator.activeCycleId);
}

// ---- Lane pills -----------------------------------------------------------

export interface MediatorPills {
  /** Name of the active cycle week for the displayed date (e.g. « S2 »). */
  cycleWeek?: string;
  /** Free-text contract type, shown as a pill when set. */
  contractType?: string;
  /** Free-text working-time arrangement, shown as a pill when set. */
  arrangement?: string;
}

/**
 * Pills displayed next to the mediator name in the daily view lane:
 * the cycle-week pill (only when the mediator has an active cycle),
 * the contract-type pill and the arrangement pill (only when set).
 */
export function getPillsForMediator(
  mediator: Mediator,
  cycles: WorkCycle[],
  date: Date
): MediatorPills {
  const pills: MediatorPills = {};
  const cycle = activeCycleOf(mediator, cycles);
  if (cycle) {
    const week = cycleWeekForDate(cycle, date);
    if (week) pills.cycleWeek = week.name;
  }
  if (mediator.contractType) pills.contractType = mediator.contractType;
  if (mediator.arrangement) pills.arrangement = mediator.arrangement;
  return pills;
}

// ---- Working-hours hatching ------------------------------------------------

export interface HatchingSegment {
  /** Segment start on the daily axis, minutes from midnight. */
  startMin: number;
  /** Segment end on the daily axis, minutes from midnight. */
  endMin: number;
}

export type HatchingResult =
  | { kind: 'none' }
  | { kind: 'full' }
  | { kind: 'segments'; segments: HatchingSegment[] };

/**
 * Hatching to apply on the mediator's lane track for the displayed date:
 *  - no cycle          → none (no hatching at all)
 *  - non-worked day    → full (the entire track hatched, visually distinct)
 *  - worked day        → the segments of the visible axis OUTSIDE the worked
 *    range (before its start, after its end), clamped to the axis
 */
export function hatchingForDate(
  cycle: WorkCycle | undefined,
  date: Date,
  axisStartMin: number,
  axisEndMin: number
): HatchingResult {
  if (!cycle) return { kind: 'none' };
  const hours = getWorkedHoursForDate(cycle, date);
  if (!hours.worked) return { kind: 'full' };
  const start = timeToMinutes(hours.startTime);
  const end = timeToMinutes(hours.endTime);
  const segments: HatchingSegment[] = [];
  if (start > axisStartMin) {
    segments.push({ startMin: axisStartMin, endMin: Math.min(start, axisEndMin) });
  }
  if (end < axisEndMin) {
    segments.push({ startMin: Math.max(end, axisStartMin), endMin: axisEndMin });
  }
  return { kind: 'segments', segments: segments.filter((s) => s.endMin > s.startMin) };
}

// ---- Light (non-blocking) slot assignment warning ---------------------------

/**
 * French warning shown in the slot modal when the slot falls outside the
 * mediator's cycle — LIGHT and non-blocking (the slot stays creatable):
 *  - outside the worked range: « Hors plage horaire de travail de X (09:30-18:00) »
 *  - non-worked day:           « X ne travaille pas ce jour-là (cycle) »
 * Returns '' when there is nothing to warn about (no cycle, or the slot is
 * inside the worked range).
 */
export function slotCycleWarning(
  mediator: Mediator,
  cycles: WorkCycle[],
  date: Date,
  slotStart: string,
  slotEnd: string
): string {
  const cycle = activeCycleOf(mediator, cycles);
  if (!cycle) return '';
  const name = mediatorDisplayName(mediator);
  const hours = getWorkedHoursForDate(cycle, date);
  if (!hours.worked) {
    return `${name} ne travaille pas ce jour-là (cycle)`;
  }
  const start = timeToMinutes(hours.startTime);
  const end = timeToMinutes(hours.endTime);
  const slotStartMin = timeToMinutes(slotStart);
  const slotEndMin = timeToMinutes(slotEnd);
  if (slotStartMin < start || slotEndMin > end) {
    // French elision: « d'Alice » before a vowel-initial name, « de Karim » otherwise
    const de = /^[aeiouyAEIOUY]/.test(name) ? 'd’' : 'de ';
    return `Hors plage horaire de travail ${de}${name} (${hours.startTime}-${hours.endTime})`;
  }
  return '';
}
