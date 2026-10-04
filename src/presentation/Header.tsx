// Header.tsx — App header with navigation + Secutix import + undo/redo/reset
// + manual JSON.gz export/import with an "unexported changes" amber badge
// (spec: test/features/import-export/header-import-export.feature)

import { useCallback, useEffect, useRef, useState } from 'react';
import { useData } from './DataContext';
import type { ViewName } from './types';
import Modal from './Modal';
import SecutixImportPanel from './SecutixImportPanel';
import { exportJSON, importJSON, getLastModified } from '../infrastructure/store';
import {
  loadStamps,
  saveStamps,
  isExportPending,
  resolveImportBaseline,
  compareFileAge,
} from '../domain/sync-state';
import { formatImportDate } from '../domain/models';

const NAV_ITEMS: { view: ViewName; label: string; shortcut: string }[] = [
  { view: 'daily', label: 'Plan Jour', shortcut: '1' },
  { view: 'weekly', label: 'Plan Hebdo', shortcut: '2' },
  { view: 'reservations', label: 'Plan Accueil', shortcut: '3' },
  { view: 'mediators', label: 'Médiateurs', shortcut: '4' },
  { view: 'offers', label: 'Offres', shortcut: '5' },
  { view: 'absences', label: 'Absences', shortcut: '6' },
  { view: 'stats', label: 'Statistiques', shortcut: '7' },
  { view: 'annual', label: 'Tableau', shortcut: '8' },
  { view: 'configuration', label: 'Configuration', shortcut: '9' },
];

// Notification channel: bumped whenever a sync stamp changes (export/import
// from ANY entry point — header or Configuration view) so every Header
// instance re-renders its badge. Keeps both entry points consistent without
// a global state manager for two localStorage keys.
const stampListeners = new Set<() => void>();
function notifyStampChange() {
  stampListeners.forEach((l) => l());
}

/** Notify the header badges that sync stamps changed (called by the
 *  Configuration view so both entry points stay consistent). */
export function notifySyncStampsChanged(): void {
  notifyStampChange();
}

// French history label for the manual JSON import (undoable with ↶)
const JSON_IMPORT_LABEL = 'Import JSON';

