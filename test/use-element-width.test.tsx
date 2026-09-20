// useElementWidth — ResizeObserver-based container measurement
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useElementWidth } from '../src/presentation/useElementWidth';

describe('useElementWidth', () => {
  it('returns 0 before measurement (SSR/initial render)', () => {
    const { result } = renderHook(() => useElementWidth());
    expect(result.current.width).toBe(0);
    // callback ref, attachable directly to a React element
    expect(typeof result.current.ref).toBe('function');
  });

  it('exposes a stable ref object across renders', () => {
    const { result, rerender } = renderHook(() => useElementWidth());
    const first = result.current.ref;
    rerender();
    expect(result.current.ref).toBe(first);
  });
});

describe('pxPerHourFromWidth', () => {
  it('scales px/hour to fill the track width', () => {
    // 12h grid (8:00-19:00), 660px track -> 55px/h
    expect(pxPerHourFromWidth(660, 12)).toBe(55);
    // 1440px -> 120px/h
    expect(pxPerHourFromWidth(1440, 12)).toBe(120);
  });

  it('enforces a minimum so short slots stay readable', () => {
    // Tiny screens: 200px for 12h would be 16px/h -> clamped to 40
    expect(pxPerHourFromWidth(200, 12)).toBe(40);
  });

  it('never exceeds a comfortable maximum', () => {
    // Ultra-wide: 6000px for 12h = 500px/h -> clamped to 120
    expect(pxPerHourFromWidth(6000, 12)).toBe(120);
  });
});

import { pxPerHourFromWidth } from '../src/presentation/useElementWidth';
