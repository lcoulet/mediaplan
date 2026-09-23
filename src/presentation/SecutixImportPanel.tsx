// SecutixImportPanel.tsx — Secutix synchronization card (Import/Export view)
//
// Flow: pick the export file → read + normalize (domain) → decide for every
// THÈME label that matches no offer (map it to an existing offer with a
// searchable picker, create a suggested offer, or ignore the bookings) →
// apply the plan in a single history entry → summary with one-click undo.

import { useMemo, useState } from 'react';
import { useData } from './DataContext';
import { readSecutixFile } from '../infrastructure/secutix-reader';
import {
  normalizeSecutixRows,
  reconcileOffers,
  resolveSecutixChoices,
  suggestOfferFromLabel,
  buildSecutixImportPlan,
  applySecutixImport,
  type SecutixNormalization,
  type SecutixImportPlan,
  type SecutixLabelChoice,
} from '../domain/secutix-import';
import SingleSelect from './SingleSelect';
import { parseLocalDate } from '../domain/models';
import type { Offer } from '../domain/types';

// Sentinel select values (the domain choice itself is structured)
const CREATE_CHOICE = '__create__';
const IGNORE_CHOICE = '__ignore__';

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
  // Secutix label → select value: '' (pending), offerId (map),
  // CREATE_CHOICE or IGNORE_CHOICE
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ plan: SecutixImportPlan; ignoredCount: number } | null>(null);

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

  // Labels needing a decision: those matching no existing offer (stable list,
  // independent of the choices — decided rows stay editable)
  const decisionLabels = useMemo(
    () =>
      normalization
        ? reconcileOffers(normalization.bookings, state.data.offers).unmatchedLabels
        : [],
    [normalization, state.data.offers]
  );

  // Offers to create from the labels mapped to "create" (suggested values,
  // editable later in the offers view)
  const createdOffers = useMemo<Offer[]>(() => {
    if (!normalization) return [];
    return decisionLabels
      .filter((label) => choices[label] === CREATE_CHOICE)
      .map((label) => suggestOfferFromLabel(label, normalization.bookings));
  }, [normalization, decisionLabels, choices]);

  // The domain choice for each label: map (existing or created offer) / ignore.
  // "create" needs no explicit choice: the created offer auto-matches its label.
  const structuredChoices = useMemo<Record<string, SecutixLabelChoice>>(() => {
    const out: Record<string, SecutixLabelChoice> = {};
    for (const label of decisionLabels) {
      const value = choices[label];
      if (value === IGNORE_CHOICE) out[label] = { action: 'ignore' };
      else if (value && value !== CREATE_CHOICE) out[label] = { action: 'map', offerId: value };
    }
    return out;
  }, [decisionLabels, choices]);

  const resolution = useMemo(
    () =>
      normalization
        ? resolveSecutixChoices(
            normalization.bookings,
            state.data.offers,
            createdOffers,
            structuredChoices
          )
        : null,
    [normalization, state.data.offers, createdOffers, structuredChoices]
  );

  const effectiveOffers = useMemo(
    () => [...state.data.offers, ...createdOffers],
    [state.data.offers, createdOffers]
  );

  const plan = useMemo(
    () =>
      resolution
        ? buildSecutixImportPlan(resolution.matched, effectiveOffers, state.data.slots)
        : null,
    [resolution, effectiveOffers, state.data.slots]
  );

  // Display range spans ALL bookings (matched, pending or ignored)
  const fullRange = useMemo(() => {
    if (!normalization || normalization.bookings.length === 0) return null;
    const dates = normalization.bookings.map((b) => b.date);
    return { start: dates.reduce((a, b) => (a < b ? a : b)), end: dates.reduce((a, b) => (a > b ? a : b)) };
  }, [normalization]);

  const pendingLabels = resolution?.pendingLabels ?? [];
  const readyToImport = pendingLabels.length === 0 && !!plan;

  function handleChoice(label: string, value: string) {
    setChoices((prev) => ({ ...prev, [label]: value }));
  }

  function handleImport() {
    if (!readyToImport || !plan || !resolution) return;
    const next = applySecutixImport(state.data, plan, createdOffers);
    // One history entry: a single undo reverts the whole import
    dispatch({ type: 'SET_DATA', data: next });
    commit(next);
    setResult({ plan, ignoredCount: resolution.ignoredCount });
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
        met à jour les modifiées, supprime celles qui ont disparu du fichier (annulées
        côté Secutix). Les affectations de médiateurs sont conservées.
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

          {decisionLabels.length > 0 && (
            <div className="secutix-mapping">
              <h3>
                Libellés Secutix à recoller ({decisionLabels.length}) — rattachez chaque
                libellé à une offre, créez l'offre, ou ignorez les réservations
                {pendingLabels.length > 0 && (
                  <> · <strong>{pendingLabels.length} en attente</strong></>
                )}
              </h3>
              {decisionLabels.map((label) => {
                const count = normalization.bookings.filter((b) => b.theme === label).length;
                const display = label || '(sans libellé Secutix)';
                const choice = choices[label] || '';
                const created = createdOffers.find((o) => o.secutixLabel === label);
                return (
                  <div key={label || '__empty__'} className="secutix-label-row">
                    <label className="secutix-label">
                      {display}
                      <span className="secutix-label-count">({count})</span>
                    </label>
                    <div className="secutix-picker">
                      <SingleSelect
                        options={[
                          { value: IGNORE_CHOICE, label: '🚫 Ignorer — ne pas importer' },
                          ...(label
                            ? [{ value: CREATE_CHOICE, label: `➕ Créer l'offre « ${label} »` }]
                            : []),
                          ...[...state.data.offers]
                            .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
                            .map((o) => ({ value: o.id, label: o.name, color: o.color })),
                        ]}
                        value={choice}
                        onChange={(value) => handleChoice(label, value)}
                        ariaLabel={`Offre pour ${display}`}
                        placeholder="— Choisir —"
                        noOptionsMessage="Aucune offre trouvée"
                      />
                      {choice === CREATE_CHOICE && created && (
                        <div className="form-hint secutix-choice-hint">
                          Créera « {created.name} » — {created.duration} min
                          {created.location ? ` — ${created.location}` : ''} (modifiable ensuite)
                        </div>
                      )}
                      {choice === IGNORE_CHOICE && (
                        <div className="form-hint secutix-choice-hint">
                          {count} réservation(s) ne seront pas importées
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {plan && (
            <div className="secutix-plan-preview">
              <span className="plan-stat plan-create">➕ {plan.create.length} à ajouter</span>
              <span className="plan-stat plan-update">✏ {plan.update.length} à mettre à jour</span>
              <span className="plan-stat plan-removed">
                🗑️ {plan.remove.length} à supprimer (absentes du fichier)
              </span>
              {createdOffers.length > 0 && (
                <span className="plan-stat plan-create">📂 {createdOffers.length} offre(s) créée(s)</span>
              )}
              {!!resolution?.ignoredCount && (
                <span className="plan-stat plan-ignored">
                  ⏭️ {resolution.ignoredCount} ignorée(s) — non importée(s)
                </span>
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
            ✅ Import terminé : <strong>{result.plan.create.length}</strong> réservation(s)
            ajoutée(s), <strong>{result.plan.update.length}</strong> mise(s) à jour,{' '}
            <strong>{result.plan.remove.length}</strong> supprimée(s) (annulées côté Secutix)
            {result.ignoredCount > 0 && (
              <> · <strong>{result.ignoredCount}</strong> ignorée(s)</>
            )}
            .
          </p>
          <p>Plage couverte : {formatRange(result.plan.coveredRange)}.</p>
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
