// useElementWidth.ts — Reactive container width via ResizeObserver,
// plus the responsive hour-scale helper for the planning views.

import { useCallback, useEffect, useRef, useState } from 'react';

export interface ElementWidth {
  ref: (node: HTMLElement | null) => void;
  width: number;
}

// Measures a DOM node's content width, updating on resize.
// Returns width=0 before the first measurement.
export function useElementWidth(): ElementWidth {
  const [width, setWidth] = useState(0);
  const nodeRef = useRef<HTMLElement | null>(null);

  // Stable callback ref so consumers can attach it directly
  const ref = useCallback((node: HTMLElement | null) => {
    nodeRef.current = node;
  }, []);

  useEffect(() => {
    const node = nodeRef.current;
    if (!node || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setWidth(entry.contentRect.width);
      }
    });
    observer.observe(node);
    // Initial measurement
    setWidth(node.getBoundingClientRect().width);

    return () => observer.disconnect();
  });

  // Re-run when ref attaches: the effect runs after every render, which is
  // cheap (observer re-created only when width changes trigger re-render,
  // and disconnect/observe is O(1)).
  return { ref, width };
}

export const MIN_PX_PER_HOUR = 40; // below this, short slots are unreadable
export const MAX_PX_PER_HOUR = 120; // above this, the grid stretches absurdly

// Responsive hour scale: fill the available track width with `hours`
// columns, clamped to readable bounds. Grids wider than the clamp keep
// their natural width (horizontal scroll already handles overflow).
export function pxPerHourFromWidth(trackWidth: number, hours: number): number {
  if (trackWidth <= 0 || hours <= 0) return MIN_PX_PER_HOUR;
  const ideal = trackWidth / hours;
  return Math.min(MAX_PX_PER_HOUR, Math.max(MIN_PX_PER_HOUR, ideal));
}

// Vertical hour scale for the weekly view: use the browser viewport
// height so the day columns fill the visible space (minus chrome:
// header, toolbar, day-name row). Falls back to `fallback` when the
// viewport is unknown (jsdom) or too small.
export function useViewportPxPerHour(hours: number, fallback: number): number {
  const [px, setPx] = useState(fallback);

  useEffect(() => {
    const compute = () => {
      const vh = window.innerHeight;
      if (!vh || vh <= 0) return;
      // Reserve ~220px for app chrome (header + toolbar + day names + margins)
      const available = vh - 220;
      if (available <= 0) return;
      const ideal = available / hours;
      // Clamp: readable minimum 30px/h, comfortable maximum 90px/h
      const clamped = Math.min(90, Math.max(30, ideal));
      setPx(clamped);
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, [hours]);

  return px;
}
