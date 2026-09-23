// ui-settings.test.ts — UI preferences stored in localStorage, OUTSIDE AppData
// so they never leak into the JSON export/import.
import { describe, it, expect, beforeEach, vi } from 'vitest';

// The app data key contains the exportable AppData. UI settings must use a
// DIFFERENT key.
const APP_DATA_KEY = 'mediaplan_data_v1';
const UI_SETTINGS_KEY = 'mediaplan_ui_settings_v1';

const storage = new Map<string, string>();

describe('ui-settings (dynamic masking)', () => {
  beforeEach(() => {
    storage.clear();
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((k: string) => storage.get(k) ?? null),
      setItem: vi.fn((k: string, v: string) => storage.set(k, v)),
      removeItem: vi.fn((k: string) => storage.delete(k)),
      clear: vi.fn(() => storage.clear()),
    });
  });

  it('defaults to false when nothing is stored', async () => {
    const { getDynamicMasking } = await import('../src/infrastructure/ui-settings');
    expect(getDynamicMasking()).toBe(false);
  });

  it('persists the setting and reads it back', async () => {
    const { getDynamicMasking, setDynamicMasking } = await import('../src/infrastructure/ui-settings');
    setDynamicMasking(true);
    expect(getDynamicMasking()).toBe(true);
    setDynamicMasking(false);
    expect(getDynamicMasking()).toBe(false);
  });

  it('stores the setting under a dedicated key, never in the app data key', async () => {
    const { setDynamicMasking } = await import('../src/infrastructure/ui-settings');
    setDynamicMasking(true);
    expect(storage.has(UI_SETTINGS_KEY)).toBe(true);
    expect(storage.has(APP_DATA_KEY)).toBe(false);
    const parsed = JSON.parse(storage.get(UI_SETTINGS_KEY)!);
    expect(parsed.dynamicMasking).toBe(true);
  });

  it('falls back to false on corrupted stored JSON', async () => {
    storage.set(UI_SETTINGS_KEY, '{not json');
    const { getDynamicMasking } = await import('../src/infrastructure/ui-settings');
    expect(getDynamicMasking()).toBe(false);
  });
});
