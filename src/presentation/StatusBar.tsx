// StatusBar.tsx — Thin footer bar: app version, localStorage usage,
// last data modification date. Rendered app-wide below the active view.

import { useMemo, useState, useEffect } from 'react';
import { getLastModified, STORAGE_KEY } from '../infrastructure/store';
import { formatImportDate } from '../domain/models';

// Max localStorage size varies by browser (5-10 MB); use the common
// conservative denominator for the ratio display.
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} Mo`;
}

// Fallback for test environments where the define is absent
const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0-dev';

export default function StatusBar() {
  const [usage, setUsage] = useState<{ bytes: number; pct: number } | null>(null);
  const [lastModified, setLastModified] = useState<string | null>(null);

  // Recompute on every render cycle (cheap) so import/reset/update
  // reflect quickly without a global event system.
  useEffect(() => {
    const compute = () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const bytes = raw ? raw.length : 0;
        setUsage({ bytes, pct: Math.min(100, (bytes / MAX_BYTES) * 100) });
        setLastModified(getLastModified());
      } catch {
        setUsage(null);
      }
    };
    compute();
    // Track mutations of the data (save/import/reset) via the storage event
    // (fires on same-origin writes from other tabs) and a light poll for
    // same-tab updates.
    const interval = setInterval(compute, 5000);
    window.addEventListener('storage', compute);
    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', compute);
    };
  }, []);

  const lastModifiedLabel = useMemo(() => {
    if (!lastModified) return '—';
    return formatImportDate(lastModified) || lastModified;
  }, [lastModified]);

  return (
    <footer className="status-bar" role="contentinfo">
      <span className="status-item">MediaPlan v{APP_VERSION}</span>
      {usage && (
        <span className="status-item" title="Espace utilisé dans le localStorage (quota usuel 5 Mo)">
          Données : {formatBytes(usage.bytes)} / 5 Mo ({usage.pct.toFixed(1)}%)
        </span>
      )}
      <span className="status-item" title="Dernière modification des données">
        MAJ : {lastModifiedLabel}
      </span>
    </footer>
  );
}
