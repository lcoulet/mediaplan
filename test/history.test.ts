// test/history.test.ts — Tests for undo/redo history manager
import { describe, it, expect } from 'vitest';
import { createHistory, DEFAULT_HISTORY_SIZE } from '../src/domain/history';

describe('DEFAULT_HISTORY_SIZE', () => {
  it('should default to 50', () => {
    expect(DEFAULT_HISTORY_SIZE).toBe(50);
  });
});

describe('createHistory', () => {
  it('should start empty before init', () => {
    const h = createHistory();
    expect(h.canUndo()).toBe(false);
    expect(h.canRedo()).toBe(false);
    expect(h.getCurrent()).toBe(null);
    expect(h.getSize()).toBe(0);
  });

  it('should accept initial state via init', () => {
    const h = createHistory<{ slots: unknown[] }>();
    h.init({ slots: [] });
    expect(h.canUndo()).toBe(false);
    expect(h.canRedo()).toBe(false);
    expect(h.getCurrent()).toEqual({ slots: [] });
    expect(h.getSize()).toBe(1);
  });

  it('should record a new state with push', () => {
    const h = createHistory<{ count: number }>();
    h.init({ count: 0 });
    h.push({ count: 1 });
    expect(h.canUndo()).toBe(true);
    expect(h.canRedo()).toBe(false);
    expect(h.getCurrent()).toEqual({ count: 1 });
    expect(h.getSize()).toBe(2);
  });

  it('should return previous state on undo', () => {
    const h = createHistory<{ count: number }>();
    h.init({ count: 0 });
    h.push({ count: 1 });
    const prev = h.undo();
    expect(prev).toEqual({ count: 0 });
    expect(h.canUndo()).toBe(false);
    expect(h.canRedo()).toBe(true);
    expect(h.getCurrent()).toEqual({ count: 0 });
  });

  it('should return null on undo when at beginning', () => {
    const h = createHistory<{ count: number }>();
    h.init({ count: 0 });
    expect(h.undo()).toBe(null);
  });

  it('should return next state on redo', () => {
    const h = createHistory<{ count: number }>();
    h.init({ count: 0 });
    h.push({ count: 1 });
    h.undo();
    const next = h.redo();
    expect(next).toEqual({ count: 1 });
    expect(h.canRedo()).toBe(false);
    expect(h.canUndo()).toBe(true);
    expect(h.getCurrent()).toEqual({ count: 1 });
  });

  it('should return null on redo when at end', () => {
    const h = createHistory<{ count: number }>();
    h.init({ count: 0 });
    h.push({ count: 1 });
    expect(h.redo()).toBe(null);
  });

  it('should clear redo stack when pushing after undo', () => {
    const h = createHistory<{ v: number }>();
    h.init({ v: 0 });
    h.push({ v: 1 });
    h.push({ v: 2 });
    h.undo(); // back to v:1
    expect(h.canRedo()).toBe(true);
    h.push({ v: 3 }); // branch off, redo should be cleared
    expect(h.canRedo()).toBe(false);
    expect(h.getCurrent()).toEqual({ v: 3 });
  });

  it('should respect configurable max size', () => {
    const h = createHistory<{ v: number }>(3);
    h.init({ v: 0 });
    h.push({ v: 1 });
    h.push({ v: 2 });
    h.push({ v: 3 });
    // maxSize=3 means only 3 states kept, oldest dropped
    expect(h.getSize()).toBe(3);
    expect(h.getCurrent()).toEqual({ v: 3 });
    // v:0 should have been dropped, so undo goes to v:2
    expect(h.undo()).toEqual({ v: 2 });
    expect(h.undo()).toEqual({ v: 1 });
    expect(h.undo()).toBe(null); // can't go further
  });

  it('should deep-clone states to prevent external mutation', () => {
    const h = createHistory<{ slots: { id: string }[] }>();
    const original = { slots: [{ id: 'a' }] };
    h.init(original);
    // Mutate the original object
    original.slots.push({ id: 'b' });
    // Internal state should be unaffected
    const current = h.getCurrent()!;
    expect(current.slots.length).toBe(1);
    expect(current.slots[0].id).toBe('a');
  });

  it('should deep-clone returned states to prevent internal mutation', () => {
    const h = createHistory<{ slots: { id: string }[] }>();
    h.init({ slots: [{ id: 'a' }] });
    h.push({ slots: [{ id: 'a' }, { id: 'b' }] });
    const prev = h.undo()!;
    // Mutate the returned state
    prev.slots.push({ id: 'c' });
    // Internal state should be unaffected
    const current = h.getCurrent()!;
    expect(current.slots.length).toBe(1);
  });

  it('should handle multiple push/undo/redo cycles', () => {
    const h = createHistory<{ v: number }>();
    h.init({ v: 0 });
    h.push({ v: 1 });
    h.push({ v: 2 });
    h.push({ v: 3 });
    expect(h.getCurrent()).toEqual({ v: 3 });
    expect(h.undo()).toEqual({ v: 2 });
    expect(h.undo()).toEqual({ v: 1 });
    expect(h.undo()).toEqual({ v: 0 });
    expect(h.undo()).toBe(null);
    expect(h.redo()).toEqual({ v: 1 });
    expect(h.redo()).toEqual({ v: 2 });
    expect(h.redo()).toEqual({ v: 3 });
    expect(h.redo()).toBe(null);
  });

  it('should support branching after undo and push', () => {
    const h = createHistory<{ v: number }>();
    h.init({ v: 0 });
    h.push({ v: 1 });
    h.push({ v: 2 });
    h.undo(); // at v:1
    h.push({ v: 99 });
    expect(h.getCurrent()).toEqual({ v: 99 });
    expect(h.canRedo()).toBe(false);
    expect(h.undo()).toEqual({ v: 1 });
    expect(h.undo()).toEqual({ v: 0 });
    expect(h.undo()).toBe(null);
  });

  it('should store label and timestamp metadata on push', () => {
    const h = createHistory<{ v: number }>();
    h.init({ v: 0 });
    const at = Date.now();
    h.push({ v: 1 }, { label: 'Créneau créé', at });
    const entries = h.getEntries();
    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual({ data: { v: 0 }, label: 'Modification', at: expect.any(Number) });
    expect(entries[1]).toEqual({ data: { v: 1 }, label: 'Créneau créé', at });
  });

  it('should default the label to Modification and timestamp to now', () => {
    const h = createHistory<{ v: number }>();
    const before = Date.now();
    h.init({ v: 0 });
    h.push({ v: 1 });
    const after = Date.now();
    const entries = h.getEntries();
    expect(entries[1].label).toBe('Modification');
    expect(entries[1].at).toBeGreaterThanOrEqual(before);
    expect(entries[1].at).toBeLessThanOrEqual(after);
  });

  it('getEntries should return deep clones (mutating them does not corrupt history)', () => {
    const h = createHistory<{ slots: unknown[] }>();
    h.init({ slots: [1] });
    h.push({ slots: [1, 2] });
    const entries = h.getEntries();
    entries[1].data.slots.push(3);
    expect(h.getCurrent()).toEqual({ slots: [1, 2] });
    expect(h.getEntries()[1].data).toEqual({ slots: [1, 2] });
  });

  it('getEntries should reflect undo/redo pointer position', () => {
    const h = createHistory<{ v: number }>();
    h.init({ v: 0 });
    h.push({ v: 1 }, { label: 'a', at: 100 });
    h.push({ v: 2 }, { label: 'b', at: 200 });
    expect(h.getPointer()).toBe(2);
    h.undo();
    expect(h.getPointer()).toBe(1);
    expect(h.getEntries()).toHaveLength(3);
    h.undo();
    expect(h.getPointer()).toBe(0);
    h.redo();
    expect(h.getPointer()).toBe(1);
  });

  it('getPointer should be -1 before init', () => {
    const h = createHistory();
    expect(h.getPointer()).toBe(-1);
  });

  it('getEntries should drop redo states after a push following undo', () => {
    const h = createHistory<{ v: number }>();
    h.init({ v: 0 });
    h.push({ v: 1 }, { label: 'a', at: 100 });
    h.push({ v: 2 }, { label: 'b', at: 200 });
    h.undo(); // at v:1
    h.push({ v: 99 }, { label: 'c', at: 300 });
    const entries = h.getEntries();
    expect(entries.map((e) => e.label)).toEqual(['Modification', 'a', 'c']);
  });

  it('should keep metadata when enforcing max size (oldest entries dropped)', () => {
    const h = createHistory<{ v: number }>(2);
    h.init({ v: 0 });
    h.push({ v: 1 }, { label: 'a', at: 100 });
    h.push({ v: 2 }, { label: 'b', at: 200 });
    expect(h.getSize()).toBe(2);
    expect(h.getEntries().map((e) => e.label)).toEqual(['a', 'b']);
    expect(h.getPointer()).toBe(1);
  });
});
