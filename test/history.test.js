// test/history.test.js — Tests for undo/redo history manager
// TDD: RED first, then GREEN

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { createHistory, DEFAULT_HISTORY_SIZE } from '../js/history.js';

describe('DEFAULT_HISTORY_SIZE', () => {
    it('should default to 50', () => {
        assert.equal(DEFAULT_HISTORY_SIZE, 50);
    });
});

describe('createHistory', () => {
    it('should start empty before init', () => {
        const h = createHistory();
        assert.equal(h.canUndo(), false);
        assert.equal(h.canRedo(), false);
        assert.equal(h.getCurrent(), null);
        assert.equal(h.getSize(), 0);
    });

    it('should accept initial state via init', () => {
        const h = createHistory();
        h.init({ slots: [] });
        assert.equal(h.canUndo(), false);
        assert.equal(h.canRedo(), false);
        assert.deepEqual(h.getCurrent(), { slots: [] });
        assert.equal(h.getSize(), 1);
    });

    it('should record a new state with push', () => {
        const h = createHistory();
        h.init({ count: 0 });
        h.push({ count: 1 });
        assert.equal(h.canUndo(), true);
        assert.equal(h.canRedo(), false);
        assert.deepEqual(h.getCurrent(), { count: 1 });
        assert.equal(h.getSize(), 2);
    });

    it('should return previous state on undo', () => {
        const h = createHistory();
        h.init({ count: 0 });
        h.push({ count: 1 });
        const prev = h.undo();
        assert.deepEqual(prev, { count: 0 });
        assert.equal(h.canUndo(), false);
        assert.equal(h.canRedo(), true);
        assert.deepEqual(h.getCurrent(), { count: 0 });
    });

    it('should return null on undo when at beginning', () => {
        const h = createHistory();
        h.init({ count: 0 });
        assert.equal(h.undo(), null);
    });

    it('should return next state on redo', () => {
        const h = createHistory();
        h.init({ count: 0 });
        h.push({ count: 1 });
        h.undo();
        const next = h.redo();
        assert.deepEqual(next, { count: 1 });
        assert.equal(h.canRedo(), false);
        assert.equal(h.canUndo(), true);
        assert.deepEqual(h.getCurrent(), { count: 1 });
    });

    it('should return null on redo when at end', () => {
        const h = createHistory();
        h.init({ count: 0 });
        h.push({ count: 1 });
        assert.equal(h.redo(), null);
    });

    it('should clear redo stack when pushing after undo', () => {
        const h = createHistory();
        h.init({ v: 0 });
        h.push({ v: 1 });
        h.push({ v: 2 });
        h.undo(); // back to v:1
        assert.equal(h.canRedo(), true);
        h.push({ v: 3 }); // branch off, redo should be cleared
        assert.equal(h.canRedo(), false);
        assert.deepEqual(h.getCurrent(), { v: 3 });
    });

    it('should respect configurable max size', () => {
        const h = createHistory(3);
        h.init({ v: 0 });
        h.push({ v: 1 });
        h.push({ v: 2 });
        h.push({ v: 3 });
        // maxSize=3 means only 3 states kept, oldest dropped
        assert.equal(h.getSize(), 3);
        assert.deepEqual(h.getCurrent(), { v: 3 });
        // v:0 should have been dropped, so undo goes to v:2
        assert.deepEqual(h.undo(), { v: 2 });
        assert.deepEqual(h.undo(), { v: 1 });
        assert.equal(h.undo(), null); // can't go further
    });

    it('should deep-clone states to prevent external mutation', () => {
        const h = createHistory();
        const original = { slots: [{ id: 'a' }] };
        h.init(original);
        // Mutate the original object
        original.slots.push({ id: 'b' });
        // Internal state should be unaffected
        const current = h.getCurrent();
        assert.equal(current.slots.length, 1);
        assert.equal(current.slots[0].id, 'a');
    });

    it('should deep-clone returned states to prevent internal mutation', () => {
        const h = createHistory();
        h.init({ slots: [{ id: 'a' }] });
        h.push({ slots: [{ id: 'a' }, { id: 'b' }] });
        const prev = h.undo();
        // Mutate the returned state
        prev.slots.push({ id: 'c' });
        // Internal state should be unaffected
        const current = h.getCurrent();
        assert.equal(current.slots.length, 1);
    });

    it('should handle multiple push/undo/redo cycles', () => {
        const h = createHistory();
        h.init({ v: 0 });
        h.push({ v: 1 });
        h.push({ v: 2 });
        h.push({ v: 3 });
        assert.deepEqual(h.getCurrent(), { v: 3 });
        assert.deepEqual(h.undo(), { v: 2 });
        assert.deepEqual(h.undo(), { v: 1 });
        assert.deepEqual(h.undo(), { v: 0 });
        assert.equal(h.undo(), null);
        assert.deepEqual(h.redo(), { v: 1 });
        assert.deepEqual(h.redo(), { v: 2 });
        assert.deepEqual(h.redo(), { v: 3 });
        assert.equal(h.redo(), null);
    });

    it('should support branching after undo and push', () => {
        const h = createHistory();
        h.init({ v: 0 });
        h.push({ v: 1 });
        h.push({ v: 2 });
        h.undo(); // at v:1
        h.push({ v: 99 });
        assert.deepEqual(h.getCurrent(), { v: 99 });
        assert.equal(h.canRedo(), false);
        assert.deepEqual(h.undo(), { v: 1 });
        assert.deepEqual(h.undo(), { v: 0 });
        assert.equal(h.undo(), null);
    });
});
