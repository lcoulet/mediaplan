// Header.tsx — App header with navigation + undo/redo/reset

import { useData } from './DataContext';
import type { ViewName } from './types';

const NAV_ITEMS: { view: ViewName; label: string }[] = [
  { view: 'calendar', label: 'Planning' },
  { view: 'mediators', label: 'Médiateurs' },
  { view: 'offers', label: 'Offres' },
  { view: 'absences', label: 'Absences' },
  { view: 'import-export', label: 'Import / Export' },
];

export default function Header() {
  const { state, dispatch, canUndo, canRedo, undo, redo, resetData } = useData();

  return (
    <header className="app-header">
      <div className="header-left">
        <h1 className="app-title">MediaPlan</h1>
        <span className="app-subtitle">
          Gestion des plannings de médiation — Muséum de Toulouse
        </span>
      </div>
      <nav className="header-nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.view}
            className={`nav-btn ${state.currentView === item.view ? 'active' : ''}`}
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
        <button
          className="icon-btn"
          id="btn-reset-data"
          title="Réinitialiser les données de démonstration"
          onClick={() => {
            if (
              confirm(
                '⚠️ Cela va supprimer TOUTES les données actuelles et les remplacer par les données de démonstration.\n\nContinuer ?'
              )
            ) {
              resetData();
            }
          }}
        >
          ⟳
        </button>
      </nav>
    </header>
  );
}
