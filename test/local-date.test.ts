import { describe, it, expect } from 'vitest';
import { toLocalDateString, parseLocalDate } from '../src/domain/models';

describe('parseLocalDate', () => {
  it('round-trips through toLocalDateString without day shift', () => {
    const s = '2026-10-08';
    expect(toLocalDateString(parseLocalDate(s))).toBe(s);
  });

  it('parses as local midnight, not UTC', () => {
    // toISOString() of UTC-parsed '2026-10-08' shifts a day in UTC+2;
    // parseLocalDate must keep local day 8
    const d = parseLocalDate('2026-10-08');
    expect(d.getDate()).toBe(8);
    expect(d.getHours()).toBe(0);
  });

  it('round-trips a Monday for week-start computation', () => {
    const s = '2026-09-14'; // Monday
    const d = parseLocalDate(s);
    expect(d.getDay()).toBe(1);
  });
});

describe('toLocalDateString', () => {
  it('formats a local midnight date without UTC shift', () => {
    // Monday 2026-09-21 local midnight in any timezone stays 2026-09-21
    const d = new Date(2026, 8, 21, 0, 0, 0, 0);
    expect(toLocalDateString(d)).toBe('2026-09-21');
  });

  it('does not go back a day for positive UTC offsets (Toulouse UTC+2)', () => {
    // Local 2026-09-21 00:30 in UTC+2 = 2026-09-20 22:30 UTC
    // toISOString() would give '2026-09-20' — wrong
    const d = new Date(2026, 8, 21, 0, 30, 0, 0);
    expect(toLocalDateString(d)).toBe('2026-09-21');
  });

  it('formats midday dates correctly', () => {
    const d = new Date(2026, 8, 15, 12, 0, 0, 0);
    expect(toLocalDateString(d)).toBe('2026-09-15');
  });

  it('pads single-digit months and days', () => {
    const d = new Date(2026, 0, 5, 10, 0, 0, 0);
    expect(toLocalDateString(d)).toBe('2026-01-05');
  });

  it('handles end-of-month dates', () => {
    const d = new Date(2026, 8, 30, 23, 59, 0, 0);
    expect(toLocalDateString(d)).toBe('2026-09-30');
  });
});
