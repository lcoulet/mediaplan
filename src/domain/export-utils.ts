// export-utils.ts — Pure functions for export filename and metadata
// No browser APIs — testable in Node

import type { ExportMetadata } from './types';

/**
 * Generate an export filename with date and time from lastModified timestamp.
 * Format: mediaplan_YYYY-MM-DD_HHMM.json.gz
 * @param lastModified - ISO 8601 timestamp of last data modification
 * @returns Filename for the export file
 */
export function generateExportFilename(lastModified?: string | null): string {
  const date = lastModified ? new Date(lastModified) : new Date();
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const min = String(date.getUTCMinutes()).padStart(2, '0');
  return `mediaplan_${yyyy}-${mm}-${dd}_${hh}${min}.json.gz`;
}

/**
 * Build metadata to embed in the export file.
 * @param lastModified - ISO 8601 timestamp of last data modification
 * @returns Metadata object with lastModified, exportedAt, and version
 */
export function buildExportMetadata(lastModified?: string | null): ExportMetadata {
  return {
    lastModified: lastModified || new Date().toISOString(),
    exportedAt: new Date().toISOString(),
    version: 1,
  };
}
