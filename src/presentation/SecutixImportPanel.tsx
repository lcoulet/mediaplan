// SecutixImportPanel.tsx — Secutix synchronization card (Import/Export view)
//
// Flow: pick the export file → read + normalize (domain) → map every
// THÈME label to an offer (existing, or create it) → apply the plan in a
// single history entry → summary with one-click undo.

import { useMemo, useState } from 'react';
import { useData } from './DataContext';
import { readSecutixFile } from '../infrastructure/secutix-reader';
import {
  normalizeSecutixRows,
  reconcileOffers,
  suggestOfferFromLabel,
  buildSecutixImportPlan,
  applySecutixImport,
  type SecutixNormalization,
  type SecutixImportPlan,
} from '../domain/secutix-import';
import { parseLocalDate } from '../domain/models';
import type { Offer } from '../domain/types';

const CREATE_CHOICE = '__create__';

function formatDay(isoDate: string): string {
  return parseLocalDate(isoDate).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatRange(range: { start: string; end: string } | null): string {
  if (!range) return '—';
  return range.start === range.end
    ? formatDay(range.start)
    : `du ${formatDay(range.start)} au ${formatDay(range.end)}`;
}

export default function SecutixImportPanel() {
  const { state, dispatch, commit, undo } = useData();
  const [normalization, setNormalization] = useState<SecutixNormalization | null>(null);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  // Secutix label → chosen offer id, or CREATE_CHOICE to create the offer
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [result, setResult] = useState<SecutixImportPlan | null>(null);

  function reset() {
    setNormalization(null);
    setFileName('');
    setError('');
    setChoices({});
    setResult(null);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (!file) return;
    try {
      const rows = await readSecutixFile(file);
      const norm = normalizeSecutixRows(rows);
      if (norm.bookings.length === 0) {
        setError(
          'Aucune réservation importable dans ce fichier (vérifiez qu\u2019il s\u2019agit bien d\u2019un export Secutix « visitPlanning »).'
        );
        return;
      }
      setNormalization(norm);
      setFileName(file.name);
      setError('');
      setChoices({});
    } catch (err) {
      setError('Erreur de lecture du fichier : ' + (err as Error).message);
    }
  }

  // Offers to create from the labels mapped to "create" (suggested values,
  // editable later in the offers view)
  const createdOffers = useMemo<Offer[]>(() => {
    if (!normalization) return [];
    return normalization.bookings
      .map((b) => b.theme)
      .filter((theme, i, all) => all.indexOf(theme) === i) // distinct
      .filter((theme) => choices[theme] === CREATE_CHOICE)
      .map((theme) => suggestOfferFromLabel(theme, normalization.bookings));
  }, [normalization, choices]);

  const effectiveOffers = useMemo(
    () => [...state.data.offers, ...createdOffers],
    [state.data.offers, createdOffers]
  );

  const reconciliation = useMemo(
    () => (normalization ? reconcileOffers(normalization.bookings, effectiveOffers) : null),
    [normalization, effectiveOffers]
  );

  const plan = useMemo(
    () =>
      reconciliation
        ? buildSecutixImportPlan(reconciliation.matched, effectiveOffers, state.data.slots)
        : null,
    [reconciliation, effectiveOffers, state.data.slots]
  );

  // Display range spans ALL bookings (matched or not yet mapped)
  const fullRange = useMemo(() => {
    if (!normalization || normalization.bookings.length === 0) return null;
    const dates = normalization.bookings.map((b) => b.date);
    return { start: dates.reduce((a, b) => (a < b ? a : b)), end: dates.reduce((a, b) => (a > b ? a : b)) };
  }, [normalization]);

  const unmatchedLabels = reconciliation?.unmatchedLabels ?? [];
  const readyToImport = unmatchedLabels.length === 0 && !!plan;

  function setChoice(label: string, value: string) {
    setChoices((prev) => ({ ...prev, [label]: value }));
  }

  function handleImport() {
    if (!readyToImport || !plan) return;
    const next = applySecutixImport(state.data, plan, createdOffers);
    // One history entry: a single undo reverts the whole import
    dispatch({ type: 'SET_DATA', data: next });
    commit(next);
    setResult(plan);
  }

  function handleUndo() {
    undo();
    reset();
  }

  return (
    <div className="io-card">
      <h2>Import Secutix (synchronisation)</h2>
      <p>
        Synchronise le planning avec un export Secutix : ajoute les nouvelles réservations,
        met à jour les modifiées, désalloue (annule) celles qui ont disparu du fichier.
        Les affectations de médiateurs sont conservées.
      </p>

      {!result && (
        <div className="io-actions">
          <input
            type="file"
            id="secutix-file"
            accept=".xlsx,.xls"
            onChange={handleFile}
          />
          {fileName && <span className="import-filename">{fileName}</span>}
        </div>
      )}

      {error && <div className="io-hint import-error">⚠️ {error}</div>}

      {normalization && !result && (
        <div className="secutix-review">
          <div className="secutix-summary">
            <strong>{normalization.bookings.length}</strong> réservations importables —{' '}
            {formatRange(fullRange)}
            {normalization.accessRightRows > 0 && (
              <> · {normalization.accessRightRows} lignes « droit d'accès » ignorées</>
            )}
            {normalization.duplicateRowCount > 0 && (
              <> · {normalization.duplicateRowCount} doublons ignorés</>
            )}
          </div>

          {unmatchedLabels.length > 0 && (
            <div className="secutix-mapping">
              <h3>
                Libellés Secutix à recoller ({unmatchedLabels.length}) — l'import est bloqué
                tant que chaque libellé n'est pas rattaché à une offre
              </h3>
              {unmatchedLabels.map((label) => {
                const count = reconciliation!.unmatchedBookings.filter((b) => b.theme === label).length;
                const display = label || '(sans libellé Secutix)';
                return (
                  <div key={label || '__empty__'} className="secutix-label-row">
                    <label className="secutix-label">
                      {display}
                      <span className="secutix-label-count">({count})</span>
                    </label>
                    <select
                      value={choices[label] || ''}
                      onChange={(e) => setChoice(label, e.target.value)}
                    >
                      <option value="">— Choisir une offre —</option>
                      {state.data.offers.map((o) => (
                        <option key={o.id} value={o.id}>{o.name}</option>
                      ))}
                      {label && <option value={CREATE_CHOICE}>➕ Créer l'offre « {label} »</option>}
                    </select>
                  </div>
                );
              })}
            </div>
          )}

          {plan && (
            <div className="secutix-plan-preview">
              <span className="plan-stat plan-create">➕ {plan.create.length} à ajouter</span>
              <span className="plan-stat plan-update">✏ {plan.update.length} à mettre à jour</span>
              <span className="plan-stat plan-deallocate">
                🚫 {plan.deallocate.length} à désallouer (annulées côté Secutix)
              </span>
              {createdOffers.length > 0 && (
                <span className="plan-stat plan-create">📂 {createdOffers.length} offre(s) créée(s)</span>
              )}
            </div>
          )}

          <div className="io-actions">
            <button
              type="button"
              className="btn btn-primary"
              id="btn-secutix-import"
              disabled={!readyToImport}
              onClick={handleImport}
            >
              Importer
            </button>
            <button type="button" className="btn btn-secondary" onClick={reset}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className="secutix-result">
          <p>
            ✅ Import terminé : <strong>{result.create.length}</strong> réservation(s)
            ajoutée(s), <strong>{result.update.length}</strong> mise(s) à jour,{' '}
            <strong>{result.deallocate.length}</strong> désallouée(s) (annulées).
          </p>
          <p>Plage couverte : {formatRange(result.coveredRange)}.</p>
          <div className="io-actions">
            <button type="button" className="btn btn-danger" onClick={handleUndo}>
              Annuler l'import (revenir à l'état précédent)
            </button>
            <button type="button" className="btn btn-secondary" onClick={reset}>
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
