// ImportExportView.tsx — Export buttons + import file picker

import { useState, useRef } from 'react';
import { useData } from './DataContext';
import { exportJSON, importJSON } from '../infrastructure/store';
import { exportExcel, importExcel } from '../infrastructure/excel';

export default function ImportExportView() {
  const { state, commit, resetData } = useData();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        commit(data);
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

  return (
    <div className="view active">
      <div className="toolbar">
        <div className="toolbar-left">
          <h2>Import / Export</h2>
        </div>
      </div>

      <div className="import-export-container">
        {/* Export card */}
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

        {/* Import card */}
        <div className="io-card">
          <h2>Importer</h2>
          <p>Importez un fichier JSON de sauvegarde ou un fichier Excel.</p>
          <div className="io-actions">
            <input
              type="file"
              id="import-file"
              ref={fileInputRef}
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

        {/* Demo data card */}
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
    </div>
  );
}
