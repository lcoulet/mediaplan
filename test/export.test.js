// test/export.test.js — Tests for export filename and metadata
// TDD: RED first, then GREEN

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const { generateExportFilename, buildExportMetadata } = await import('../js/export-utils.js');

describe('generateExportFilename', () => {
    it('should generate filename with date and time from lastModified timestamp', () => {
        // 2026-09-17T14:30:00.000Z
        const lastModified = '2026-09-17T14:30:00.000Z';
        const filename = generateExportFilename(lastModified);
        assert.equal(filename, 'mediaplan_2026-09-17_1430.json.gz');
    });

    it('should use current time when lastModified is null', () => {
        const filename = generateExportFilename(null);
        // Should match pattern mediaplan_YYYY-MM-DD_HHMM.json.gz
        assert.match(filename, /^mediaplan_\d{4}-\d{2}-\d{2}_\d{4}\.json\.gz$/);
    });

    it('should use current time when lastModified is undefined', () => {
        const filename = generateExportFilename(undefined);
        assert.match(filename, /^mediaplan_\d{4}-\d{2}-\d{2}_\d{4}\.json\.gz$/);
    });

    it('should handle midnight correctly', () => {
        const lastModified = '2026-01-01T00:00:00.000Z';
        const filename = generateExportFilename(lastModified);
        assert.equal(filename, 'mediaplan_2026-01-01_0000.json.gz');
    });

    it('should pad single digit hours and minutes', () => {
        const lastModified = '2026-03-05T09:05:00.000Z';
        const filename = generateExportFilename(lastModified);
        assert.equal(filename, 'mediaplan_2026-03-05_0905.json.gz');
    });
});

describe('buildExportMetadata', () => {
    it('should return metadata object with lastModified and version', () => {
        const lastModified = '2026-09-17T14:30:00.000Z';
        const meta = buildExportMetadata(lastModified);
        assert.equal(meta.lastModified, '2026-09-17T14:30:00.000Z');
        assert.ok(meta.exportedAt);
        assert.match(meta.exportedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
        assert.equal(meta.version, 1);
    });

    it('should use current ISO timestamp when lastModified is null', () => {
        const meta = buildExportMetadata(null);
        assert.ok(meta.lastModified);
        assert.match(meta.lastModified, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
});
