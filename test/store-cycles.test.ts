// test/store-cycles.test.ts — Work cycle persistence in the localStorage store
import { describe, it, expect, beforeEach } from 'vitest';
import type { AppData, WorkCycle } from '../src/domain/types';
import { createDefaultCycle, validateCycle } from '../src/domain/cycles';

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

function buildData(cycles: WorkCycle[]): AppData {
  return {
    mediators: [
      {
        id: 'med_alice',
        lastName: 'Alice',
        firstName: '',
        email: '',
        phone: '',
        competences: [],
        active: true,
        color: '#fff',
        notes: '',
        activeCycleId: 'cyc_alice',
      },
    ],
    offers: [],
    schedules: [],
    slots: [],
    absences: [],
    cycles,
    quotas: [],
    spaces: [],
  };
}

describe('store — cycles persistence', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips a cycle: save, reload, validate identity', () => {
    const cycle = createDefaultCycle('med_alice', '2026-W40');
    cycle.id = 'cyc_alice';
    cycle.weeks[0].days[5] = { day: 6, startTime: '10:00', endTime: '17:00' };
    cycle.forcedWeeks['2026-W42'] = 'S1';

    expect(save(buildData([cycle]))).toBe(true);
    const loaded = load();

    expect(loaded.cycles).toHaveLength(1);
    const loadedCycle = loaded.cycles![0];
    expect(loadedCycle).toEqual(cycle); // identity: full deep equality
    expect(loadedCycle.id).toBe('cyc_alice');
    expect(loadedCycle.mediatorId).toBe('med_alice');
    expect(loadedCycle.anchorIsoWeek).toBe('2026-W40');
    expect(loadedCycle.forcedWeeks).toEqual({ '2026-W42': 'S1' });
    expect(validateCycle(loadedCycle).ok).toBe(true);
    // The mediator's reference survives the round-trip
    expect(loaded.mediators[0].activeCycleId).toBe('cyc_alice');
  });

  it('loads multiple cycles and keeps their order', () => {
    const c1 = createDefaultCycle('med_alice', '2026-W40');
    c1.id = 'cyc_alice';
    const c2 = createDefaultCycle('med_bob', '2026-W41');
    c2.id = 'cyc_bob';

    save(buildData([c1, c2]));
    const loaded = load();
    expect(loaded.cycles!.map((c) => c.id)).toEqual(['cyc_alice', 'cyc_bob']);
  });

  it('loads legacy data without cycles as an empty cycle list', () => {
    // Data as persisted before the cycles feature existed
    const legacy = {
      mediators: [{ id: 'med_1', lastName: 'Dupont' }],
      offers: [{ id: 'off_1', name: 'Visite' }],
      schedules: [],
      slots: [],
      absences: [],
    };
    localStorage.setItem('mediaplan_data_v1', JSON.stringify(legacy));

    const data = load();
    expect(data.mediators[0].lastName).toBe('Dupont');
    expect(data.mediators[0].activeCycleId).toBeUndefined();
    expect(data.cycles).toEqual([]);
  });
});
