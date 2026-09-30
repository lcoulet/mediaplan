// test/store-spaces.test.ts — Space persistence in the localStorage store
import { describe, it, expect, beforeEach } from 'vitest';
import type { AppData, Offer, Slot } from '../src/domain/types';
import { createSpace, migrateLocationsToSpaces } from '../src/domain/spaces';

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

function data(spaces: AppData['spaces']): AppData {
  return {
    mediators: [],
    offers: [],
    schedules: [],
    slots: [],
    absences: [],
    cycles: [],
    quotas: [],
    spaces,
  };
}

describe('store — spaces persistence', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips a space: save, reload, identity preserved', () => {
    const spaces = [
      createSpace('Salle Bronze', '#4A90D9'),
      createSpace('Auditorium', '#7B1FA2'),
    ];
    expect(save(data(spaces))).toBe(true);
    const loaded = load();
    expect(loaded.spaces).toEqual(spaces);
  });

  it('loads legacy data without spaces as spaces migrated from locations', () => {
    // Data as persisted before the spaces feature existed: free-text
    // locations on offers and slots
    const legacy = {
      mediators: [],
      offers: [{ id: 'off_1', name: 'Visite guidée', location: 'Salle Bronze' } as Offer],
      schedules: [],
      slots: [{ id: 'slot_1', offerId: 'off_1', location: 'Auditorium' } as Slot],
      absences: [],
    };
    localStorage.setItem('mediaplan_data_v1', JSON.stringify(legacy));

    const loaded = load();
    // One space per distinct non-empty location across offers+slots
    expect(loaded.spaces.map((s) => s.name).sort()).toEqual(['Auditorium', 'Salle Bronze']);
    // Migration colors come from the default palette — never white
    expect(loaded.spaces.every((s) => s.color.toUpperCase() !== '#FFFFFF')).toBe(true);
  });

  it('keeps already-migrated spaces on load (migration is idempotent)', () => {
    const spaces = [createSpace('Salle Bronze', '#4A90D9')];
    const migrated = migrateLocationsToSpaces(
      [{ id: 'off_1', name: 'Visite', location: 'Salle Bronze' } as Offer],
      []
    );
    expect(migrated.spaces).toHaveLength(1);
    save(data(spaces));
    const loaded = load();
    expect(loaded.spaces).toEqual(spaces);
  });

  it('keeps persisted spaces untouched when locations already match them', () => {
    // spaces exist AND match the locations: no duplicate, same list back
    const spaces = [createSpace('Salle Bronze', '#4A90D9')];
    const stored = {
      ...data(spaces),
      offers: [{ id: 'off_1', name: 'Visite guidée', location: 'Salle Bronze' } as Offer],
    };
    save(stored);
    const loaded = load();
    expect(loaded.spaces).toEqual(spaces);
    expect(loaded.offers[0].location).toBe('Salle Bronze');
  });

  it('preserves spaces through clearPlanningData like cycles and quotas', async () => {
    const { clearPlanningData } = await import('../src/domain/clear-data');
    const spaces = [createSpace('Salle Bronze', '#4A90D9')];
    const stored = data(spaces);
    const cleared = clearPlanningData(stored);
    expect(cleared.spaces).toEqual(spaces);
  });
});
