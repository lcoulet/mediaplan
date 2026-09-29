// test/store-hours.test.ts — Hour quota + valorisation config persistence in
// the localStorage store. Follows the cycles persistence pattern
// (test/store-cycles.test.ts).
import { describe, it, expect, beforeEach } from 'vitest';
import type { AppData, QuarterlyQuota, ValorisationConfig } from '../src/domain/types';
import { defaultValorisationConfig } from '../src/domain/hours';

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

function buildData(
  quotas: QuarterlyQuota[],
  valorisation?: ValorisationConfig
): AppData {
  return {
    mediators: [],
    offers: [],
    schedules: [],
    slots: [],
    absences: [],
    cycles: [],
    quotas,
    ...(valorisation ? { valorisation } : {}),
  };
}

const quota: QuarterlyQuota = {
  id: 'quota_alice_2026_T1',
  mediatorId: 'med_alice',
  year: 2026,
  quarter: 1,
  hours: 120,
  effectiveFrom: '2026-01-01',
};

describe('store — quotas persistence', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips a quarterly quota: save, reload, identity', () => {
    expect(save(buildData([quota]))).toBe(true);
    const loaded = load();
    expect(loaded.quotas).toHaveLength(1);
    expect(loaded.quotas![0]).toEqual(quota);
  });

  it('keeps several quotas in order (one per quarter and mediator)', () => {
    const quotas: QuarterlyQuota[] = [
      { ...quota, quarter: 1 },
      { ...quota, id: 'q2', quarter: 2, hours: 100 },
      { ...quota, id: 'q3', mediatorId: 'med_bob', hours: 80 },
    ];
    save(buildData(quotas));
    const loaded = load();
    expect(loaded.quotas!.map((q) => q.id)).toEqual(['quota_alice_2026_T1', 'q2', 'q3']);
    expect(loaded.quotas![2].mediatorId).toBe('med_bob');
  });

  it('loads legacy data without quotas as an empty quota list (defaults migration)', () => {
    const legacy = {
      mediators: [{ id: 'med_1', lastName: 'Dupont' }],
      offers: [],
      schedules: [],
      slots: [],
      absences: [],
      cycles: [],
    };
    localStorage.setItem('mediaplan_data_v1', JSON.stringify(legacy));
    const data = load();
    expect(data.quotas).toEqual([]);
    expect(data.valorisation).toEqual(defaultValorisationConfig());
  });
});

describe('store — valorisation config persistence', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips a customized valorisation config', () => {
    const valorisation: ValorisationConfig = {
      ...defaultValorisationConfig(),
      sundayMultiplier: 2,
      valuedSaturdayThreshold: 5,
      valuedSaturdayMultiplier: 1.75,
      holidayOverrides: { '2026': ['2026-01-01', '2026-12-25'] },
    };
    expect(save(buildData([], valorisation))).toBe(true);
    const loaded = load();
    expect(loaded.valorisation).toEqual(valorisation);
  });

  it('fills in default multiplier values for a partially persisted config', () => {
    const partial = {
      sundayMultiplier: 2,
      // valuedSaturdayThreshold / valuedSaturdayMultiplier / holidayOverrides
      // persisted before those fields existed
    };
    localStorage.setItem('mediaplan_data_v1', JSON.stringify({ ...buildData([]), valorisation: partial }));
    const loaded = load();
    expect(loaded.valorisation?.sundayMultiplier).toBe(2);
    expect(loaded.valorisation?.valuedSaturdayThreshold).toBe(12);
    expect(loaded.valorisation?.valuedSaturdayMultiplier).toBe(1.5);
    expect(loaded.valorisation?.holidayOverrides).toEqual({});
  });
});
