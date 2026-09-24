// Header.tsx — App header with navigation + undo/redo/reset

import { useState } from 'react';
import { useData, useCRUD } from './DataContext';
import type { ViewName } from './types';
import { getDefaultHalfDayConfig, migrateAbsencesToConfig } from '../domain/models';
import type { Absence } from '../domain/types';

const NAV_ITEMS: { view: ViewName; label: string; shortcut: string }[] = [
  { view: 'daily', label: 'Plan Jour', shortcut: '1' },
  { view: 'weekly', label: 'Plan Hebdo', shortcut: '2' },
  { view: 'reservations', label: 'Plan Accueil', shortcut: '3' },
  { view: 'mediators', label: 'Médiateurs', shortcut: '4' },
  { view: 'offers', label: 'Offres', shortcut: '5' },
  { view: 'absences', label: 'Absences', shortcut: '6' },
  { view: 'stats', label: 'Statistiques', shortcut: '7' },
  { view: 'import-export', label: 'Import / Export', shortcut: '8' },
];

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

export default function Header({ onToggleHistory }: { onToggleHistory: () => void }) {
  const { state, dispatch, canUndo, canRedo, undo, redo } = useData();
  const crud = useCRUD();
  const [showConfig, setShowConfig] = useState(false);
  const [showMigrationWarning, setShowMigrationWarning] = useState(false);
  const [pendingConfig, setPendingConfig] = useState<{ morningEnd: string; afternoonStart: string } | null>(null);

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

  function handleConfigChange(newConfig: { morningEnd: string; afternoonStart: string }) {
    // Check if we need to migrate absences
    const hasFutureAbsences = state.data.absences.some((a: Absence) => a.endDate >= new Date().toISOString().slice(0, 10));
    if (hasFutureAbsences) {
      setPendingConfig(newConfig);
      setShowMigrationWarning(true);
      // Store the new config temporarily in state
      dispatch({ type: 'SET_HALF_DAY_CONFIG', config: newConfig });
    } else {
      crud({ type: 'SET_HALF_DAY_CONFIG', config: newConfig });
    }
  }

  function handleMigrationConfirm() {
    setShowMigrationWarning(false);
    if (!pendingConfig) return;
    
    // Apply migration and save
    const config = pendingConfig;
    const newAbsences = migrateAbsencesToConfig(state.data.absences, config);
    
    // Update config first
    crud({ type: 'SET_HALF_DAY_CONFIG', config });
    
    // Update absences
    newAbsences.forEach(abs => {
      crud({ type: 'UPDATE_ABSENCE', absence: abs });
    });
    
    setPendingConfig(null);
    setShowConfig(false);
  }

  function handleMigrationCancel() {
    setShowMigrationWarning(false);
    setPendingConfig(null);
    // Revert the config change
    dispatch({ type: 'SET_HALF_DAY_CONFIG', config: state.data.halfDayConfig || getDefaultHalfDayConfig() });
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
        <button
          className="icon-btn"
          id="btn-settings"
          title="Configuration des demi-journées"
          onClick={() => setShowConfig(!showConfig)}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492zm0 5.054a1.808 1.808 0 1 1 0-3.616 1.808 1.808 0 0 1 0 3.616z"/>
            <path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.892 3.434-.901 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.892-1.64-.901-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52l-.094-.319zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 0 0 2.693 1.115l.291-.16c.764-.415 1.6.42 1.184 1.185l-.159.292a1.873 1.873 0 0 0 1.116 2.692l.318.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 0 0-1.115 2.693l.16.291c.415.764-.42 1.6-1.185 1.184l-.292-.159a1.873 1.873 0 0 0-2.692 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 0 0-2.693-1.115l-.291.16c-.764.415-1.6-.42-1.184-1.185l.159-.292a1.873 1.873 0 0 0-1.116-2.692l-.318-.094c-.835-.246-.835-1.428 0-1.674l.319-.094a1.873 1.873 0 0 0 1.115-2.693l-.16-.291c-.415-.764.42-1.6 1.185-1.184l.292.159a1.873 1.873 0 0 0 2.692-1.116l.094-.318z"/>
          </svg>
        </button>
        {showConfig && (
          <div className="config-popup" onClick={(e) => e.stopPropagation()}>
            <div className="config-title">Demi-journées</div>
            <div className="config-row">
              <span>Fin matin :</span>
              <TimeSelector
                value={halfDayConfig.morningEnd}
                onChange={(v) => handleConfigChange({ ...halfDayConfig, morningEnd: v })}
              />
            </div>
            <div className="config-row">
              <span>Début après-midi :</span>
              <TimeSelector
                value={halfDayConfig.afternoonStart}
                onChange={(v) => handleConfigChange({ ...halfDayConfig, afternoonStart: v })}
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
        {showMigrationWarning && (
          <div className="modal-overlay" onClick={() => setShowMigrationWarning(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h3>Mettre à jour les absences ?</h3>
              <p>
                Les horaires des absences non terminées vont être mis à jour avec les nouveaux paramètres de demi-journée.
              </p>
              <p>Souhaitez-vous continuer ?</p>
              <div className="modal-actions">
                <button className="btn btn-secondary" onClick={handleMigrationCancel}>
                  Annuler
                </button>
                <button className="btn btn-primary" onClick={handleMigrationConfirm}>
                  Mettre à jour
                </button>
              </div>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
