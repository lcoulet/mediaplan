// history-timestamp.test.tsx — Undo/redo restore the lastModified stamp of
// the restored state (spec: undoing to a pre-export state clears the export
// badge; redoing back to a post-export edit restores it).
// Also covers the import flow contract: commit() must persist the file's
// embedded lastModified, not the import wall-clock instant.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { DataProvider, useData, COMMIT_LABELS } from '../src/presentation/DataContext';
import { getLastModified, STORAGE_KEY } from '../src/infrastructure/store';
import type { AppData } from '../src/domain/types';

const mockData: AppData = {
  mediators: [], offers: [], schedules: [], slots: [],
  absences: [], cycles: [], quotas: [], spaces: [],
};

const importData: AppData = {
  ...mockData,
  mediators: [{ id: 'imported' } as any],
};

// localStorage mock that ACTUALLY stores (so getLastModified works)
class LocalStorageMock {
  data: Record<string, string> = {};
  getItem(key: string): string | null { return this.data[key] || null; }
  setItem(key: string, value: string): void { this.data[key] = String(value); }
  removeItem(key: string): void { delete this.data[key]; }
  clear(): void { this.data = {}; }
}
const storage = new LocalStorageMock();
vi.stubGlobal('localStorage', storage);

function Probe() {
  const { commit, undo, redo } = useData();
  return (
    <div>
      <button
        data-testid="btn-import"
        onClick={() => commit(importData, COMMIT_LABELS.jsonImport, '2026-10-02T10:00:00.000Z')}
      >
        import
      </button>
      <button data-testid="btn-undo" onClick={undo}>undo</button>
      <button data-testid="btn-redo" onClick={redo}>redo</button>
    </div>
  );
}

function renderApp() {
  return render(
    <DataProvider>
      <Probe />
    </DataProvider>
  );
}

describe('lastModified restoration on undo/redo', () => {
  beforeEach(() => {
    storage.clear();
    storage.setItem(STORAGE_KEY, JSON.stringify(mockData));
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('commit() with an explicit lastModified persists that timestamp', () => {
    renderApp();
    act(() => { screen.getByTestId('btn-import').click(); });
    expect(getLastModified()).toBe('2026-10-02T10:00:00.000Z');
  });

  it('undo() restores the previous state’s own timestamp', () => {
    renderApp();
    act(() => { screen.getByTestId('btn-import').click(); });
    expect(getLastModified()).toBe('2026-10-02T10:00:00.000Z');
    act(() => { screen.getByTestId('btn-undo').click(); });
    // The restored state is the mount-time snapshot; its own stamp is whatever
    // the wall-clock save captured (init entries carry no explicit stamp,
    // so the restored stamp equals the CURRENT stamp of the previous entry).
    const after = getLastModified();
    expect(after).toBeTruthy();
    expect(after).not.toBe('2026-10-02T10:00:00.000Z');
  });

  it('redo() restores the redone state’s timestamp', () => {
    renderApp();
    act(() => { screen.getByTestId('btn-import').click(); });
    act(() => { screen.getByTestId('btn-undo').click(); });
    act(() => { screen.getByTestId('btn-redo').click(); });
    expect(getLastModified()).toBe('2026-10-02T10:00:00.000Z');
  });
});
