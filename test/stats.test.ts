// stats.test.ts — Tests for the statistics domain module
import { describe, it, expect } from 'vitest';
import {
  computeMediatorStats,
  computeOfferStats,
  computeVisitStats,
  computeWeekdayStats,
  computeGroupStats,
  computeMediatorWeeklyLoad,
  computeWeekdayVisitCandles,
} from '../src/domain/stats';
import type { AppData, Slot, Absence } from '../src/domain/types';

// ---- Minimal factories ----

function slot(over: Partial<Slot>): Slot {
  return {
    id: 'x', scheduleId: '', date: '2026-09-10', startTime: '10:00',
    endTime: '11:00', offerId: 'o1', mediatorIds: [], participantCount: 10,
    status: 'planned', notes: '', origin: 'manual', importSource: '',
    importedAt: '', modifiedAfterImport: false, groupName: '', guide: '',
    location: '', groupNature: '', contactName: '', contactPhone: '', contactEmail: '',
    ...over,
  };
}

function absence(over: Partial<Absence>): Absence {
  return {
    id: 'a1', mediatorId: 'm1', startDate: '2026-09-10', endDate: '2026-09-10',
    halfDay: 'none', type: 'leave', notes: '', ...over,
  };
}

const data: AppData = {
  mediators: [
    { id: 'm1', firstName: 'Jean', lastName: 'Dupont', email: '', phone: '', notes: '', color: '#F00', active: true, competences: [] },
    { id: 'm2', firstName: 'Marie', lastName: 'Martin', email: '', phone: '', notes: '', color: '#0F0', active: false, competences: [] },
  ],
  offers: [
    { id: 'o1', name: 'Visite guidée', description: '', duration: 60, capacity: 20, location: '', setupTime: 0, teardownTime: 0, welcomeType: 'Réservable encadrée par médiateur' },
    { id: 'o2', name: 'Atelier', description: '', duration: 90, capacity: 15, location: '', setupTime: 0, teardownTime: 0, welcomeType: 'Réservable encadrée par médiateur' },
    { id: 'o3', name: 'Libre', description: '', duration: 60, capacity: 60, location: '', welcomeType: 'Accueil Libre' },
  ],
  schedules: [],
  absences: [],
  slots: [],
};

