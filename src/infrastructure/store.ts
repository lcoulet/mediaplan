// store.ts — localStorage persistence

import { generateExportFilename, buildExportMetadata } from '../domain/export-utils';
import { defaultOfferColor } from '../domain/models';
import { defaultValorisationConfig } from '../domain/hours';
import { migrateLocationsToSpaces } from '../domain/spaces';
import type { AnnualHolidayOverrides } from '../domain/annual-view';
import type { AppData, Offer, Slot, ValorisationConfig, Space } from '../domain/types';

export const STORAGE_KEY = 'mediaplan_data_v1';
const LAST_MODIFIED_KEY = 'mediaplan_last_modified';

const defaultData: AppData = {
  mediators: [],
  offers: [],
  schedules: [],
  slots: [],
  absences: [],
  cycles: [],
  quotas: [],
  spaces: [],
};

export function load(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaultData };
    const parsed = JSON.parse(raw) as Partial<AppData>;
    // Migrate: assign a palette color to offers persisted before the color field existed,
    // and a default welcomeType to offers persisted before the field existed
    const offers: Offer[] = (parsed.offers || []).map((o) => ({
      ...o,
      ...(o.color ? {} : { color: defaultOfferColor() }),
      ...(o.welcomeType ? {} : { welcomeType: 'Réservable encadrée par médiateur' as const }),
    }));
    // Migrate: default the booking-detail fields on slots persisted before
    // the Secutix import fields existed (groupName, guide, location,
    // groupNature, contact*)
    const slots: Slot[] = (parsed.slots || []).map((s) => ({
      ...s,
      groupName: s.groupName || '',
      guide: s.guide || '',
      location: s.location || '',
      groupNature: s.groupNature || '',
      contactName: s.contactName || '',
      contactPhone: s.contactPhone || '',
      contactEmail: s.contactEmail || '',
    }));
    return {
      mediators: parsed.mediators || [],
      offers,
      schedules: parsed.schedules || [],
      slots,
      absences: parsed.absences || [],
      // Work cycles — legacy data persisted before the field existed
      // simply has none; an explicit empty list is the correct migration.
      cycles: parsed.cycles || [],
      // Quarterly hour quotas — same migration as cycles.
      quotas: parsed.quotas || [],
      // Spaces — legacy data persisted before the field existed has free
      // text locations only: each distinct non-empty location becomes a
      // space (default palette, never white). Already-migrated data is
      // idempotent: locations matching existing spaces reuse them.
      spaces: migrateSpaces(parsed.spaces || [], offers, slots),
      // Valorisation settings — legacy data loads with the defaults;
      // partially persisted configs are filled in with the defaults.
      valorisation: migrateValorisation(parsed.valorisation),
      // Annual view holiday dérogations — legacy data persisted before the
      // annual view existed loads as {} (pure defaults for every year);
      // partially persisted / malformed entries are sanitized.
      annualHolidayOverrides: migrateAnnualHolidayOverrides(
        (parsed as Partial<AppData>).annualHolidayOverrides
      ),
    };
  } catch (e) {
    console.error('Failed to load data:', e);
    return { ...defaultData };
  }
}

/**
 * Sanitize persisted annual holiday dérogations into the canonical shape
 * ({ [year]: { added: string[], removed: string[] } }): year entries missing
 * one of the arrays are filled in with [], entries that are not year maps
 * (wrong shape, corrupted data) are dropped. Pure function, idempotent.
 */
function migrateAnnualHolidayOverrides(
  raw: unknown
): AnnualHolidayOverrides {
  if (typeof raw !== 'object' || raw === null) return {};
  const result: AnnualHolidayOverrides = {};
  for (const [year, entry] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof entry !== 'object' || entry === null) continue; // malformed year
    const e = entry as { added?: unknown; removed?: unknown };
    const added = Array.isArray(e.added) ? e.added.filter((d): d is string => typeof d === 'string') : [];
    const removed = Array.isArray(e.removed) ? e.removed.filter((d): d is string => typeof d === 'string') : [];
    result[year] = { added, removed };
  }
  return result;
}

/**
 * Migrate free-text locations to spaces on load: every distinct
 * non-empty offer/slot location missing from the persisted spaces gets
 * one (palette color, never white). Pure; used by load() so legacy
 * data gains its spaces automatically and already-migrated data is
 * unchanged (migrateLocationsToSpaces is idempotent by name).
 */
function migrateSpaces(existing: Space[], offers: Offer[], slots: Slot[]): Space[] {
  return migrateLocationsToSpaces(offers, slots, existing).spaces;
}

/** Fill in default valorisation values for a partially persisted config. */
function migrateValorisation(
  valorisation: Partial<ValorisationConfig> | undefined
): ValorisationConfig {
  const defaults = defaultValorisationConfig();
  if (!valorisation) return defaults;
  return {
    sundayMultiplier: valorisation.sundayMultiplier ?? defaults.sundayMultiplier,
    valuedSaturdayThreshold:
      valorisation.valuedSaturdayThreshold ?? defaults.valuedSaturdayThreshold,
    valuedSaturdayMultiplier:
      valorisation.valuedSaturdayMultiplier ?? defaults.valuedSaturdayMultiplier,
    holidayOverrides: valorisation.holidayOverrides ?? defaults.holidayOverrides,
  };
}

export function save(data: AppData, lastModified?: string): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    localStorage.setItem(LAST_MODIFIED_KEY, lastModified ?? new Date().toISOString());
    return true;
  } catch (e) {
    console.error('Failed to save data:', e);
    return false;
  }
}

export function getLastModified(): string | null {
  return localStorage.getItem(LAST_MODIFIED_KEY);
}

/** Restore an explicit lastModified timestamp (undo/redo/history jumps and
 *  import baselines need the state's own timestamp, not the wall clock). */
export function setLastModified(iso: string): void {
  localStorage.setItem(LAST_MODIFIED_KEY, iso);
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

export interface ImportResult {
  data: AppData;
  /** Metadata embedded in the file; lastModified is undefined for legacy
   *  raw-data files (nothing to compare — no age warning per the spec). */
  metadata?: {
    lastModified?: string;
    exportedAt?: string;
    version?: number;
  };
}

export function importJSON(file: File): Promise<ImportResult> {
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
        const parsed = JSON.parse(text) as AppData | { data: AppData; lastModified?: string };
        // Support both old format (raw data) and new format ({ metadata, data })
        const wrapped = parsed as { data?: AppData; lastModified?: string };
        const data = wrapped.data || parsed as AppData;
        const metadata: ImportResult['metadata'] = wrapped.data
          ? {
              lastModified: typeof wrapped.lastModified === 'string' ? wrapped.lastModified : undefined,
              exportedAt: '',
              version: 1,
            }
          : undefined;
        // NO save() here: the import flow must run its confirmations before
        // anything is committed (a declined confirmation leaves nothing changed).
        resolve({ data, metadata });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    // Read as ArrayBuffer to support both gzip and plain JSON
    reader.readAsArrayBuffer(file);
  });
}
