// stats.ts — Pure statistics computations for the Stats view.
// All functions take AppData + a period [startDate, endDate] (ISO dates,
// inclusive) and return plain data structures ready for chart rendering.
// Cancelled slots are excluded everywhere.

import type { AppData, Slot, Absence } from './types';
import { getISOWeekNumber } from './models';

// A standard workday used to compare animation time vs absence time.
export const WORKDAY_MINUTES = 7 * 60;

export function slotMinutes(slot: Slot): number {
  const [sh, sm] = slot.startTime.split(':').map(Number);
  const [eh, em] = slot.endTime.split(':').map(Number);
  return eh * 60 + em - (sh * 60 + sm);
}

/** Slots in the period that are not cancelled. */
export function activeSlotsInPeriod(data: AppData, startDate: string, endDate: string): Slot[] {
  return data.slots.filter(
    s => s.date >= startDate && s.date <= endDate && s.status !== 'cancelled'
  );
}

/** Absences overlapping the period (an absence counts if any of its days is in range). */
export function absencesInPeriod(data: AppData, startDate: string, endDate: string): Absence[] {
  return data.absences.filter(a => a.startDate <= endDate && a.endDate >= startDate);
}

/** Number of absence days, half days counting 0.5. Clamped to the period. */
export function absenceDays(a: Absence, startDate: string, endDate: string): number {
  const from = a.startDate < startDate ? startDate : a.startDate;
  const to = a.endDate > endDate ? endDate : a.endDate;
  const msPerDay = 86400000;
  const days = Math.floor((Date.parse(to) - Date.parse(from)) / msPerDay) + 1;
  const full = a.halfDay === 'none' ? days : days - 0.5;
  return Math.max(0, full);
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// ---- Onglet Médiateurs ----

export interface MediatorOfferCount {
  offerId: string;
  name: string;
  count: number;
}

export interface MediatorStats {
  mediatorId: string;
  name: string;
  active: boolean;
  slotCount: number;
  totalMinutes: number;
  absenceCount: number;
  absenceDays: number;
  offers: MediatorOfferCount[]; // sorted by count desc
  animationVsAbsenceRatio: number; // animation minutes / absence minutes
}

export function computeMediatorStats(
  data: AppData,
  startDate: string,
  endDate: string
): { mediators: MediatorStats[]; unassignedCount: number } {
  const slots = activeSlotsInPeriod(data, startDate, endDate);
  const absences = absencesInPeriod(data, startDate, endDate);

  // Unassigned reservations of the period (no mediator, not free visits)
  const freeOfferIds = new Set(
    data.offers.filter(o => o.welcomeType === 'Accueil Libre').map(o => o.id)
  );
  const unassignedCount = slots.filter(
    s => s.mediatorIds.length === 0 && !freeOfferIds.has(s.offerId)
  ).length;

  const mediators = data.mediators.map(mediator => {
    const own = slots.filter(s => s.mediatorIds.includes(mediator.id));
    const ownAbsences = absences.filter(a => a.mediatorId === mediator.id);
    const totalMinutes = own.reduce((sum, s) => sum + slotMinutes(s), 0);
    const days = ownAbsences.reduce((sum, a) => sum + absenceDays(a, startDate, endDate), 0);

    // Count animations per offer, sorted desc
    const byOffer = new Map<string, number>();
    for (const s of own) {
      byOffer.set(s.offerId, (byOffer.get(s.offerId) || 0) + 1);
    }
    const offers: MediatorOfferCount[] = [...byOffer.entries()]
      .map(([offerId, count]) => ({
        offerId,
        name: data.offers.find(o => o.id === offerId)?.name || '—',
        count,
      }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

    const absenceMinutes = days * WORKDAY_MINUTES;

    return {
      mediatorId: mediator.id,
      name: `${mediator.lastName} ${mediator.firstName}`,
      active: mediator.active,
      slotCount: own.length,
      totalMinutes,
      absenceCount: ownAbsences.length,
      absenceDays: days,
      offers,
      animationVsAbsenceRatio: absenceMinutes > 0 ? totalMinutes / absenceMinutes : Infinity,
    };
  })
    // Sort by cumulative duration (desc), then name for stable ties
    .sort((a, b) => b.totalMinutes - a.totalMinutes || a.name.localeCompare(b.name));

  return { mediators, unassignedCount };
}

// ---- Onglet Réservations (offres) ----

export interface ParticipantCandle {
  min: number;
  median: number;
  avg: number;
  max: number;
}

export interface OfferStats {
  offerId: string;
  name: string;
  count: number;
  totalMinutes: number;
  participants: ParticipantCandle;
}

export interface OfferStatsResult {
  offers: OfferStats[]; // sorted by count desc
  assignmentRate: number; // share of non-free slots with >= 1 mediator
}

export function computeOfferStats(data: AppData, startDate: string, endDate: string): OfferStatsResult {
  const slots = activeSlotsInPeriod(data, startDate, endDate);
  const freeOfferIds = new Set(
    data.offers.filter(o => o.welcomeType === 'Accueil Libre').map(o => o.id)
  );

  const byOffer = new Map<string, Slot[]>();
  for (const s of slots) {
    if (!byOffer.has(s.offerId)) byOffer.set(s.offerId, []);
    byOffer.get(s.offerId)!.push(s);
  }

  const offers: OfferStats[] = [...byOffer.entries()].map(([offerId, list]) => {
    const participants = list.map(s => s.participantCount);
    return {
      offerId,
      name: data.offers.find(o => o.id === offerId)?.name || '—',
      count: list.length,
      totalMinutes: list.reduce((sum, s) => sum + slotMinutes(s), 0),
      participants: {
        min: Math.min(...participants),
        median: median(participants),
        avg: participants.reduce((a, b) => a + b, 0) / participants.length,
        max: Math.max(...participants),
      },
    };
  }).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const relevant = slots.filter(s => !freeOfferIds.has(s.offerId));
  const assigned = relevant.filter(s => s.mediatorIds.length > 0);

  return {
    offers,
    assignmentRate: relevant.length > 0 ? assigned.length / relevant.length : 1,
  };
}

// ---- Stat b: weekday distribution ----

export interface WeekdayStats {
  weekday: number; // 1 = Monday … 7 = Sunday
  label: string;
  count: number;
}

const WEEKDAY_LABELS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

export function computeWeekdayStats(data: AppData, startDate: string, endDate: string): WeekdayStats[] {
  const slots = activeSlotsInPeriod(data, startDate, endDate);
  const counts = new Array(7).fill(0);
  for (const s of slots) {
    const d = new Date(`${s.date}T00:00:00`);
    counts[(d.getDay() + 6) % 7] += 1; // Monday = 0
  }
  return counts.map((count, i) => ({ weekday: i + 1, label: WEEKDAY_LABELS[i], count }));
}

// ---- Stat c: top groups ----

export interface GroupStats {
  groupName: string;
  slotCount: number;
  totalParticipants: number;
}

export function computeGroupStats(data: AppData, startDate: string, endDate: string): GroupStats[] {
  const slots = activeSlotsInPeriod(data, startDate, endDate);
  const byGroup = new Map<string, GroupStats>();
  for (const s of slots) {
    const key = s.groupName || '—';
    const g = byGroup.get(key) || { groupName: key, slotCount: 0, totalParticipants: 0 };
    g.slotCount += 1;
    g.totalParticipants += s.participantCount;
    byGroup.set(key, g);
  }
  return [...byGroup.values()].sort((a, b) => b.totalParticipants - a.totalParticipants);
}

// ---- Stat e: weekly load per mediator ----

export interface WeeklyLoad {
  week: number; // ISO week number
  minutes: number;
}

export function computeMediatorWeeklyLoad(
  data: AppData,
  startDate: string,
  endDate: string
): Map<string, WeeklyLoad[]> {
  const slots = activeSlotsInPeriod(data, startDate, endDate);
  const result = new Map<string, Map<number, number>>();
  for (const s of slots) {
    const week = getISOWeekNumber(new Date(`${s.date}T00:00:00`));
    for (const mid of s.mediatorIds) {
      if (!result.has(mid)) result.set(mid, new Map());
      const weeks = result.get(mid)!;
      weeks.set(week, (weeks.get(week) || 0) + slotMinutes(s));
    }
  }
  const out = new Map<string, WeeklyLoad[]>();
  for (const [mid, weeks] of result) {
    out.set(mid, [...weeks.entries()]
      .map(([week, minutes]) => ({ week, minutes }))
      .sort((a, b) => a.week - b.week));
  }
  return out;
}

// ---- Onglet Visites ----

export interface VisitNaturePart {
  nature: string;
  participants: number;
}

export interface VisitStackPoint {
  // Daily bucket when the period is <= 3 months, weekly bucket otherwise.
  date: string; // day the bucket starts at (ISO)
  week?: number; // ISO week number (weekly buckets only)
  label: string;
  parts: VisitNaturePart[];
  total: number;
}

export interface VisitCumulativePoint {
  date: string;
  cumulative: number;
}

export interface NatureCandle {
  nature: string;
  min: number;
  median: number;
  avg: number;
  max: number;
  count: number;
}

export interface NatureTotal {
  nature: string;
  totalParticipants: number;
  slotCount: number;
}

export interface VisitStats {
  free: { slotCount: number; totalParticipants: number };
  accompanied: { slotCount: number; totalParticipants: number };
  cumulative: VisitCumulativePoint[]; // one point per day of the period
  byNature: VisitStackPoint[]; // daily or weekly buckets
  natureCandles: NatureCandle[]; // one candle per group nature
  natureTotals: NatureTotal[]; // total participants per nature, sorted desc
  bucket: 'day' | 'week';
}

const THREE_MONTHS_DAYS = 91;

function isoAddDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function formatDayLabel(dateStr: string): string {
  const [, m, d] = dateStr.split('-').map(Number);
  return `${d}/${m}`;
}

export interface WeekdayVisitCandle {
  weekday: number; // 1 = Monday … 7 = Sunday
  label: string;
  min: number;
  median: number;
  avg: number;
  max: number;
  days: number; // number of such days in the period
}

/** Candle per weekday over the distribution of daily visit counts (all
 * days of the period count, including days with zero visits). */
export function computeWeekdayVisitCandles(
  data: AppData,
  startDate: string,
  endDate: string
): WeekdayVisitCandle[] {
  const slots = activeSlotsInPeriod(data, startDate, endDate);
  const perDay = new Map<string, number>();
  {
    let d = startDate;
    while (d <= endDate) {
      perDay.set(d, 0);
      d = isoAddDays(d, 1);
    }
  }
  for (const s of slots) {
    perDay.set(s.date, (perDay.get(s.date) || 0) + 1);
  }
  const byWeekday = new Map<number, number[]>();
  for (const [date, count] of perDay) {
    const d = new Date(`${date}T00:00:00`);
    const wd = ((d.getDay() + 6) % 7) + 1;
    if (!byWeekday.has(wd)) byWeekday.set(wd, []);
    byWeekday.get(wd)!.push(count);
  }
  return [...byWeekday.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([weekday, values]) => ({
      weekday,
      label: WEEKDAY_LABELS[weekday - 1],
      min: Math.min(...values),
      median: median(values),
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      max: Math.max(...values),
      days: values.length,
    }));
}

const NATURE_UNSET = 'Non renseigné';

export function computeVisitStats(data: AppData, startDate: string, endDate: string): VisitStats {
  const slots = activeSlotsInPeriod(data, startDate, endDate);
  const freeOfferIds = new Set(
    data.offers.filter(o => o.welcomeType === 'Accueil Libre').map(o => o.id)
  );

  const free = slots.filter(s => freeOfferIds.has(s.offerId));
  const accompanied = slots.filter(s => !freeOfferIds.has(s.offerId));
  const totalFree = free.reduce((sum, s) => sum + s.participantCount, 0);
  const totalAcc = accompanied.reduce((sum, s) => sum + s.participantCount, 0);

  // Daily cumulative over the whole period (every day present, 0 included)
  const perDay = new Map<string, number>();
  {
    let d = startDate;
    while (d <= endDate) {
      perDay.set(d, 0);
      d = isoAddDays(d, 1);
    }
  }
  for (const s of slots) {
    perDay.set(s.date, (perDay.get(s.date) || 0) + s.participantCount);
  }
  let run = 0;
  const cumulative: VisitCumulativePoint[] = [...perDay.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, participants]) => {
      run += participants;
      return { date, cumulative: run };
    });

  // Bucket: day if period <= 3 months, week otherwise
  const dayCount = Math.round((Date.parse(endDate) - Date.parse(startDate)) / 86400000) + 1;
  const bucket: 'day' | 'week' = dayCount <= THREE_MONTHS_DAYS ? 'day' : 'week';

  // group slots per bucket
  const buckets = new Map<string, Slot[]>();
  for (const s of slots) {
    let key: string;
    if (bucket === 'day') {
      key = s.date;
    } else {
      // Monday of the slot's ISO week
      const d = new Date(`${s.date}T00:00:00`);
      const mon = new Date(d);
      mon.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      const m = String(mon.getMonth() + 1).padStart(2, '0');
      const dd = String(mon.getDate()).padStart(2, '0');
      key = `${mon.getFullYear()}-${m}-${dd}`;
    }
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(s);
  }

  const byNature: VisitStackPoint[] = [...buckets.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, list]) => {
      const parts = new Map<string, number>();
      for (const s of list) {
        const nature = s.groupNature || NATURE_UNSET;
        parts.set(nature, (parts.get(nature) || 0) + s.participantCount);
      }
      return {
        date,
        ...(bucket === 'week' ? { week: getISOWeekNumber(new Date(`${date}T00:00:00`)) } : {}),
        label: bucket === 'day' ? formatDayLabel(date) : `S${getISOWeekNumber(new Date(`${date}T00:00:00`))}`,
        parts: [...parts.entries()]
          .map(([nature, participants]) => ({ nature, participants }))
          .sort((a, b) => b.participants - a.participants),
        total: list.reduce((sum, s) => sum + s.participantCount, 0),
      };
    });

  // Candle per group nature: distribution of participants per slot
  const byNatureSlots = new Map<string, number[]>();
  for (const s of slots) {
    const nature = s.groupNature || NATURE_UNSET;
    if (!byNatureSlots.has(nature)) byNatureSlots.set(nature, []);
    byNatureSlots.get(nature)!.push(s.participantCount);
  }
  const natureCandles: NatureCandle[] = [...byNatureSlots.entries()].map(([nature, values]) => ({
    nature,
    min: Math.min(...values),
    median: median(values),
    avg: values.reduce((a, b) => a + b, 0) / values.length,
    max: Math.max(...values),
    count: values.length,
  })).sort((a, b) => b.count - a.count);

  // Total participants per nature over the whole period, sorted desc
  const natureTotalsMap = new Map<string, NatureTotal>();
  for (const s of slots) {
    const nature = s.groupNature || NATURE_UNSET;
    const t = natureTotalsMap.get(nature) || { nature, totalParticipants: 0, slotCount: 0 };
    t.totalParticipants += s.participantCount;
    t.slotCount += 1;
    natureTotalsMap.set(nature, t);
  }
  const natureTotals: NatureTotal[] = [...natureTotalsMap.values()].sort(
    (a, b) => b.totalParticipants - a.totalParticipants
  );

  return {
    free: { slotCount: free.length, totalParticipants: totalFree },
    accompanied: { slotCount: accompanied.length, totalParticipants: totalAcc },
    cumulative,
    byNature,
    natureCandles,
    natureTotals,
    bucket,
  };
}