describe('computeMediatorStats', () => {
  it('counts slots, cumulative time and absences per mediator (inactive included)', () => {
    const d: AppData = {
      ...data,
      slots: [
        slot({ id: 's1', offerId: 'o1', mediatorIds: ['m1'], date: '2026-09-10', startTime: '10:00', endTime: '11:00' }),
        slot({ id: 's2', offerId: 'o1', mediatorIds: ['m1'], date: '2026-09-11', startTime: '14:00', endTime: '15:00' }),
        slot({ id: 's3', offerId: 'o2', mediatorIds: ['m1', 'm2'], date: '2026-09-12', startTime: '09:00', endTime: '10:30' }),
      ],
      absences: [
        absence({ id: 'a1', mediatorId: 'm1', startDate: '2026-09-13', endDate: '2026-09-14', halfDay: 'none' }),
        absence({ id: 'a2', mediatorId: 'm1', startDate: '2026-09-15', endDate: '2026-09-15', halfDay: 'morning' }),
      ],
    };
    const stats = computeMediatorStats(d, '2026-09-01', '2026-09-30').mediators;
    const m1 = stats.find(s => s.mediatorId === 'm1')!;
    expect(m1.slotCount).toBe(3);
    expect(m1.totalMinutes).toBe(60 + 60 + 90);
    expect(m1.absenceCount).toBe(2);
    expect(m1.absenceDays).toBe(2.5); // 2 full + 1 half
    // offers ranked by count desc: o1 x2, o2 x1
    expect(m1.offers).toHaveLength(2);
    expect(m1.offers[0]).toEqual({ offerId: 'o1', name: 'Visite guidée', count: 2 });
    expect(m1.offers[1]).toEqual({ offerId: 'o2', name: 'Atelier', count: 1 });
    // inactive mediator m2 is included
    expect(stats.find(s => s.mediatorId === 'm2')!.slotCount).toBe(1);
  });

  it('sorts mediators by cumulative duration desc (name tie-break)', () => {
    // m1: 60 min total; m2: 90 min total → m2 first
    const d: AppData = {
      ...data,
      slots: [
        slot({ id: 's1', mediatorIds: ['m1'], date: '2026-09-10', startTime: '10:00', endTime: '11:00', offerId: 'o1' }),
        slot({ id: 's2', mediatorIds: ['m2'], date: '2026-09-11', startTime: '10:00', endTime: '11:30', offerId: 'o1' }),
      ],
    };
    const stats = computeMediatorStats(d, '2026-09-01', '2026-09-30').mediators;
    expect(stats[0].mediatorId).toBe('m2');
    expect(stats[0].totalMinutes).toBe(90);
    expect(stats[1].mediatorId).toBe('m1');
  });

  it('ignores cancelled slots and slots outside the period', () => {
    const d: AppData = {
      ...data,
      slots: [
        slot({ id: 's1', mediatorIds: ['m1'], date: '2026-09-10' }),
        slot({ id: 's2', mediatorIds: ['m1'], date: '2026-09-10', status: 'cancelled' }),
        slot({ id: 's3', mediatorIds: ['m1'], date: '2026-10-05' }), // outside
      ],
    };
    const stats = computeMediatorStats(d, '2026-09-01', '2026-09-30').mediators;
    expect(stats.find(s => s.mediatorId === 'm1')!.slotCount).toBe(1);
  });

  it('computes animation vs absence ratio (stat f)', () => {
    const d: AppData = {
      ...data,
      slots: [slot({ id: 's1', mediatorIds: ['m1'], date: '2026-09-10', startTime: '10:00', endTime: '18:00' })], // 480 min = 8h
      absences: [absence({ id: 'a1', mediatorId: 'm1', startDate: '2026-09-11', endDate: '2026-09-11' })], // 1 day = 7h worked
    };
    const stats = computeMediatorStats(d, '2026-09-01', '2026-09-30').mediators;
    const m1 = stats.find(s => s.mediatorId === 'm1')!;
    // animation minutes vs absence minutes (absence days * workday 7h)
    expect(m1.animationVsAbsenceRatio).toBeCloseTo(480 / (1 * 420), 2);
  });

  it('includes unassigned reservations in the mediator table total', () => {
    // The "Total" column = own animations + unassigned slots of the period
    // (unassigned slots have no mediator — they count once globally, not per
    // mediator).
    const d: AppData = {
      ...data,
      slots: [
        slot({ id: 's1', offerId: 'o1', mediatorIds: ['m1'] }),
        slot({ id: 's2', offerId: 'o2', mediatorIds: ['m2'] }),
        slot({ id: 's3', offerId: 'o2' }), // unassigned
        slot({ id: 's4', offerId: 'o1' }), // unassigned
      ],
    };
    const stats = computeMediatorStats(d, '2026-09-01', '2026-09-30');
    expect(stats.unassignedCount).toBe(2);
  });
});

