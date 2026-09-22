// usePrint.ts — shared print behaviour for DailyView and ReservationView
//
// Sets a body class while printing (`print-mode`), so the print stylesheet can
// hide the app chrome (header, toolbars, other views) and show a print header
// with the view title + a small print date footer. The class is removed after
// printing so the screen layout is untouched.

import { useCallback } from 'react';

export function usePrint(): () => void {
  return useCallback(() => {
    const done = () => {
      document.body.classList.remove('print-mode');
      window.removeEventListener('afterprint', done);
    };
    window.addEventListener('afterprint', done);
    document.body.classList.add('print-mode');
    // Let React render the print header/footer before the dialog opens
    window.setTimeout(() => window.print(), 50);
  }, []);
}

/** Small, discreet print date line: "Imprimé le 22/09/2026 à 21:34" */
export function printDateLine(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `Imprimé le ${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} à ${p(d.getHours())}:${p(d.getMinutes())}`;
}
