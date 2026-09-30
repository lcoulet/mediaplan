// Header.tsx — App header with navigation + Secutix import + undo/redo/reset

import { useState } from 'react';
import { useData } from './DataContext';
import type { ViewName } from './types';
import Modal from './Modal';
import SecutixImportPanel from './SecutixImportPanel';

const NAV_ITEMS: { view: ViewName; label: string; shortcut: string }[] = [
  { view: 'daily', label: 'Plan Jour', shortcut: '1' },
  { view: 'weekly', label: 'Plan Hebdo', shortcut: '2' },
  { view: 'reservations', label: 'Plan Accueil', shortcut: '3' },
  { view: 'mediators', label: 'Médiateurs', shortcut: '4' },
  { view: 'offers', label: 'Offres', shortcut: '5' },
  { view: 'absences', label: 'Absences', shortcut: '6' },
  { view: 'stats', label: 'Statistiques', shortcut: '7' },
  { view: 'configuration', label: 'Configuration', shortcut: '8' },
];

export default function Header({ onToggleHistory }: { onToggleHistory: () => void }) {
  const { state, dispatch, canUndo, canRedo, undo, redo } = useData();
  // Secutix import modal — opened from the header button (daily foreground
  // action, visible from every view; NOT part of the Configuration view).
  // The panel is keyed by open-state epoch so every open mounts it FRESH:
  // no file/error/choice state leaks between imports.
  const [secutixEpoch, setSecutixEpoch] = useState(0);
  const secutixOpen = secutixEpoch > 0;

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
