// test/store-annual.test.ts — Annual view slice 2: persistence of the annual
// holiday dérogations (annualHolidayOverrides) in the localStorage store,
// with legacy-data migration. Follows the valorisation persistence pattern
// (test/store-hours.test.ts).
import { describe, it, expect, beforeEach } from 'vitest';
import type { AppData } from '../src/domain/types';
import type { AnnualHolidayOverrides } from '../src/domain/annual-view';

// Minimal localStorage mock (same pattern as test/store.test.ts)
class LocalStorageMock {
  data: Record<string, string> = {};
  getItem(key: string): string | null {
    return this.data[key] || null;
  }
  setItem(key: string, value: string): void {
    this.data[key] = String(value);
  }
  removeItem(key: string): void {
    delete this.data[key];
  }
  clear(): void {
    this.data = {};
  }
}

vi.stubGlobal('localStorage', new LocalStorageMock());

const { load, save } = await import('../src/infrastructure/store');

function buildData(annualHolidayOverrides?: AnnualHolidayOverrides): AppData {
  return {
    mediators: [],
    offers: [],
    schedules: [],
    slots: [],
    absences: [],
    cycles: [],
    quotas: [],
    spaces: [],
    ...(annualHolidayOverrides ? { annualHolidayOverrides } : {}),
  };
}

const overrides: AnnualHolidayOverrides = {
  '2026': { added: ['2026-08-10'], removed: ['2026-07-14'] },
  '2027': { added: ['2027-01-02'], removed: [] },
};

describe('store — annual holiday dérogations persistence', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips annualHolidayOverrides: save, reload, identity', () => {
    expect(save(buildData(overrides))).toBe(true);
    const loaded = load();
    expect(loaded.annualHolidayOverrides).toEqual(overrides);
  });

  it('round-trips an empty dérogations map', () => {
    expect(save(buildData({}))).toBe(true);
    const loaded = load();
    expect(loaded.annualHolidayOverrides).toEqual({});
  });

  it('loads legacy data without annualHolidayOverrides as an empty map (defaults migration)', () => {
    const legacy = {
      mediators: [{ id: 'med_1', lastName: 'Dupont' }],
      offers: [],
      schedules: [],
      slots: [],
      absences: [],
      cycles: [],
      quotas: [],
      spaces: [],
    };
    localStorage.setItem('mediaplan_data_v1', JSON.stringify(legacy));
    const data = load();
    // Pure defaults: every year keeps the auto-computed holiday list
    expect(data.annualHolidayOverrides).toEqual({});
  });

  it('sanitizes malformed persisted dérogations into the canonical shape', () => {
    // Partially persisted / hand-edited entries must not break the read:
    // missing `removed` arrays are filled in, non-array values dropped.
    const malformed = {
      ...buildData(),
      annualHolidayOverrides: {
        '2026': { added: ['2026-08-10'] },
        '2027': { removed: ['2027-07-14'] },
      },
    };
    localStorage.setItem('mediaplan_data_v1', JSON.stringify(malformed));
    const loaded = load();
    expect(loaded.annualHolidayOverrides).toEqual({
      '2026': { added: ['2026-08-10'], removed: [] },
      '2027': { added: [], removed: ['2027-07-14'] },
    });
  });

  it('drops a fully malformed dérogation entry (year with no arrays)', () => {
    const malformed = {
      ...buildData(),
      annualHolidayOverrides: {
        '2026': { added: ['2026-08-10'], removed: [] },
        'oops': 'not-a-map',
      },
    };
    localStorage.setItem('mediaplan_data_v1', JSON.stringify(malformed));
    const loaded = load();
    expect(loaded.annualHolidayOverrides).toEqual({
      '2026': { added: ['2026-08-10'], removed: [] },
    });
  });
});
