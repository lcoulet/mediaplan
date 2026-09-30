// Header.tsx — App header with navigation + undo/redo/reset

import { useData } from './DataContext';
import type { ViewName } from './types';

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
      </nav>
    </header>
  );
}