describe('computeOfferStats', () => {
  it('aggregates count, cumulative duration, participant min/median/avg/max per offer, sorted desc by count', () => {
    const d: AppData = {
      ...data,
      slots: [
        // o1: 3 slots, participants 30, 10, 20 -> median 20, avg 20, min 10, max 30
        slot({ id: 's1', offerId: 'o1', participantCount: 30, date: '2026-09-10', startTime: '10:00', endTime: '11:00' }),
        slot({ id: 's2', offerId: 'o1', participantCount: 10, date: '2026-09-11', startTime: '10:00', endTime: '11:00' }),
        slot({ id: 's3', offerId: 'o1', participantCount: 20, date: '2026-09-12', startTime: '10:00', endTime: '11:00' }),
        // o2: 1 slot
        slot({ id: 's4', offerId: 'o2', participantCount: 5, date: '2026-09-10', startTime: '14:00', endTime: '15:30' }),
      ],
    };
    const result = computeOfferStats(d, '2026-09-01', '2026-09-30');
    const stats = result.offers;
    expect(stats).toHaveLength(2);
    expect(stats[0].offerId).toBe('o1');
    expect(stats[0].count).toBe(3);
    expect(stats[0].totalMinutes).toBe(180);
    expect(stats[0].participants).toEqual({ min: 10, median: 20, avg: 20, max: 30 });
    expect(stats[1].offerId).toBe('o2');
    expect(stats[1].totalMinutes).toBe(90);
    // tie-break on count desc: o1 (3) before o2 (1)
    expect(stats[0].count).toBeGreaterThanOrEqual(stats[1].count);
  });

  it('computes assignment rate (stat a) — slots with at least one mediator', () => {
    const d: AppData = {
      ...data,
      slots: [
        slot({ id: 's1', offerId: 'o1', mediatorIds: ['m1'] }),
        slot({ id: 's2', offerId: 'o2' }), // unassigned
        slot({ id: 's3', offerId: 'o3' }), // free visit (not required)
      ],
    };
    const stats = computeOfferStats(d, '2026-09-01', '2026-09-30');
    // overall assignment rate excludes free visits: 1 assigned of 2 relevant
    expect(stats.assignmentRate).toBe(0.5);
  });
});

describe('computeWeekdayStats (stat b)', () => {
  it('counts slots per weekday Monday-Sunday over the period', () => {
    const d: AppData = {
      ...data,
      slots: [
        // 2026-09-07 is a Monday, 2026-09-09 Wednesday, 2026-09-12 Saturday
        slot({ id: 's1', date: '2026-09-07' }),
        slot({ id: 's2', date: '2026-09-09' }),
        slot({ id: 's3', date: '2026-09-09' }),
        slot({ id: 's4', date: '2026-09-12' }),
      ],
    };
    const stats = computeWeekdayStats(d, '2026-09-01', '2026-09-30');
    expect(stats).toHaveLength(7);
    expect(stats[0]).toEqual({ weekday: 1, label: 'Lundi', count: 1 });
    expect(stats[2]).toEqual({ weekday: 3, label: 'Mercredi', count: 2 });
    expect(stats[5]).toEqual({ weekday: 6, label: 'Samedi', count: 1 });
    expect(stats[6].count).toBe(0); // Sunday
  });
});

describe('computeGroupStats (stat c)', () => {
  it('ranks groups by cumulative participant count desc', () => {
    const d: AppData = {
      ...data,
      slots: [
        slot({ id: 's1', groupName: 'École A', participantCount: 30 }),
        slot({ id: 's2', groupName: 'École A', participantCount: 15 }),
        slot({ id: 's3', groupName: 'École B', participantCount: 40 }),
      ],
    };
    const stats = computeGroupStats(d, '2026-09-01', '2026-09-30');
    expect(stats[0].groupName).toBe('École A');
    expect(stats[0].totalParticipants).toBe(45);
    expect(stats[1].groupName).toBe('École B');
    expect(stats[1].totalParticipants).toBe(40);
    expect(stats[0].slotCount).toBe(2);
  });
});

