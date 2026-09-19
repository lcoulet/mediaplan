// test/mediator-color.test.js — Tests for mediator color
// TDD: RED first, then GREEN

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { createMediator } from '../js/models.js';

describe('createMediator — color field', () => {
    it('should assign a default color', () => {
        const m = createMediator();
        assert.ok(typeof m.color === 'string');
        assert.ok(m.color.length > 0);
        assert.ok(m.color.startsWith('#'));
    });

    it('should preserve a provided color', () => {
        const m = createMediator({ color: '#ff5733' });
        assert.equal(m.color, '#ff5733');
    });
});
