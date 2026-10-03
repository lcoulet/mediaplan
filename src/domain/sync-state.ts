// sync-state.ts — Export/import synchronization stamps (domain)
// Spec: test/features/import-export/header-import-export.feature
// - lastExportedAt: when the data was last exported (replaced on a successful
//   import, which IS the new reference state)
// - lastImportedAt: when a file was last imported
// Both live in a DEDICATED localStorage key — never inside AppData — so the
// export/import of AppData never carries synchronization stamps (a file's
// own embedded metadata is the only baseline).

export const SYNC_STAMPS_KEY = 'mediaplan_sync_stamps_v1';

export interface SyncStamps {
  /** ISO 8601 — last successful export (or embedded lastModified after an import) */
  lastExportedAt?: string;
  /** ISO 8601 — last successful import */
  lastImportedAt?: string;
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function getStorage(): StorageLike {
  if (typeof localStorage === 'undefined') {
    throw new Error('localStorage is not available');
  }
  return localStorage;
}

/** Load the persisted sync stamps; empty (never exported/imported) on absence or corruption. */
export function loadStamps(): SyncStamps {
  try {
    const raw = getStorage().getItem(SYNC_STAMPS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<SyncStamps>;
    const stamps: SyncStamps = {};
    if (typeof parsed.lastExportedAt === 'string') stamps.lastExportedAt = parsed.lastExportedAt;
    if (typeof parsed.lastImportedAt === 'string') stamps.lastImportedAt = parsed.lastImportedAt;
    return stamps;
  } catch {
    return {};
  }
}

/** Persist the sync stamps under the dedicated localStorage key. */
export function saveStamps(stamps: SyncStamps): void {
  getStorage().setItem(SYNC_STAMPS_KEY, JSON.stringify(stamps));
}

function toTime(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return isNaN(t) ? null : t;
}

/**
 * Whether unexported modifications exist: data.lastModified strictly greater
 * than lastExportedAt. True when data exists but was never exported;
 * false when either timestamp is missing or unparseable (nothing to compare).
 */
export function isExportPending(
  dataLastModified: string | null | undefined,
  stamps: SyncStamps
): boolean {
  const dataTime = toTime(dataLastModified);
  if (dataTime === null) return false;
  if (!stamps.lastExportedAt) return true; // never exported
  const exportedTime = toTime(stamps.lastExportedAt);
  if (exportedTime === null) return false; // corrupt stamp: cannot prove data is newer
  return dataTime > exportedTime;
}

/**
 * Baseline after a successful import: the imported file IS the new reference
 * state — lastExportedAt takes the file's embedded lastModified (so the badge
 * clears), lastImportedAt takes the import instant. A legacy file without
 * embedded lastModified falls back to the import instant.
 */
export function resolveImportBaseline(
  fileMeta: { lastModified?: string | null },
  now: string
): SyncStamps {
  return {
    lastExportedAt: fileMeta.lastModified || now,
    lastImportedAt: now,
  };
}

/**
 * Compare the embedded lastModified of an import file against the local data.
 * 'older' only when the file is strictly older; 'unknown' when either side
 * is missing or unparseable (legacy file / fresh install — nothing to compare,
 * no age warning per the spec).
 */
export function compareFileAge(
  fileLastModified: string | undefined,
  dataLastModified: string | undefined
): 'older' | 'newer-or-equal' | 'unknown' {
  const fileTime = toTime(fileLastModified);
  const dataTime = toTime(dataLastModified);
  if (fileTime === null || dataTime === null) return 'unknown';
  return fileTime < dataTime ? 'older' : 'newer-or-equal';
}
