// test/offer-color.test.ts — Tests for offer color: factory, persistence
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createOffer } from '../src/domain/models';

// Minimal localStorage mock (jsdom doesn't provide localStorage)
class LocalStorageMock {
  data: Record<string, string> = {};
  getItem(key: string): string | null { return this.data[key] || null; }
  setItem(key: string, value: string): void { this.data[key] = String(value); }
  removeItem(key: string): void { delete this.data[key]; }
  clear(): void { this.data = {}; }
}
vi.stubGlobal('localStorage', new LocalStorageMock());

describe('createOffer — color field', () => {
  it('should assign a default color', () => {
    const o = createOffer();
    expect(typeof o.color).toBe('string');
    expect(o.color!.length).toBeGreaterThan(0);
    expect(o.color!.startsWith('#')).toBe(true);
  });

  it('should preserve a provided color', () => {
    const o = createOffer({ color: '#ff5733' });
    expect(o.color).toBe('#ff5733');
  });

  it('should assign hex colors from the palette', () => {
    const a = createOffer();
    const b = createOffer();
    expect(a.color).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(b.color).toMatch(/^#[0-9a-fA-F]{6}$/);
  });
});

// ---- Persistence (localStorage) ----

describe('store — offer color persistence', () => {
  beforeEach(() => localStorage.clear());

  it('should roundtrip offer color through save/load', async () => {
    const { save, load } = await import('../src/infrastructure/store');
    const data = {
      mediators: [],
      offers: [createOffer({ id: 'off_1', name: 'Visite', color: '#ff5733' })],
      schedules: [],
      slots: [],
      absences: [],
    };
    expect(save(data)).toBe(true);
    const loaded = load();
    expect(loaded.offers.length).toBe(1);
    expect(loaded.offers[0].color).toBe('#ff5733');
  });

  it('should assign a default color to stored offers missing one (migration)', async () => {
    const { load } = await import('../src/infrastructure/store');
    const stored = {
      mediators: [],
      offers: [{ id: 'off_old', name: 'Ancienne offre', duration: 60, capacity: 10 }],
      schedules: [],
      slots: [],
      absences: [],
    };
    localStorage.setItem('mediaplan_data_v1', JSON.stringify(stored));
    const loaded = load();
    expect(loaded.offers.length).toBe(1);
    expect(loaded.offers[0].color).toMatch(/^#[0-9a-fA-F]{6}$/);
  });
});
