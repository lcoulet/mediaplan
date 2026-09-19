// store.ts — localStorage persistence

import { generateExportFilename, buildExportMetadata } from '../domain/export-utils';
import { defaultOfferColor } from '../domain/models';
import type { AppData, Offer } from '../domain/types';

const STORAGE_KEY = 'mediaplan_data_v1';
const LAST_MODIFIED_KEY = 'mediaplan_last_modified';

const defaultData: AppData = {
  mediators: [],
  offers: [],
  schedules: [],
  slots: [],
  absences: [],
};

export function load(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaultData };
    const parsed = JSON.parse(raw) as Partial<AppData>;
    // Migrate: assign a palette color to offers persisted before the color field existed
    const offers: Offer[] = (parsed.offers || []).map((o) =>
      o.color ? o : { ...o, color: defaultOfferColor() }
    );
    return {
      mediators: parsed.mediators || [],
      offers,
      schedules: parsed.schedules || [],
      slots: parsed.slots || [],
      absences: parsed.absences || [],
    };
  } catch (e) {
    console.error('Failed to load data:', e);
    return { ...defaultData };
  }
}

export function save(data: AppData): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    localStorage.setItem(LAST_MODIFIED_KEY, new Date().toISOString());
    return true;
  } catch (e) {
    console.error('Failed to save data:', e);
    return false;
  }
}

export function getLastModified(): string | null {
  return localStorage.getItem(LAST_MODIFIED_KEY);
}

async function gzipCompress(text: string): Promise<Blob> {
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
  return new Blob(chunks as BlobPart[]);
}

export async function exportJSON(): Promise<void> {
  const data = load();
  const lastModified = getLastModified();
  const meta = buildExportMetadata(lastModified);
  const payload = JSON.stringify({ ...meta, data }, null, 2);
  const filename = generateExportFilename(lastModified);
  const compressed = await gzipCompress(payload);
  const url = URL.createObjectURL(compressed);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function importJSON(file: File): Promise<AppData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        let text: string;
        // Detect gzip by file extension or magic bytes (0x1f 0x8b)
        const result = e.target?.result;
        const isGz = file.name.endsWith('.gz') ||
          (result instanceof Uint8Array &&
           result[0] === 0x1f && result[1] === 0x8b);
        if (isGz) {
          const stream = new DecompressionStream('gzip');
          const writer = stream.writable.getWriter();
          writer.write(new Uint8Array(result as ArrayBuffer));
          writer.close();
          const reader2 = stream.readable.getReader();
          const chunks: Uint8Array[] = [];
          while (true) {
            const { done, value } = await reader2.read();
            if (done) break;
            chunks.push(value);
          }
          text = new TextDecoder().decode(
            new Uint8Array(chunks.reduce((acc, c) => [...acc, ...c], [] as number[]))
          );
        } else {
          text = typeof result === 'string' ? result : new TextDecoder().decode(result as ArrayBuffer);
        }
        const parsed = JSON.parse(text) as AppData | { data: AppData };
        // Support both old format (raw data) and new format ({ metadata, data })
        const data = (parsed as { data?: AppData }).data || parsed as AppData;
        save(data);
        resolve(data);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    // Read as ArrayBuffer to support both gzip and plain JSON
    reader.readAsArrayBuffer(file);
  });
}
