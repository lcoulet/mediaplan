// export-utils.js — Pure functions for export filename and metadata
// No browser APIs — testable in Node

/**
 * Generate an export filename with date and time from lastModified timestamp.
 * Format: mediaplan_YYYY-MM-DD_HHMM.json.gz
 * @param {string|null|undefined} lastModified - ISO 8601 timestamp of last data modification
 * @returns {string} Filename for the export file
 */
export function generateExportFilename(lastModified) {
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
 * @param {string|null|undefined} lastModified - ISO 8601 timestamp of last data modification
 * @returns {{ lastModified: string, exportedAt: string, version: number }}
 */
export function buildExportMetadata(lastModified) {
    return {
        lastModified: lastModified || new Date().toISOString(),
        exportedAt: new Date().toISOString(),
        version: 1,
    };
}
