// test/mediator-color.test.ts — Tests for mediator color
import { describe, it, expect } from 'vitest';
import { createMediator } from '../src/domain/models';

describe('createMediator — color field', () => {
  it('should assign a default color', () => {
    const m = createMediator();
    expect(typeof m.color).toBe('string');
    expect(m.color.length).toBeGreaterThan(0);
    expect(m.color.startsWith('#')).toBe(true);
  });

  it('should preserve a provided color', () => {
    const m = createMediator({ color: '#ff5733' });
    expect(m.color).toBe('#ff5733');
  });
});
