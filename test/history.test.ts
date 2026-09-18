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
});
