// ConfigurationView.tsx — Configuration view: three sections — Espaces
// (space list management, SpacesSection), Données (JSON.gz export/import,
// data delete, demo data) and Demi-journées (half-day boundaries with
// validation, moved from the header settings popup). The Secutix import is
// NOT a configuration concern: it lives in the header (button + modal).

import { useState } from 'react';
import { useData, COMMIT_LABELS } from './DataContext';
import { exportJSON, importJSON } from '../infrastructure/store';
import { exportExcel, importExcel } from '../infrastructure/excel';
import { clearPlanningData } from '../domain/clear-data';
import { getDefaultHalfDayConfig, validateHalfDayConfig, migrateAbsencesToConfig } from '../domain/models';
import SpacesSection from './SpacesSection';

export default function ConfigurationView() {
  const { state, commit, resetData } = useData();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [clearMediators, setClearMediators] = useState(false);
  const [clearOffers, setClearOffers] = useState(false);

  // Half-day settings form: draft values + validation error
  const halfDayConfig = state.data.halfDayConfig || getDefaultHalfDayConfig();
  const [morningEnd, setMorningEnd] = useState(halfDayConfig.morningEnd);
  const [afternoonStart, setAfternoonStart] = useState(halfDayConfig.afternoonStart);
  const [halfDayError, setHalfDayError] = useState('');
  const dirty = morningEnd !== halfDayConfig.morningEnd || afternoonStart !== halfDayConfig.afternoonStart;

  function handleExportJSON() {
    exportJSON().catch((err) => alert('Erreur lors de l\u2019export : ' + err.message));
  }

  function handleExportSchedule() {
    exportExcel(state.data, 'schedule');
  }

  function handleExportMediators() {
    exportExcel(state.data, 'mediators');
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null;
    setSelectedFile(file);
  }

  async function handleImport() {
    if (!selectedFile) return;
    try {
      // Try JSON import first, fall back to Excel
      if (selectedFile.name.endsWith('.json') || selectedFile.name.endsWith('.gz')) {
        const data = await importJSON(selectedFile);
        commit(data, COMMIT_LABELS.jsonImport);
      } else {
        await importExcel(selectedFile);
      }
    } catch (e) {
      alert('Erreur import: ' + (e as Error).message);
    }
  }

  function handleResetDemo() {
    if (
      confirm(
        "⚠️ Charger les données de démonstration va SUPPRIMER toutes vos données actuelles.\n\nCette action est irréversible. Faites une sauvegarde JSON d'abord.\n\nContinuer ?"
      )
    ) {
      resetData();
    }
  }

  function handleClearData() {
    const scope: string[] = ['réservations', 'absences', 'plannings'];
    if (clearMediators) scope.push('médiateurs');
    if (clearOffers) scope.push('offres');
    const ok = confirm(
      `⚠️ Nettoyer les données va SUPPRIMER définitivement : ${scope.join(', ')}.\n\n` +
      `Cette action est irréversible.\n\n` +
      `Sauvegardez vos données au format JSON AVANT de continuer ` +
      `(bouton « 💾 Sauvegarde JSON (complète) » de cette page).\n\n` +
      `Continuer ?`
    );
    if (!ok) return;
    const backup = confirm(
      'Avez-vous fait une sauvegarde JSON de vos données ?\n\n' +
      'OK = Oui, nettoyer maintenant\n' +
      'Annuler = Non, je fais d\'abord ma sauvegarde'
    );
    if (!backup) return;
    commit(clearPlanningData(state.data, { clearMediators, clearOffers }), COMMIT_LABELS.clearData);
  }

  function handleSaveHalfDay() {
    const validation = validateHalfDayConfig({ morningEnd, afternoonStart });
    if (!validation.ok) {
      setHalfDayError(validation.error);
      return;
    }
    setHalfDayError('');
    const config = { morningEnd, afternoonStart };
    // A boundary change re-derives the times of unfinished absences so the
    // daily view and the valorisation use the new boundaries (same semantics
    // as the former header settings popup).
    const next = {
      ...state.data,
      halfDayConfig: config,
      absences: migrateAbsencesToConfig(state.data.absences, config),
    };
    commit(next, 'Configuration des demi-journées');
  }

  return (
    <div className="view active">
      <div className="toolbar">
        <div className="toolbar-left">
          <h2>Configuration</h2>
        </div>
        <span className="toolbar-note">
          Données et demi-journées. L'import Secutix quotidien reste dans l'en-tête, à portée de main.
        </span>
      </div>

      <div className="config-container">
        {/* ============ Espaces ============ */}
        <SpacesSection />

        {/* ============ Données ============ */}
        <section className="config-section" aria-labelledby="config-data-title">
          <div className="config-section-head">
            <h3 id="config-data-title">Données</h3>
            <span className="section-hint">
              Export JSON.gz, import de sauvegarde, suppression des données et données de démonstration.
            </span>
          </div>
          <div className="config-body">
            <div className="io-card">
              <h2>Exporter</h2>
              <p>Exportez les données du planning ou la liste des médiateurs.</p>
              <div className="io-actions">
                <button className="btn btn-primary" id="btn-export-schedule" onClick={handleExportSchedule}>
                  📊 Exporter le planning (Excel)
                </button>
                <button className="btn btn-secondary" id="btn-export-mediators" onClick={handleExportMediators}>
                  👥 Exporter les médiateurs (Excel)
                </button>
                <button className="btn btn-secondary" id="btn-export-json" onClick={handleExportJSON}>
                  💾 Sauvegarde JSON (complète)
                </button>
              </div>
              <div className="io-hint">La sauvegarde JSON inclut toutes les données (médiateurs, offres, créneaux, absences).</div>
            </div>

            <div className="io-card">
              <h2>Importer</h2>
              <p>Importez un fichier JSON de sauvegarde ou un fichier Excel.</p>
              <div className="io-actions">
                <input
                  type="file"
                  id="import-file"
                  accept=".json,.gz,.xlsx,.xls"
                  onChange={handleFileChange}
                />
                <span className="import-filename" id="import-filename">
                  {selectedFile ? selectedFile.name : 'Aucun fichier sélectionné'}
                </span>
                <button
                  className="btn btn-primary"
                  id="btn-import-execute"
                  disabled={!selectedFile}
                  onClick={handleImport}
                >
                  Importer
                </button>
              </div>
              <div className="io-hint">
                ⚠️ L'import remplace toutes les données actuelles. Faites une sauvegarde JSON d'abord.
              </div>
            </div>

            <div className="io-card">
              <h2>Nettoyer les données</h2>
              <p>Supprime les données de planification. Les médiateurs et les offres sont conservés par défaut.</p>
              <div className="io-actions io-clear-options">
                <label className="io-clear-option">
                  <input
                    type="checkbox"
                    checked={clearMediators}
                    onChange={(e) => setClearMediators(e.target.checked)}
                  />
                  Supprimer aussi les médiateurs
                </label>
                <label className="io-clear-option">
                  <input
                    type="checkbox"
                    checked={clearOffers}
                    onChange={(e) => setClearOffers(e.target.checked)}
                  />
                  Supprimer aussi les offres
                </label>
                <button
                  className="btn btn-danger"
                  id="btn-clear-data"
                  onClick={handleClearData}
                >
                  🧹 Nettoyer les données
                </button>
              </div>
              <div className="io-hint">
                ⚠️ Action irréversible. Faites d'abord une <strong>sauvegarde JSON complète</strong> avec le
                bouton « 💾 Sauvegarde JSON (complète) » de la page Exporter. Les réglages d'affichage
                (masquage dynamique) ne sont pas concernés.
              </div>
            </div>

            <div className="io-card">
              <h2>Données de démonstration</h2>
              <p>Rechargez les données de démonstration pour tester l'application.</p>
              <div className="io-actions">
                <button
                  className="btn btn-secondary"
                  id="btn-load-demo"
                  onClick={handleResetDemo}
                >
                  🔄 Charger les données de démonstration
                </button>
              </div>
              <div className="io-hint">
                ⚠️ Cette action supprime toutes les données actuelles et les remplace par les données de démonstration.
              </div>
            </div>
          </div>
        </section>

        {/* ============ Demi-journées ============ */}
        <section className="config-section" aria-labelledby="config-halfday-title">
          <div className="config-section-head">
            <h3 id="config-halfday-title">Demi-journées</h3>
            <span className="section-hint">
              Bornes utilisées par la vue quotidienne et la valorisation.
            </span>
          </div>
          <div className="config-body">
            <div className="halfday-row">
              <label htmlFor="halfday-morning-end">Fin de matinée</label>
              <input
                id="halfday-morning-end"
                className="time-input"
                type="time"
                value={morningEnd}
                aria-label="Heure de fin de matinée"
                onChange={(e) => setMorningEnd(e.target.value)}
              />
              <label htmlFor="halfday-afternoon-start">Début d'après-midi</label>
              <input
                id="halfday-afternoon-start"
                className="time-input"
                type="time"
                value={afternoonStart}
                aria-label="Heure de début d'après-midi"
                onChange={(e) => setAfternoonStart(e.target.value)}
              />
              <button
                className="btn btn-primary"
                id="btn-save-halfday"
                onClick={handleSaveHalfDay}
              >
                Enregistrer
              </button>
              {halfDayError && (
                <span className="form-error" role="alert">⚠ {halfDayError}</span>
              )}
            </div>
            <p className="section-hint config-note">
              Les réglages enregistrés bornent les demi-journées de la vue quotidienne et de la valorisation.
              {dirty && !halfDayError && ' (modifications non enregistrées)'}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
