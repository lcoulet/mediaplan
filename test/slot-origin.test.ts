// test/slot-origin.test.ts — Tests for slot origin/import tracking and schedule lock
import { describe, it, expect } from 'vitest';
import { createSlot, createSchedule, formatImportDate, ORIGIN_LABELS } from '../src/domain/models';

describe('createSlot — origin fields', () => {
  it('should default to manual origin with empty import fields', () => {
    const s = createSlot();
    expect(s.origin).toBe('manual');
    expect(s.importSource).toBe('');
    expect(s.importedAt).toBe('');
    expect(s.modifiedAfterImport).toBe(false);
  });

  it('should create an imported slot with source and timestamp', () => {
    const s = createSlot({
      origin: 'imported',
      importSource: 'Secutix',
      importedAt: '2026-09-14T19:30:00.000Z',
    });
    expect(s.origin).toBe('imported');
    expect(s.importSource).toBe('Secutix');
    expect(s.importedAt).toBe('2026-09-14T19:30:00.000Z');
    expect(s.modifiedAfterImport).toBe(false);
  });

  it('should create a modified-imported slot', () => {
    const s = createSlot({
      origin: 'imported',
      importSource: 'Coordination',
      importedAt: '2026-09-14T19:30:00.000Z',
      modifiedAfterImport: true,
    });
    expect(s.origin).toBe('imported');
    expect(s.modifiedAfterImport).toBe(true);
  });
});

describe('createSchedule — locked field', () => {
  it('should default to unlocked', () => {
    const s = createSchedule();
    expect(s.locked).toBe(false);
  });

  it('should create a locked schedule', () => {
    const s = createSchedule({ locked: true });
    expect(s.locked).toBe(true);
  });
});

describe('formatImportDate', () => {
  it('should format ISO timestamp to French human-friendly string', () => {
    const formatted = formatImportDate('2026-09-14T19:30:00.000Z');
    // Should contain day number, month abbreviation, year, and time
    expect(formatted).toContain('14');
    expect(formatted).toContain('19:30');
  });

  it('should return empty string for empty input', () => {
    expect(formatImportDate('')).toBe('');
    expect(formatImportDate(null)).toBe('');
    expect(formatImportDate(undefined)).toBe('');
  });
});

describe('ORIGIN_LABELS', () => {
  it('should contain French labels for origin types', () => {
    expect(ORIGIN_LABELS.manual).toBe('Saisie manuelle');
    expect(ORIGIN_LABELS.imported).toBe('Importé');
  });
});
