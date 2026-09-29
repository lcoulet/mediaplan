// MediatorModal.tsx — Add/edit mediator form

import { useMemo, useState } from 'react';
import { useData } from './DataContext';
import { createMediator, normalizeCompetences } from '../domain/models';
import { computeQuarterlyBalance, quarterOfDate, validateQuota } from '../domain/hours';
import { cycleQuotaSummary, quotaNumberFromInput } from '../domain/cycle-edit';
import type { Mediator, QuarterlyQuota } from '../domain/types';
import Modal from './Modal';
import MultiSelect from './MultiSelect';
import type { MultiSelectOption } from './MultiSelect';

// Predefined suggestions for the free-text contract type (spec:
// contract-type.feature) and working-time arrangement.
const CONTRACT_TYPE_SUGGESTIONS = ['temps plein', 'mi-temps (temps partiel)', 'stagiaire'];
const ARRANGEMENT_SUGGESTIONS = ['temps partiel', 'mi-temps thérapeutique'];

interface Props {
  mediator: Mediator | null;
  onClose: () => void;
}

export default function MediatorModal({ mediator, onClose }: Props) {
  const { state, dispatch, commit } = useData();
  const isEdit = !!mediator;

  const [form, setForm] = useState<Mediator>(() => mediator || createMediator());

  // ---- Quarterly quota editing (visible only when arrangement is set) ----
  // Quotas of the CURRENT year for this mediator; the form edits hours +
  // effectiveFrom. Empty hours = quarter not configured (no tracking).
  const currentYear = new Date().getFullYear();
  const [quotaForm, setQuotaForm] = useState<Record<1 | 2 | 3 | 4, { hours: string; effectiveFrom: string }>>(() => {
    const init = {
      1: { hours: '', effectiveFrom: `${currentYear}-01-01` },
      2: { hours: '', effectiveFrom: `${currentYear}-04-01` },
      3: { hours: '', effectiveFrom: `${currentYear}-07-01` },
      4: { hours: '', effectiveFrom: `${currentYear}-10-01` },
    } as Record<1 | 2 | 3 | 4, { hours: string; effectiveFrom: string }>;
    for (const q of state.data.quotas) {
      if (q.mediatorId === mediator?.id && q.year === currentYear && (q.quarter === 1 || q.quarter === 2 || q.quarter === 3 || q.quarter === 4)) {
        init[q.quarter] = { hours: String(q.hours), effectiveFrom: q.effectiveFrom };
      }
    }
    return init;
  });
  const [quotaError, setQuotaError] = useState('');

  const arrangementSet = !!(form.arrangement?.trim());

  // Current-quarter balance (counter), null when nothing is tracked.
  // The quota form values are OVERLAID on the stored quotas so the counter
  // (and its overrun warning) reflects the in-form edits live.
  const currentQuarter = quarterOfDate(new Date());
  const effectiveQuotas = useMemo(() => {
    const overlay = (q: typeof state.data.quotas[number]) => {
      if (q.mediatorId !== (mediator?.id ?? form.id) || q.year !== currentYear) return q;
      if (q.quarter !== 1 && q.quarter !== 2 && q.quarter !== 3 && q.quarter !== 4) return q;
      const edited = quotaForm[q.quarter];
      const hours = quotaNumberFromInput(edited.hours);
      return hours === null ? q : { ...q, hours, effectiveFrom: edited.effectiveFrom };
    };
    return state.data.quotas.map(overlay);
  }, [state.data.quotas, mediator?.id, form.id, currentYear, quotaForm]);
  const balance = useMemo(
    () =>
      arrangementSet
        ? computeQuarterlyBalance(
            { ...form, arrangement: form.arrangement?.trim() || undefined },
            state.data.slots,
            effectiveQuotas,
            state.data.valorisation,
            currentYear,
            currentQuarter
          )
        : null,
    [arrangementSet, form, state.data.slots, effectiveQuotas, state.data.valorisation, currentYear, currentQuarter]
  );
  const quotaSummary = balance ? cycleQuotaSummary(form, balance, currentQuarter, currentYear) : null;

  function setField<K extends keyof Mediator>(key: K, value: Mediator[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function setQuotaField(quarter: 1 | 2 | 3 | 4, patch: Partial<{ hours: string; effectiveFrom: string }>) {
    setQuotaForm((prev) => ({ ...prev, [quarter]: { ...prev[quarter], ...patch } }));
    setQuotaError('');
  }

  function handleConfirmedCompetencesChange(selected: string[]) {
    setForm((prev) => ({
      ...prev,
      competences: normalizeCompetences([
        ...prev.competences.filter(c => c.status === 'learning'),
        ...selected.map(offerId => ({ offerId, status: 'confirmed' as const })),
      ]),
    }));
  }

  function handleLearningCompetencesChange(selected: string[]) {
    setForm((prev) => ({
      ...prev,
      competences: normalizeCompetences([
        ...prev.competences.filter(c => c.status === 'confirmed'),
        ...selected.map(offerId => ({ offerId, status: 'learning' as const })),
      ]),
    }));
  }

  function buildQuotas(mediatorId: string, savedMediator: Mediator): QuarterlyQuota[] | { error: string } {
    // Quotas apply ONLY with an arrangement; without one nothing is tracked
    if (!savedMediator.arrangement) {
      // Removing the arrangement stops the tracking entirely: existing
      // quotas of the current year are dropped from the form's perspective
      return state.data.quotas.filter((q) => q.mediatorId !== mediatorId);
    }
    const quotas: QuarterlyQuota[] = state.data.quotas.filter((q) => !(q.mediatorId === mediatorId && q.year === currentYear));
    for (const quarter of [1, 2, 3, 4] as const) {
      const { hours, effectiveFrom } = quotaForm[quarter];
      if (!hours.trim()) continue; // quarter not configured: no tracking
      const parsed = quotaNumberFromInput(hours);
      if (parsed === null) {
        return { error: 'Le quota d\u2019heures doit être un nombre positif (ex. 120 ou 120,5)' };
      }
      const quota: QuarterlyQuota = {
        id: state.data.quotas.find((q) => q.mediatorId === mediatorId && q.year === currentYear && q.quarter === quarter)?.id
          ?? `quota_${mediatorId}_${currentYear}_Q${quarter}`,
        mediatorId,
        year: currentYear,
        quarter,
        hours: parsed,
        effectiveFrom,
      };
      const v = validateQuota(savedMediator, quota);
      if (!v.ok) return { error: v.reason! };
      quotas.push(quota);
    }
    return quotas;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const m: Mediator = {
      ...form,
      lastName: form.lastName.trim(),
      firstName: form.firstName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      competences: normalizeCompetences(form.competences),
      notes: form.notes.trim(),
      // Optional free-text fields: empty string means "not set" (erasable)
      contractType: form.contractType?.trim() || undefined,
      arrangement: form.arrangement?.trim() || undefined,
    };
    // Validate quotas BEFORE saving anything (no partial save on error)
    const quotas = buildQuotas(m.id, m);
    if (typeof quotas === 'string') {
      setQuotaError(quotas);
      return;
    }
    if ('error' in quotas) {
      setQuotaError(quotas.error);
      return;
    }
    const next = { ...state.data, quotas };
    // Mediator + quotas are committed together in ONE undoable history entry
    const withMediator = isEdit
      ? { ...next, mediators: next.mediators.map((x) => (x.id === m.id ? m : x)) }
      : { ...next, mediators: [...next.mediators, m] };
    dispatch({ type: 'SET_DATA', data: withMediator });
    commit(withMediator, isEdit ? 'Médiateur modifié' : 'Médiateur ajouté');
    onClose();
  }

  // Get offer IDs for each competence status
  const confirmedOfferIds = form.competences
    .filter(c => c.status === 'confirmed')
    .map(c => c.offerId);
  const learningOfferIds = form.competences
    .filter(c => c.status === 'learning')
    .map(c => c.offerId);

  return (
    <Modal title={isEdit ? 'Modifier le médiateur' : 'Nouveau médiateur'} onClose={onClose}>
      <form id="form-mediator" onSubmit={handleSubmit}>
        <div className="form-row">
          <div className="form-group">
            <label>Nom *</label>
            <input
              type="text"
              value={form.lastName}
              onChange={(e) => setField('lastName', e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Prénom *</label>
            <input
              type="text"
              value={form.firstName}
              onChange={(e) => setField('firstName', e.target.value)}
              required
            />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setField('email', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Téléphone</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setField('phone', e.target.value)}
            />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Couleur</label>
            <div className="color-picker">
              <input
                type="color"
                value={form.color}
                onChange={(e) => setField('color', e.target.value)}
              />
              <span className="color-preview" style={{ background: form.color }}></span>
            </div>
          </div>
          <div className="form-group">
            <label>Statut</label>
            <select
              value={form.active ? 'true' : 'false'}
              onChange={(e) => setField('active', e.target.value === 'true')}
            >
              <option value="true">Actif</option>
              <option value="false">Inactif</option>
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="mediator-contract-type">
              Type de contrat <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}>(optionnel)</span>
            </label>
            <input
              id="mediator-contract-type"
              type="text"
              list="contract-type-suggestions"
              autoComplete="off"
              value={form.contractType ?? ''}
              onChange={(e) => setField('contractType', e.target.value)}
              placeholder="Choisissez une suggestion ou saisissez librement…"
            />
            <datalist id="contract-type-suggestions">
              {CONTRACT_TYPE_SUGGESTIONS.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
            <div className="form-hint">Champ libre — effacez la valeur pour retirer la pilule.</div>
          </div>
          <div className="form-group">
            <label htmlFor="mediator-arrangement">
              Aménagement du temps de travail <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}>(optionnel)</span>
            </label>
            <input
              id="mediator-arrangement"
              type="text"
              list="arrangement-suggestions"
              autoComplete="off"
              value={form.arrangement ?? ''}
              onChange={(e) => setField('arrangement', e.target.value)}
              placeholder="ex. temps partiel, mi-temps thérapeutique…"
            />
            <datalist id="arrangement-suggestions">
              {ARRANGEMENT_SUGGESTIONS.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
            <div className="form-hint">Déclenche le suivi du quota d'heures trimestriel.</div>
          </div>
        </div>

        {/* ===== Quarterly hour quota (only with an arrangement) ===== */}
        {arrangementSet && (
          <div className="quota-section">
            {/* Current-quarter counter */}
            {quotaSummary ? (
              <div
                className={`quota-counter${quotaSummary.overrun ? ' quota-overrun' : ''}`}
                role="status"
              >
                <strong>{quotaSummary.counter}</strong>
                <span className={`quota-balance${quotaSummary.overrun ? ' light-warning' : ''}`}>
                  {quotaSummary.balance}
                </span>
                {quotaSummary.carriedLabel && (
                  <span className="quota-carried">{quotaSummary.carriedLabel}</span>
                )}
              </div>
            ) : (
              <p className="form-hint quota-unconfigured">
                Quota non configuré pour le trimestre en cours (T{currentQuarter} {currentYear}) —
                renseignez un quota ci-dessous pour activer le suivi.
              </p>
            )}

            {/* Per-quarter quota fields (current year) */}
            <div className="quota-grid">
              {([1, 2, 3, 4] as const).map((quarter) => (
                <div key={quarter} className="quota-quarter">
                  <label htmlFor={`quota-hours-${quarter}`}>T{quarter} {currentYear} (heures)</label>
                  <input
                    id={`quota-hours-${quarter}`}
                    type="text"
                    inputMode="decimal"
                    placeholder="—"
                    value={quotaForm[quarter].hours}
                    onChange={(e) => setQuotaField(quarter, { hours: e.target.value })}
                  />
                  <label htmlFor={`quota-from-${quarter}`}>Date d'effet</label>
                  <input
                    id={`quota-from-${quarter}`}
                    type="date"
                    value={quotaForm[quarter].effectiveFrom}
                    onChange={(e) => setQuotaField(quarter, { effectiveFrom: e.target.value })}
                  />
                </div>
              ))}
            </div>
            <p className="form-hint">
              Trimestre vide = pas de suivi pour ce trimestre. Le solde (reliquat ou déficit)
              est reporté sur les trimestres suivants configurés.
            </p>
            {quotaError && <p className="warning-text" role="alert">{quotaError}</p>}
          </div>
        )}
        <div className="form-group">
          <label>Compétences confirmées</label>
          {state.data.offers.length === 0 ? (
            <span style={{ color: 'var(--color-text-muted)' }}>Aucune offre définie</span>
          ) : (
            <MultiSelect
              options={state.data.offers.map((o): MultiSelectOption => ({
                value: o.id,
                label: o.name,
                color: o.color,
              }))}
              value={confirmedOfferIds}
              onChange={handleConfirmedCompetencesChange}
              ariaLabel="Compétences confirmées"
              placeholder="Rechercher une offre…"
              noOptionsMessage="Aucune offre trouvée"
            />
          )}
        </div>
        <div className="form-group">
          <label>Compétences en apprentissage</label>
          {state.data.offers.length === 0 ? (
            <span style={{ color: 'var(--color-text-muted)' }}>Aucune offre définie</span>
          ) : (
            <MultiSelect
              options={state.data.offers.map((o): MultiSelectOption => ({
                value: o.id,
                label: o.name,
                color: o.color,
              }))}
              value={learningOfferIds}
              onChange={handleLearningCompetencesChange}
              ariaLabel="Compétences en apprentissage"
              placeholder="Rechercher une offre…"
              noOptionsMessage="Aucune offre trouvée"
            />
          )}
        </div>
        <div className="form-group">
          <label>Notes</label>
          <textarea
            value={form.notes}
            onChange={(e) => setField('notes', e.target.value)}
          ></textarea>
        </div>
        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Annuler</button>
          <button type="submit" className="btn btn-primary">{isEdit ? 'Enregistrer' : 'Ajouter'}</button>
        </div>
      </form>
    </Modal>
  );
}
