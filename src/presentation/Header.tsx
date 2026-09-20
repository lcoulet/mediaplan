// Header.tsx — App header with navigation + undo/redo/reset

import { useState } from 'react';
import { useData, useCRUD } from './DataContext';
import type { ViewName } from './types';
import { getDefaultHalfDayConfig } from '../domain/models';

const NAV_ITEMS: { view: ViewName; label: string }[] = [
  { view: 'weekly', label: 'Plan Hebdo' },
  { view: 'daily', label: 'Plan Jour' },
  { view: 'mediators', label: 'Médiateurs' },
  { view: 'offers', label: 'Offres' },
  { view: 'absences', label: 'Absences' },
  { view: 'import-export', label: 'Import / Export' },
];

interface HeaderProps {
  onOpenUserGuide: () => void;
}

// Time selector component for half-day config
function TimeSelector({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <select
      className="select time-select"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ width: '80px', padding: '4px 8px', fontSize: '13px' }}
    >
      {Array.from({ length: 24 }, (_, h) => {
        const hourStr = String(h).padStart(2, '0');
        return (
          <option key={hourStr} value={`${hourStr}:00`}>
            {hourStr}:00
          </option>
        );
      })}
    </select>
  );
}

export default function Header({ onOpenUserGuide }: HeaderProps) {
  const { state, dispatch, canUndo, canRedo, undo, redo, resetData } = useData();
  const crud = useCRUD();
  const [showConfig, setShowConfig] = useState(false);
  
  const halfDayConfig = state.data.halfDayConfig || getDefaultHalfDayConfig();

  function handleSaveConfig() {
    crud({ type: 'SET_HALF_DAY_CONFIG', config: halfDayConfig });
    setShowConfig(false);
  }

  function handleResetConfig() {
    const defaultConfig = getDefaultHalfDayConfig();
    crud({ type: 'SET_HALF_DAY_CONFIG', config: defaultConfig });
    setShowConfig(false);
  }

  return (
    <header className="app-header">
      <div className="header-left">
        <h1 className="app-title">MediaPlan</h1>
        <span className="app-subtitle">
          Gestion des plannings de médiation — Museum
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
          id="btn-user-guide"
          title="Ouvrir la documentation utilisateur"
          onClick={onOpenUserGuide}
        >
          ?
        </button>
        <button
          className="icon-btn"
          id="btn-settings"
          title="Configuration des demi-journées"
          onClick={() => setShowConfig(!showConfig)}
        >
          ⚙️
        </button>
        {showConfig && (
          <div className="config-popup" onClick={(e) => e.stopPropagation()}>
            <div className="config-title">Demi-journées</div>
            <div className="config-row">
              <span>Fin matin :</span>
              <TimeSelector
                value={halfDayConfig.morningEnd}
                onChange={(v) => {
                  const newConfig = { ...halfDayConfig, morningEnd: v };
                  crud({ type: 'SET_HALF_DAY_CONFIG', config: newConfig });
                }}
              />
            </div>
            <div className="config-row">
              <span>Début après-midi :</span>
              <TimeSelector
                value={halfDayConfig.afternoonStart}
                onChange={(v) => {
                  const newConfig = { ...halfDayConfig, afternoonStart: v };
                  crud({ type: 'SET_HALF_DAY_CONFIG', config: newConfig });
                }}
              />
            </div>
            <div className="config-actions">
              <button className="btn btn-secondary" onClick={handleResetConfig}>
                Réinitialiser
              </button>
              <button className="btn btn-primary" onClick={handleSaveConfig}>
                Fermer
              </button>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
