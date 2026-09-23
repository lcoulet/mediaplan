// Demo seed distribution: the planning must be mostly OK, span ~1 year ahead.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AppData } from '../src/domain/types';
import { seedDemoData } from '../src/presentation/DemoData';
import { getSlotPlanningStatus } from '../src/domain/models';

describe('demo seed distribution', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    });
  });

  it('seeds mostly-OK slots over a one-year-ahead span', () => {
    const data: AppData = { mediators: [], offers: [], schedules: [], slots: [], absences: [] };
    seedDemoData(data);
    const counts: Record<string, number> = { ok: 0, unassigned: 0, dispo_issue: 0, learning: 0, incompetent: 0 };
    for (const s of data.slots) counts[getSlotPlanningStatus(s, data)]++;
    const total = data.slots.length;

    // Span covers at least one year ahead of today
    const dates = data.slots.map((s) => s.date).sort();
    const inOneYear = new Date();
    inOneYear.setFullYear(inOneYear.getFullYear() + 1);
    expect(dates[dates.length - 1] >= inOneYear.toISOString().slice(0, 10)).toBe(true);

    // OK is the dominant status
    expect(counts.ok).toBeGreaterThan(counts.unassigned);
    expect(counts.ok).toBeGreaterThan(counts.dispo_issue);
    expect(counts.ok).toBeGreaterThan(counts.incompetent);

    // All states are exercised (the weekly view shows every color)
    expect(counts.unassigned).toBeGreaterThan(0);
    expect(counts.dispo_issue).toBeGreaterThan(0);
    expect(counts.learning).toBeGreaterThan(0);
    expect(counts.incompetent).toBeGreaterThan(0);

    // Reasonable volume: ~14 slots per weekday over ~15 months
    expect(total).toBeGreaterThan(3000);
    expect(data.absences.length).toBeGreaterThan(60);
  });
});
