// test/slot-origin.test.js — Tests for slot origin/import tracking and schedule lock
// TDD: RED first, then GREEN

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { createSlot, createSchedule, formatImportDate, ORIGIN_LABELS } from '../js/models.js';

describe('createSlot — origin fields', () => {
    it('should default to manual origin with empty import fields', () => {
        const s = createSlot();
        assert.equal(s.origin, 'manual');
        assert.equal(s.importSource, '');
        assert.equal(s.importedAt, '');
        assert.equal(s.modifiedAfterImport, false);
    });

    it('should create an imported slot with source and timestamp', () => {
        const s = createSlot({
            origin: 'imported',
            importSource: 'Secutix',
            importedAt: '2026-09-14T19:30:00.000Z',
        });
        assert.equal(s.origin, 'imported');
        assert.equal(s.importSource, 'Secutix');
        assert.equal(s.importedAt, '2026-09-14T19:30:00.000Z');
        assert.equal(s.modifiedAfterImport, false);
    });

    it('should create a modified-imported slot', () => {
        const s = createSlot({
            origin: 'imported',
            importSource: 'Coordination',
            importedAt: '2026-09-14T19:30:00.000Z',
            modifiedAfterImport: true,
        });
        assert.equal(s.origin, 'imported');
        assert.equal(s.modifiedAfterImport, true);
    });
});

describe('createSchedule — locked field', () => {
    it('should default to unlocked', () => {
        const s = createSchedule();
        assert.equal(s.locked, false);
    });

    it('should create a locked schedule', () => {
        const s = createSchedule({ locked: true });
        assert.equal(s.locked, true);
    });
});

describe('formatImportDate', () => {
    it('should format ISO timestamp to French human-friendly string', () => {
        const formatted = formatImportDate('2026-09-14T19:30:00.000Z');
        // Should contain day number, month abbreviation, year, and time
        assert.ok(formatted.includes('14'));
        assert.ok(formatted.includes('19:30'));
    });

    it('should return empty string for empty input', () => {
        assert.equal(formatImportDate(''), '');
        assert.equal(formatImportDate(null), '');
        assert.equal(formatImportDate(undefined), '');
    });
});

describe('ORIGIN_LABELS', () => {
    it('should contain French labels for origin types', () => {
        assert.equal(ORIGIN_LABELS.manual, 'Saisie manuelle');
        assert.equal(ORIGIN_LABELS.imported, 'Importé');
    });
});
