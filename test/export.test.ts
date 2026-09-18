// test/export.test.ts — Tests for export filename and metadata
import { describe, it, expect } from 'vitest';
import { generateExportFilename, buildExportMetadata } from '../src/domain/export-utils';

describe('generateExportFilename', () => {
  it('should generate filename with date and time from lastModified timestamp', () => {
    // 2026-09-17T14:30:00.000Z
    const lastModified = '2026-09-17T14:30:00.000Z';
    const filename = generateExportFilename(lastModified);
    expect(filename).toBe('mediaplan_2026-09-17_1430.json.gz');
  });

  it('should use current time when lastModified is null', () => {
    const filename = generateExportFilename(null);
    // Should match pattern mediaplan_YYYY-MM-DD_HHMM.json.gz
    expect(filename).toMatch(/^mediaplan_\d{4}-\d{2}-\d{2}_\d{4}\.json\.gz$/);
  });

  it('should use current time when lastModified is undefined', () => {
    const filename = generateExportFilename(undefined);
    expect(filename).toMatch(/^mediaplan_\d{4}-\d{2}-\d{2}_\d{4}\.json\.gz$/);
  });

  it('should handle midnight correctly', () => {
    const lastModified = '2026-01-01T00:00:00.000Z';
    const filename = generateExportFilename(lastModified);
    expect(filename).toBe('mediaplan_2026-01-01_0000.json.gz');
  });

  it('should pad single digit hours and minutes', () => {
    const lastModified = '2026-03-05T09:05:00.000Z';
    const filename = generateExportFilename(lastModified);
    expect(filename).toBe('mediaplan_2026-03-05_0905.json.gz');
  });
});

describe('buildExportMetadata', () => {
  it('should return metadata object with lastModified and version', () => {
    const lastModified = '2026-09-17T14:30:00.000Z';
    const meta = buildExportMetadata(lastModified);
    expect(meta.lastModified).toBe('2026-09-17T14:30:00.000Z');
    expect(meta.exportedAt).toBeTruthy();
    expect(meta.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(meta.version).toBe(1);
  });

  it('should use current ISO timestamp when lastModified is null', () => {
    const meta = buildExportMetadata(null);
    expect(meta.lastModified).toBeTruthy();
    expect(meta.lastModified).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});