export default function Header({ onToggleHistory }: { onToggleHistory: () => void }) {
  const { state, dispatch, commit, canUndo, canRedo, undo, redo } = useData();
  // Secutix import modal — opened from the header button (daily foreground
  // action, visible from every view; NOT part of the Configuration view).
  // The panel is keyed by open-state epoch so every open mounts it FRESH:
  // no file/error/choice state leaks between imports.
  const [secutixEpoch, setSecutixEpoch] = useState(0);
  const secutixOpen = secutixEpoch > 0;
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Unexported-changes signal for the amber badge. Computed on every render;
  // renders happen whenever the data state changes (useData subscription)
  // and whenever a sync stamp is written from either entry point.
  const [, setStampTick] = useState(0);
  useEffect(() => {
    const listener = () => setStampTick((t) => t + 1);
    stampListeners.add(listener);
    return () => { stampListeners.delete(listener); };
  }, []);
  const stamps = loadStamps();
  const exportPending = isExportPending(getLastModified(), stamps);

  const handleExport = useCallback(() => {
    exportJSON()
      .then(() => {
        // One-click export succeeded: the downloaded state is the new
        // reference. Stamps are shared with the Configuration view.
        saveStamps({ ...loadStamps(), lastExportedAt: new Date().toISOString() });
        notifyStampChange();
      })
      .catch((err) => {
        alert('Erreur lors de l’export : ' + err.message);
        // Failure: stamp unchanged, badge stays, data untouched
      });
  }, []);

  const handleImportFile = useCallback(
    async (file: File) => {
      try {
        // Parse WITHOUT committing: a declined confirmation must change nothing
        const { data, metadata } = await importJSON(file);
        // Sequential non-blocking confirmations (informative — the import is
        // undoable with ↶)
        const replaceOk = window.confirm(
          '⚠ Vos données seront remplacées — vous pourrez annuler avec ↶'
        );
        if (!replaceOk) return;
        // Age warning only when the file is strictly older than local data
        // (legacy files without embedded metadata: nothing to compare, skip)
        const localLastModified = getLastModified() ?? undefined;
        if (compareFileAge(metadata?.lastModified, localLastModified) === 'older') {
          const fileDate = formatImportDate(metadata?.lastModified);
          const localDate = formatImportDate(localLastModified);
          const olderOk = window.confirm(
            `⚠ Ce fichier est plus ancien que vos données actuelles (${fileDate} vs ${localDate})` +
              '\n\nPoursuivre quand même ?'
          );
          if (!olderOk) return;
        }
        // Commit the imported data: undoable with ↶. The file's embedded
        // lastModified becomes the data's own stamp (the import instant is
        // not a modification).
        const now = new Date().toISOString();
        commit(data, JSON_IMPORT_LABEL, metadata?.lastModified || now);
        saveStamps(resolveImportBaseline({ lastModified: metadata?.lastModified }, now));
        notifyStampChange();
      } catch (e) {
        // Corrupt file: alert, nothing changed, not in the undoable history
        alert('Erreur lors de l’import : ' + (e as Error).message);
      } finally {
        // Allow re-selecting the same file later
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    },
    [commit]
  );

  const handleImportChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleImportFile(file);
    },
    [handleImportFile]
  );

  return (
    <header className="app-header">
      <div className="header-left">
        <h1 className="app-title">MediaPlan</h1>
        <span className="app-subtitle">
          Gestion des plannings de médiation — Museum
        </span>
      </div>
      <nav className="header-nav" aria-label="Navigation principale">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.view}
            className={`nav-btn ${state.currentView === item.view ? 'active' : ''}`}
            title={`${item.label} (${item.shortcut})`}
            onClick={() => dispatch({ type: 'SET_VIEW', view: item.view })}
          >
            {item.label}
          </button>
        ))}
        <div className="header-actions">
          <button
            className="btn btn-accent"
            type="button"
            id="btn-secutix-import"
            title="Ouvrir le flux d'import Secutix"
            onClick={() => setSecutixEpoch(Date.now())}
          >
            ⇩ Import Secutix
          </button>
          <span className="btn-export-wrap">
            <button
              className="btn btn-secondary"
              type="button"
              id="btn-export-json"
              title={exportPending ? 'Modifications non exportées' : 'Exporter les données (JSON.gz)'}
              onClick={handleExport}
            >
              ⇧ Export
            </button>
            {exportPending && (
              <span className="export-pending-badge" aria-hidden="true" />
            )}
          </span>
          <button
            className="btn btn-secondary"
            type="button"
            id="btn-import-json"
            title="Importer un fichier de sauvegarde (JSON.gz)"
            onClick={() => fileInputRef.current?.click()}
          >
            ⇩ Import
          </button>
          <input
            ref={fileInputRef}
            type="file"
            id="header-import-file"
            accept=".json,.gz"
            className="visually-hidden-file"
            aria-hidden="true"
            tabIndex={-1}
            onChange={handleImportChange}
          />
          <button
            className="icon-btn"
            id="btn-undo"
            title="Annuler (Ctrl+Z)"
            disabled={!canUndo}
            onClick={undo}
          >
            ↶
          </button>
          <button
            className="icon-btn"
            id="btn-redo"
            title="Rétablir (Ctrl+Shift+Z)"
            disabled={!canRedo}
            onClick={redo}
          >
            ↷
          </button>
          <a
            className="icon-btn"
            id="btn-user-guide"
            title="Documentation (?)"
            href="guide/index.html"
            target="_blank"
            rel="noreferrer"
          >
            ?
          </a>
          <button
            className="icon-btn"
            id="btn-history"
            title="Historique (H)"
            onClick={onToggleHistory}
          >
            Historique
          </button>
        </div>
      </nav>
      {secutixOpen && (
        <Modal title="Import Secutix (synchronisation)" onClose={() => setSecutixEpoch(0)}>
          <SecutixImportPanel key={secutixEpoch} />
        </Modal>
      )}
    </header>
  );
}
