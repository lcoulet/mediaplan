// test/store.test.js — Tests for localStorage store
// TDD: RED first, then GREEN

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

// We need to mock localStorage for Node environment
// Will fail until store.js is properly implemented

// Minimal localStorage mock
class LocalStorageMock {
    constructor() {
        this.data = {};
    }
    getItem(key) {
        return this.data[key] || null;
    }
    setItem(key, value) {
        this.data[key] = String(value);
    }
    removeItem(key) {
        delete this.data[key];
    }
    clear() {
        this.data = {};
    }
}

globalThis.localStorage = new LocalStorageMock();

const { load, save, exportJSON, importJSON } = await import('../js/store.js');

describe('store.load', () => {
    beforeEach(() => localStorage.clear());

    it('should return empty data structure when nothing stored', () => {
        const data = load();
        assert.deepEqual(data, {
            mediators: [],
            offers: [],
            schedules: [],
            slots: [],
        });
    });

    it('should load data from localStorage', () => {
        const stored = {
            mediators: [{ id: 'med_1', lastName: 'Dupont' }],
            offers: [{ id: 'off_1', name: 'Visite' }],
            schedules: [],
            slots: [{ id: 'slot_1', offerId: 'off_1' }],
        };
        localStorage.setItem('mediaplan_data_v1', JSON.stringify(stored));

        const data = load();
        assert.equal(data.mediators.length, 1);
        assert.equal(data.mediators[0].lastName, 'Dupont');
        assert.equal(data.offers.length, 1);
        assert.equal(data.slots.length, 1);
    });

    it('should return empty data on corrupt JSON', () => {
        localStorage.setItem('mediaplan_data_v1', 'not valid json{{{');
        const data = load();
        assert.deepEqual(data.mediators, []);
        assert.deepEqual(data.offers, []);
    });
});

describe('store.save', () => {
    beforeEach(() => localStorage.clear());

    it('should persist data to localStorage', () => {
        const data = {
            mediators: [{ id: 'med_1', lastName: 'Dupont' }],
            offers: [],
            schedules: [],
            slots: [],
        };
        const result = save(data);
        assert.equal(result, true);
        const raw = localStorage.getItem('mediaplan_data_v1');
        assert.ok(raw);
        const parsed = JSON.parse(raw);
        assert.equal(parsed.mediators.length, 1);
    });
});
