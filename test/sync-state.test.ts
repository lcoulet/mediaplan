// sync-state.test.ts — Export/import synchronization stamps (domain)
// Spec: test/features/import-export/header-import-export.feature
import { describe, it, expect, beforeEach, vi } from 'vitest';

// localStorage mock (same pattern as test/store.test.ts)
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

const {
  SYNC_STAMPS_KEY,
  loadStamps,
  saveStamps,
  isExportPending,
  resolveImportBaseline,
  compareFileAge,
} = await import('../src/domain/sync-state');

beforeEach(() => localStorage.clear());

describe('loadStamps / saveStamps', () => {
  it('returns empty stamps when nothing is stored', () => {
    expect(loadStamps()).toEqual({});
  });

  it('persists and reloads stamps under the dedicated localStorage key', () => {
    saveStamps({ lastExportedAt: '2026-10-03T14:00:00.000Z' });
    expect(localStorage.getItem(SYNC_STAMPS_KEY)).toBeTruthy();
    expect(loadStamps()).toEqual({ lastExportedAt: '2026-10-03T14:00:00.000Z' });
  });

  it('returns empty stamps on corrupt JSON instead of throwing', () => {
    localStorage.setItem(SYNC_STAMPS_KEY, 'not valid json{{{');
    expect(loadStamps()).toEqual({});
  });

  it('stores stamps OUTSIDE the AppData key — export/import of AppData never carries stamps', () => {
    saveStamps({ lastExportedAt: '2026-10-03T14:00:00.000Z', lastImportedAt: '2026-10-03T15:00:00.000Z' });
    // Only the dedicated stamps key was written
    expect(Object.keys(localStorage.data)).toEqual([SYNC_STAMPS_KEY]);
  });
});

describe('isExportPending', () => {
  it('is pending when data was modified after the last export', () => {
    expect(isExportPending('2026-10-03T14:30:00Z', { lastExportedAt: '2026-10-03T14:00:00Z' })).toBe(true);
  });

  it('is NOT pending when lastModified equals lastExportedAt (strictly greater rule)', () => {
    expect(isExportPending('2026-10-03T14:00:00Z', { lastExportedAt: '2026-10-03T14:00:00Z' })).toBe(false);
  });

  it('is NOT pending when lastModified is older than the last export', () => {
    expect(isExportPending('2026-10-03T13:55:00Z', { lastExportedAt: '2026-10-03T14:00:00Z' })).toBe(false);
  });

  it('is pending when never exported (no lastExportedAt) but data exists', () => {
    expect(isExportPending('2026-10-03T13:55:00Z', {})).toBe(true);
  });

  it('is NOT pending when there is no data lastModified at all', () => {
    expect(isExportPending(null, {})).toBe(false);
    expect(isExportPending(undefined, { lastExportedAt: '2026-10-03T14:00:00Z' })).toBe(false);
  });

  it('is NOT pending when either timestamp is unparseable', () => {
    expect(isExportPending('garbage', {})).toBe(false);
    expect(isExportPending('2026-10-03T14:30:00Z', { lastExportedAt: 'garbage' })).toBe(false);
  });
});

describe('resolveImportBaseline', () => {
  it('sets lastExportedAt to the file’s embedded lastModified and lastImportedAt to now', () => {
    const stamps = resolveImportBaseline(
      { lastModified: '2026-10-03T12:00:00Z' },
      '2026-10-03T16:00:00Z'
    );
    expect(stamps).toEqual({
      lastExportedAt: '2026-10-03T12:00:00Z',
      lastImportedAt: '2026-10-03T16:00:00Z',
    });
  });

  it('falls back to now for a legacy file without embedded lastModified', () => {
    const stamps = resolveImportBaseline({}, '2026-10-03T16:00:00Z');
    expect(stamps).toEqual({
      lastExportedAt: '2026-10-03T16:00:00Z',
      lastImportedAt: '2026-10-03T16:00:00Z',
    });
  });

  it('treats a null embedded lastModified as legacy', () => {
    const stamps = resolveImportBaseline({ lastModified: null }, '2026-10-03T16:00:00Z');
    expect(stamps.lastExportedAt).toBe('2026-10-03T16:00:00Z');
  });
});

describe('compareFileAge', () => {
  it('returns older when the file lastModified strictly precedes the local one', () => {
    expect(
      compareFileAge('2026-10-02T10:00:00Z', '2026-10-03T15:45:00Z')
    ).toBe('older');
  });

  it('returns newer-or-equal when timestamps are identical', () => {
    expect(
      compareFileAge('2026-10-03T15:45:00Z', '2026-10-03T15:45:00Z')
    ).toBe('newer-or-equal');
  });

  it('returns newer-or-equal when the file is more recent', () => {
    expect(
      compareFileAge('2026-10-03T15:45:00Z', '2026-10-02T10:00:00Z')
    ).toBe('newer-or-equal');
  });

  it('returns unknown when the file has no embedded lastModified (legacy)', () => {
    expect(compareFileAge(undefined, '2026-10-03T15:45:00Z')).toBe('unknown');
  });

  it('returns unknown when the local data has no lastModified', () => {
    expect(compareFileAge('2026-10-02T10:00:00Z', undefined)).toBe('unknown');
  });

  it('returns unknown when either timestamp is unparseable', () => {
    expect(compareFileAge('garbage', '2026-10-03T15:45:00Z')).toBe('unknown');
  });
});
