// store-metadata.test.ts — Import must expose the file's embedded metadata
// (and NOT persist anything: confirmations must precede the commit).
// Uses a REAL gzip round-trip (Node 18+ has CompressionStream/DecompressionStream)
// plus the localStorage/File/FileReader mock patterns from test/store.test.ts.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { AppData } from '../src/domain/types';

// ---- localStorage mock (pattern from test/store.test.ts) ----
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

// ---- File mock carrying a known ArrayBuffer (jsdom's File lacks
//      arrayBuffer(), so the FileReader mock returns the bytes directly) ----
class MockFile {
  name: string;
  bytes: ArrayBuffer;
  constructor(parts: ArrayBuffer[], name: string) {
    this.name = name;
    const total = parts.reduce((n, p) => n + p.byteLength, 0);
    this.bytes = new ArrayBuffer(total);
    const view = new Uint8Array(this.bytes);
    let off = 0;
    for (const p of parts) {
      view.set(new Uint8Array(p), off);
      off += p.byteLength;
    }
  }
}
vi.stubGlobal('File', MockFile as any);

// ---- FileReader mock: returns the MockFile's bytes ----
class FileReaderMock {
  onload: ((e: { target: { result: ArrayBuffer } }) => void) | null = null;
  onerror: (() => void) | null = null;
  readAsArrayBuffer(file: MockFile): void {
    // Defer so callers can attach onload after calling read
    setTimeout(() => {
      this.onload?.({ target: { result: file.bytes } });
    }, 0);
  }
}
vi.stubGlobal('FileReader', FileReaderMock as any);

const { save, setLastModified, getLastModified, load, importJSON } = await import(
  '../src/infrastructure/store'
);

const emptyData: AppData = {
  mediators: [], offers: [], schedules: [], slots: [],
  absences: [], cycles: [], quotas: [], spaces: [],
};

const storedData: AppData = {
  ...emptyData,
  mediators: [{ id: 'm1', lastName: 'Dupont' } as any],
};

/** gzip-deflate a string into an ArrayBuffer using the real CompressionStream. */
async function gzip(text: string): Promise<ArrayBuffer> {
  const stream = new CompressionStream('gzip');
  const writer = stream.writable.getWriter();
  writer.write(new TextEncoder().encode(text));
  writer.close();
  const reader = stream.readable.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new ArrayBuffer(total);
  const view = new Uint8Array(out);
  let off = 0;
  for (const c of chunks) { view.set(c, off); off += c.length; }
  return out;
}

async function gzipFile(json: object, name = 'export.json.gz'): Promise<File> {
  const bytes = await gzip(JSON.stringify(json));
  return new MockFile([bytes], name) as unknown as File;
}

beforeEach(() => {
  localStorage.clear();
});

describe('setLastModified', () => {
  it('writes the given ISO timestamp to the last-modified key', () => {
    setLastModified('2026-10-03T12:00:00.000Z');
    expect(getLastModified()).toBe('2026-10-03T12:00:00.000Z');
  });

  it('save() without an explicit timestamp keeps the wall-clock behavior', () => {
    save(storedData);
    expect(getLastModified()).toBeTruthy();
  });

  it('save() with an explicit timestamp restores that exact timestamp (undo/redo contract)', () => {
    save(storedData, '2026-10-03T13:55:00.000Z');
    expect(getLastModified()).toBe('2026-10-03T13:55:00.000Z');
  });
});

describe('importJSON result', () => {
  it('resolves { data, metadata } with the file’s embedded lastModified', async () => {
    const file = await gzipFile({
      lastModified: '2026-10-02T10:00:00.000Z',
      exportedAt: '2026-10-02T10:05:00.000Z',
      version: 1,
      data: storedData,
    });
    const result = await importJSON(file);
    expect(result.data.mediators).toHaveLength(1);
    expect(result.metadata?.lastModified).toBe('2026-10-02T10:00:00.000Z');
  });

  it('does NOT save to localStorage — confirmations must precede any write', async () => {
    const file = await gzipFile({
      lastModified: '2026-10-02T10:00:00.000Z',
      exportedAt: '2026-10-02T10:05:00.000Z',
      version: 1,
      data: storedData,
    });
    await importJSON(file);
    expect(localStorage.getItem('mediaplan_data_v1')).toBeNull();
    expect(getLastModified()).toBeNull();
  });

  it('reports metadata.lastModified undefined for a legacy raw-data file', async () => {
    const file = await gzipFile(storedData, 'legacy.json.gz');
    const result = await importJSON(file);
    expect(result.data.mediators).toHaveLength(1);
    expect(result.metadata?.lastModified).toBeUndefined();
  });

  it('reads plain (non-gzipped) .json files', async () => {
    const json = JSON.stringify({
      lastModified: '2026-10-01T09:00:00.000Z',
      data: storedData,
    });
    const bytes = new TextEncoder().encode(json).buffer as ArrayBuffer;
    const file = new MockFile([bytes], 'export.json') as unknown as File;
    const result = await importJSON(file);
    expect(result.data.mediators).toHaveLength(1);
    expect(result.metadata?.lastModified).toBe('2026-10-01T09:00:00.000Z');
  });

  it('rejects on a corrupt file and changes nothing', async () => {
    const bytes = await gzip('{{{ not json');
    const file = new MockFile([bytes], 'corrupt.json.gz') as unknown as File;
    await expect(importJSON(file)).rejects.toBeTruthy();
    expect(localStorage.getItem('mediaplan_data_v1')).toBeNull();
    expect(getLastModified()).toBeNull();
  });
});

describe('load still applies migrations after an explicit-timestamp save', () => {
  it('round-trips data saved with an explicit timestamp', () => {
    save(storedData, '2026-10-03T13:55:00.000Z');
    const loaded = load();
    expect(loaded.mediators).toHaveLength(1);
    expect(getLastModified()).toBe('2026-10-03T13:55:00.000Z');
  });
});
