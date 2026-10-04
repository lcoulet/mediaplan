// test/annual-ferie-panel.test.ts — Annual view slice 3: the férié panel's
// display list (default French holidays of the year + per-year dérogations,
// chip state). Spec: test/features/annual-view/annual-grid.feature
// (fériés scenarios + editing mockup's férié panel).
import { describe, it, expect } from 'vitest';
import { parseLocalDate } from '../src/domain/models';
import {
  annualHolidayPanelList,
  ANNUAL_FERIE_ADDED,
  ANNUAL_FERIE_REMOVED,
  ANNUAL_FERIE_DEFAULT,
  type AnnualHolidayOverrides,
} from '../src/domain/annual-view';

const overrides = (o: AnnualHolidayOverrides): AnnualHolidayOverrides => o;

describe('annualHolidayPanelList', () => {
  it('lists the default French holidays of the year, chronological, as DEFAULT chips', () => {
    const chips = annualHolidayPanelList(2026);
    expect(chips.length).toBe(11);
    expect(chips[0]).toEqual({
      date: '2026-01-01',
      name: "Jour de l'An",
      status: ANNUAL_FERIE_DEFAULT,
    });
    // Movable feasts computed from Easter 2026 (April 5)
    const byDate = Object.fromEntries(chips.map((c) => [c.date, c]));
    expect(byDate['2026-04-06'].name).toBe('Lundi de Pâques');
    expect(byDate['2026-05-14'].name).toBe('Ascension');
    expect(byDate['2026-05-25'].name).toBe('Lundi de Pentecôte');
    expect(byDate['2026-07-14'].status).toBe(ANNUAL_FERIE_DEFAULT);
    expect(byDate['2026-12-25'].name).toBe('25 Décembre');
  });

  it('marks a REMOVED default holiday as removed (strike-through chip)', () => {
    const chips = annualHolidayPanelList(2026, overrides({
      2026: { added: [], removed: ['2026-07-14'] },
    }));
    const byDate = Object.fromEntries(chips.map((c) => [c.date, c]));
    expect(byDate['2026-07-14'].status).toBe(ANNUAL_FERIE_REMOVED);
    // Other defaults unchanged
    expect(byDate['2026-08-15'].status).toBe(ANNUAL_FERIE_DEFAULT);
  });

  it('appends ADDED dérogation dates as ADDED chips at the end', () => {
    const chips = annualHolidayPanelList(2026, overrides({
      2026: { added: ['2026-08-10'], removed: [] },
    }));
    const added = chips.filter((c) => c.status === ANNUAL_FERIE_ADDED);
    expect(added.length).toBe(1);
    expect(added[0].date).toBe('2026-08-10');
    // No French name for a dérogation: the chip shows the raw date label
    expect(added[0].name).toBe('');
    // ADDED chips sort last, chronologically among themselves
    expect(chips[chips.length - 1].date).toBe('2026-08-10');
  });

  it('keeps added and removed lists per year (2027 untouched by 2026 deltas)', () => {
    const chips2027 = annualHolidayPanelList(2027, overrides({
      2026: { added: ['2026-08-10'], removed: ['2026-07-14'] },
    }));
    // 2027 follows its own defaults: no strike, no added chip
    expect(chips2027.every((c) => c.status === ANNUAL_FERIE_DEFAULT)).toBe(true);
    expect(chips2027.length).toBe(11);
  });

  it('dates outside the requested year are ignored', () => {
    const chips = annualHolidayPanelList(2026, overrides({
      2026: { added: ['2025-08-10', '2027-01-01'], removed: ['2027-07-14'] },
    }));
    expect(chips.some((c) => c.date === '2025-08-10')).toBe(false);
    expect(chips.some((c) => c.date === '2027-01-01')).toBe(false);
  });

  it('is a pure function: the overrides input is never mutated', () => {
    const o: AnnualHolidayOverrides = { 2026: { added: [], removed: [] } };
    annualHolidayPanelList(2026, o);
    expect(o).toEqual({ 2026: { added: [], removed: [] } });
  });

  it('panel labels parse back to local dates without timezone drift', () => {
    const chips = annualHolidayPanelList(2026);
    for (const chip of chips) {
      expect(parseLocalDate(chip.date).getFullYear()).toBe(2026);
    }
  });
});
