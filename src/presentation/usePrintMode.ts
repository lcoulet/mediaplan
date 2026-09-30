// usePrintMode.ts — reactive print-mode flag for views that adapt their
// layout while printing (e.g. the daily view's print time axis).
//
// The print flow (usePrint) toggles the `print-mode` class on <body> around
// window.print(). This hook mirrors that class into React state via a
// MutationObserver so components can reactively switch to print geometry.
// It also reports `true` while the browser's own print media is active
// (window.matchMedia('print')) — the class and the media state are OR-ed.
//
// Pure UI glue (presentation layer): no unit-tested logic beyond the flag
// itself, which is covered by use-print-mode.test.tsx.

import { useEffect, useState } from 'react';

export function usePrintMode(): boolean {
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    const sync = () => {
      setPrinting(
        document.body.classList.contains('print-mode') ||
          (typeof window.matchMedia === 'function' &&
            window.matchMedia('print').matches)
      );
    };
    sync();

    const observer = new MutationObserver(sync);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class'],
    });

    let media: MediaQueryList | undefined;
    if (typeof window.matchMedia === 'function') {
      media = window.matchMedia('print');
      media.addEventListener('change', sync);
    }

    return () => {
      observer.disconnect();
      media?.removeEventListener('change', sync);
    };
  }, []);

  return printing;
}