describe('computeMediatorWeeklyLoad (stat e)', () => {
  it('sums animation minutes per ISO week per mediator', () => {
    const d: AppData = {
      ...data,
      slots: [
        // 2026-09-07 (Mon) and 2026-09-09 (Wed) are both ISO week 37
        slot({ id: 's1', mediatorIds: ['m1'], date: '2026-09-07', startTime: '10:00', endTime: '11:00' }),
        slot({ id: 's2', mediatorIds: ['m1'], date: '2026-09-09', startTime: '10:00', endTime: '11:30' }),
        // 2026-09-14 is week 38
        slot({ id: 's3', mediatorIds: ['m1'], date: '2026-09-14', startTime: '10:00', endTime: '11:00' }),
      ],
    };
    const load = computeMediatorWeeklyLoad(d, '2026-09-01', '2026-09-30');
    const m1 = load.get('m1')!;
    expect(m1.find(w => w.week === 37)!.minutes).toBe(150);
    expect(m1.find(w => w.week === 38)!.minutes).toBe(60);
  });
});

describe('computeWeekdayVisitCandles', () => {
  it('builds one candle per weekday over daily visit counts (zero days included)', () => {
    // Week 2026-09-07 (Mon) to 2026-09-13 (Sun):
    // Mon 07: 2 slots, Mon 14: 1 slot (next Monday, outside period here)
    const d: AppData = {
      ...data,
      slots: [
        slot({ id: 's1', date: '2026-09-07' }), // Monday
        slot({ id: 's2', date: '2026-09-07' }), // Monday
        slot({ id: 's3', date: '2026-09-09' }), // Wednesday
      ],
    };
    const candles = computeWeekdayVisitCandles(d, '2026-09-07', '2026-09-13');
    expect(candles).toHaveLength(7);
    const monday = candles.find(c => c.weekday === 1)!;
    // Only ONE Monday in the period: distribution = [2]
    expect(monday.min).toBe(2);
    expect(monday.max).toBe(2);
    expect(monday.days).toBe(1);
    const tuesday = candles.find(c => c.weekday === 2)!;
    expect(tuesday.min).toBe(0);
    expect(tuesday.max).toBe(0);
    expect(tuesday.median).toBe(0);
    const wednesday = candles.find(c => c.weekday === 3)!;
    expect(wednesday.max).toBe(1);
  });

  it('aggregates multiple same-weekday days into one distribution', () => {
    // Two Mondays: 2026-09-07 (2 slots) and 2026-09-14 (4 slots)
    const d: AppData = {
      ...data,
      slots: [
        slot({ id: 's1', date: '2026-09-07' }),
        slot({ id: 's2', date: '2026-09-07' }),
        slot({ id: 's3', date: '2026-09-14' }),
        slot({ id: 's4', date: '2026-09-14' }),
        slot({ id: 's5', date: '2026-09-14' }),
        slot({ id: 's6', date: '2026-09-14' }),
      ],
    };
    const candles = computeWeekdayVisitCandles(d, '2026-09-07', '2026-09-20');
    const monday = candles.find(c => c.weekday === 1)!;
    expect(monday.days).toBe(2);
    expect(monday.min).toBe(2);
    expect(monday.max).toBe(4);
    expect(monday.median).toBe(3);
    expect(monday.avg).toBe(3);
  });
});

