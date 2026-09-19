// test/store.test.ts — Tests for localStorage store
import { describe, it, expect, beforeEach } from 'vitest';
import type { AppData } from '../src/domain/types';

// Minimal localStorage mock
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

describe('store.load', () => {
  beforeEach(() => localStorage.clear());

  it('should return empty data structure when nothing stored', () => {
    const data = load();
    expect(data).toEqual({
      mediators: [],
      offers: [],
      schedules: [],
      slots: [],
      absences: [],
    });
  });

  it('should load data from localStorage', () => {
    const stored = {
      mediators: [{ id: 'med_1', lastName: 'Dupont' }],
      offers: [{ id: 'off_1', name: 'Visite' }],
      schedules: [],
      slots: [{ id: 'slot_1', offerId: 'off_1' }],
    };
    localStorage.setItem('mediaplan_data_v1', JSON.stringify(stored));

    const data = load();
    expect(data.mediators.length).toBe(1);
    expect(data.mediators[0].lastName).toBe('Dupont');
    expect(data.offers.length).toBe(1);
    expect(data.slots.length).toBe(1);
  });

  it('should return empty data on corrupt JSON', () => {
    localStorage.setItem('mediaplan_data_v1', 'not valid json{{{');
    const data = load();
    expect(data.mediators).toEqual([]);
    expect(data.offers).toEqual([]);
  });
});

describe('store.save', () => {
  beforeEach(() => localStorage.clear());

  it('should persist data to localStorage', () => {
    const data: AppData = {
      mediators: [{ id: 'med_1', lastName: 'Dupont', firstName: '', email: '', phone: '', competences: [], active: true, color: '#fff', notes: '' }],
      offers: [],
      schedules: [],
      slots: [],
      absences: [],
    };
    const result = save(data);
    expect(result).toBe(true);
    const raw = localStorage.getItem('mediaplan_data_v1');
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed.mediators.length).toBe(1);
  });
});