describe('computeVisitStats', () => {
  it('splits free vs accompanied totals for the pie chart', () => {
    const d: AppData = {
      ...data,
      slots: [
        slot({ id: 's1', offerId: 'o3', participantCount: 40 }), // Accueil Libre
        slot({ id: 's2', offerId: 'o1', mediatorIds: ['m1'], participantCount: 20 }),
        slot({ id: 's3', offerId: 'o2', participantCount: 10 }),
      ],
    };
    const stats = computeVisitStats(d, '2026-09-01', '2026-09-30');
    expect(stats.free.slotCount).toBe(1);
    expect(stats.free.totalParticipants).toBe(40);
    expect(stats.accompanied.slotCount).toBe(2);
    expect(stats.accompanied.totalParticipants).toBe(30);
  });

  it('builds daily cumulative participant series and per-day stacked breakdown by group nature', () => {
    const d: AppData = {
      ...data,
      slots: [
        slot({ id: 's1', offerId: 'o1', participantCount: 10, date: '2026-09-10', groupNature: 'SCOLAIRES C2' }),
        slot({ id: 's2', offerId: 'o1', participantCount: 5, date: '2026-09-10', groupNature: 'PSH' }),
        slot({ id: 's3', offerId: 'o3', participantCount: 20, date: '2026-09-11', groupNature: 'SCOLAIRES C2' }),
      ],
    };
    const stats = computeVisitStats(d, '2026-09-08', '2026-09-14');
    // cumulative series: 2026-09-08 -> 0, 09-09 -> 0, 09-10 -> 15, 09-11 -> 35, ... 09-14 -> 35
    const day10 = stats.cumulative.find(p => p.date === '2026-09-10')!;
    expect(day10.cumulative).toBe(15);
    const day11 = stats.cumulative.find(p => p.date === '2026-09-11')!;
    expect(day11.cumulative).toBe(35);
    expect(stats.cumulative).toHaveLength(7);
    // stacked breakdown by day
    const stack10 = stats.byNature.find(p => p.date === '2026-09-10')!;
    expect(stack10.parts.find(p => p.nature === 'SCOLAIRES C2')!.participants).toBe(10);
    expect(stack10.parts.find(p => p.nature === 'PSH')!.participants).toBe(5);
  });

  it('builds candle stats per group nature (sum per nature over period)', () => {
    const d: AppData = {
      ...data,
      slots: [
        slot({ id: 's1', participantCount: 10, groupNature: 'SCOLAIRES C2' }),
        slot({ id: 's2', participantCount: 30, groupNature: 'SCOLAIRES C2' }),
        slot({ id: 's3', participantCount: 20, groupNature: 'PSH' }),
        slot({ id: 's4', participantCount: 15, groupNature: '' }), // empty -> "Non renseigné"
      ],
    };
    const stats = computeVisitStats(d, '2026-09-01', '2026-09-30');
    const sc = stats.natureCandles.find(c => c.nature === 'SCOLAIRES C2')!;
    expect(sc.min).toBe(10);
    expect(sc.max).toBe(30);
    expect(sc.median).toBe(20);
    expect(sc.avg).toBe(20);
    // empty nature bucketed as "Non renseigné"
    const nr = stats.natureCandles.find(c => c.nature === 'Non renseigné')!;
    expect(nr.min).toBe(15);
  });

  it('totals participants per nature for the total-by-nature bar chart', () => {
    const d: AppData = {
      ...data,
      slots: [
        slot({ id: 's1', participantCount: 10, groupNature: 'SCOLAIRES C2' }),
        slot({ id: 's2', participantCount: 30, groupNature: 'SCOLAIRES C2' }),
        slot({ id: 's3', participantCount: 20, groupNature: 'PSH' }),
        slot({ id: 's4', participantCount: 15, groupNature: '' }),
      ],
    };
    const stats = computeVisitStats(d, '2026-09-01', '2026-09-30');
    expect(stats.natureTotals).toHaveLength(3);
    // sorted by total desc
    expect(stats.natureTotals[0]).toEqual({ nature: 'SCOLAIRES C2', totalParticipants: 40, slotCount: 2 });
    expect(stats.natureTotals.find(n => n.nature === 'PSH')!.totalParticipants).toBe(20);
    expect(stats.natureTotals.find(n => n.nature === 'Non renseigné')!.totalParticipants).toBe(15);
    expect(stats.natureTotals.find(n => n.nature === 'Non renseigné')!.slotCount).toBe(1);
  });

  it('uses weekly buckets when the period exceeds 3 months', () => {
    const d: AppData = {
      ...data,
      slots: [slot({ id: 's1', participantCount: 10, date: '2026-09-10' })],
    };
    const stats = computeVisitStats(d, '2026-06-01', '2026-12-31');
    // Long period -> weekly buckets, key = ISO week
    expect(stats.byNature[0].week).toBeDefined();
  });
});
