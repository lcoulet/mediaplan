// SlotModal.tsx — Slot creation/editing (full + mediator-only modes)

import { useState, useMemo } from 'react';
import { useData, useCRUD } from './DataContext';
import {
  createSlot,
  isMediatorAvailable,
  hasMediatorOverlap,
  STATUS_LABELS,
  ORIGIN_LABELS,
  formatImportDate,
  mediatorConfirmedForOffer,
  mediatorLearningOffer,
} from '../domain/models';
import type { Slot } from '../domain/types';
import Modal from './Modal';
import MultiSelect from './MultiSelect';
import OfferPill from './OfferPill';
import { SlotStatusValues } from './types';

interface Props {
  slot: Slot | null;
  mediatorOnly: boolean;
  defaultDate: string;
  onClose: () => void;
}

export default function SlotModal({ slot, mediatorOnly, defaultDate, onClose }: Props) {
  const { state } = useData();
  const crud = useCRUD();
  const isEdit = !!slot;
  const locked = state.locked;

  const [form, setForm] = useState<Slot>(() => slot || createSlot({ date: defaultDate }));

  // Default setup/teardown from the offer when the slot has none yet
  const currentOffer = state.data.offers.find((o) => o.id === form.offerId);
  const setupDefault = form.setupTime ?? currentOffer?.setupTime ?? 0;
  const teardownDefault = form.teardownTime ?? currentOffer?.teardownTime ?? 0;

  // Mediator warning: overlap or absence for the first selected mediator
  const [selectedMediators, setSelectedMediators] = useState<string[]>(form.mediatorIds);

  // Setup/teardown inputs (string for the number inputs; '' = use default)
  const [setupTimeInput, setSetupTimeInput] = useState<string>(String(setupDefault));
  const [teardownTimeInput, setTeardownTimeInput] = useState<string>(String(teardownDefault));

  const warning = useMemo(() => {
    const firstMed = selectedMediators[0];
    if (!firstMed) return '';
    const overlap = hasMediatorOverlap(firstMed, form.date, form.startTime, form.endTime, state.data.slots, form.id);
    const absent = !isMediatorAvailable(firstMed, form.date, form.startTime, form.endTime, state.data.absences, state.data.halfDayConfig);
    if (overlap) return '⚠️ Ce médiateur a déjà un créneau à cet horaire';
    if (absent) return '🚫 Ce médiateur est absent à ce créneau';
    return '';
  }, [selectedMediators, form.date, form.startTime, form.endTime, form.id, state.data.slots, state.data.absences]);

  function setField<K extends keyof Slot>(key: K, value: Slot[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleMediatorsChange(selected: string[]) {
    setSelectedMediators(selected);
  }

  function handleDelete() {
    if (!slot) return;
    crud({ type: 'DELETE_SLOT', id: slot.id });
    onClose();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Setup/teardown are editable regardless of lock state
    const setupVal = setupTimeInput !== '' ? parseInt(setupTimeInput) || 0 : setupDefault;
    const teardownVal = teardownTimeInput !== '' ? parseInt(teardownTimeInput) || 0 : teardownDefault;

    const updated: Slot = {
      ...form,
      offerId: form.offerId,
      mediatorIds: selectedMediators,
      date: form.date,
      startTime: form.startTime,
      endTime: form.endTime,
      participantCount: parseInt(String(form.participantCount)) || 0,
      status: form.status,
      notes: form.notes.trim(),
      setupTime: setupVal,
      teardownTime: teardownVal,
    };

    if (isEdit) {
      // Mark imported slots as modified after import when edited
      if (updated.origin === 'imported') {
        updated.modifiedAfterImport = true;
      }
      crud({ type: 'UPDATE_SLOT', slot: updated });
    } else {
      updated.origin = 'manual';
      crud({ type: 'ADD_SLOT', slot: updated });
    }
    onClose();
  }

  // Build mediator options with overlap/absence/competence indicators
  // Sort: confirmed first, then learning, then none — alphabetical within each group
  const mediatorOptions = useMemo(() => {
    const offerId = form.offerId;
    return state.data.mediators.map((m) => {
      const overlap = hasMediatorOverlap(m.id, form.date, form.startTime, form.endTime, state.data.slots, form.id);
      const absent = !isMediatorAvailable(m.id, form.date, form.startTime, form.endTime, state.data.absences, state.data.halfDayConfig);
      const confirmed = mediatorConfirmedForOffer(m, offerId);
      const learning = mediatorLearningOffer(m, offerId);

      let label = `${m.firstName} ${m.lastName}`;

      // Add competence indicators
      if (confirmed) {
        label += ' ✅';
      } else if (learning) {
        label += ' 📚';
      } else if (offerId) {
        label += ' ⚠️ Incompétent';
      }

      // Add overlap/absence indicators
      if (overlap) label += ' — Conflit horaire';
      else if (absent) label += ' — Absent';

      const competenceRank = confirmed ? 0 : learning ? 1 : 2;

      return {
        value: m.id,
        label,
        color: m.color,
        isDisabled: overlap,
        competenceStatus: confirmed ? 'confirmed' : learning ? 'learning' : null,
        competenceRank,
        sortName: `${m.lastName} ${m.firstName}`.toLowerCase(),
      };
    }).sort((a, b) => {
      if (a.competenceRank !== b.competenceRank) return a.competenceRank - b.competenceRank;
      return a.sortName.localeCompare(b.sortName);
    });
  }, [state.data.mediators, state.data.slots, state.data.absences, form.date, form.startTime, form.endTime, form.id, form.offerId]);

  const offer = state.data.offers.find((o) => o.id === form.offerId);

  // ---- Mediator-only mode (locked calendar) ----
  if (mediatorOnly) {
    const originBadge = form.origin === 'imported' ? (
      <>
        <span className="badge origin-badge-imported">📥 {ORIGIN_LABELS.imported}</span>
        {form.modifiedAfterImport && <span className="badge origin-badge-modified">✏ Modifié après import</span>}
      </>
    ) : (
      <span className="badge origin-badge-manual">✋ {ORIGIN_LABELS.manual}</span>
    );

    return (
      <Modal title="Assigner un médiateur" onClose={onClose}>
        <form id="form-slot" onSubmit={handleSubmit}>
          <div className="detail-view">
            <div className="detail-row">
              <span className="detail-label">Offre</span>
              <span className="detail-value">
                {offer ? <OfferPill offer={offer} /> : '—'}
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Date</span>
              <span className="detail-value">
                {new Date(form.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Horaire</span>
              <span className="detail-value">{form.startTime} – {form.endTime}</span>
            </div>
            <div className="form-row" style={{ marginTop: '12px' }}>
              <div className="form-group">
                <label>Mise en place (min)</label>
                <input
                  type="number"
                  value={setupTimeInput}
                  min={0}
                  step={5}
                  onChange={(e) => setSetupTimeInput(e.target.value)}
                  title="Durée de préparation avant la réservation"
                />
                <div className="form-hint">Par défaut : {setupDefault} min (offre)</div>
              </div>
              <div className="form-group">
                <label>Rangement (min)</label>
                <input
                  type="number"
                  value={teardownTimeInput}
                  min={0}
                  step={5}
                  onChange={(e) => setTeardownTimeInput(e.target.value)}
                  title="Durée de rangement après la réservation"
                />
                <div className="form-hint">Par défaut : {teardownDefault} min (offre)</div>
              </div>
            </div>
            <div className="detail-row">
              <span className="detail-label">Statut</span>
              <span className="detail-value">
                <span className={`badge badge-${form.status}`}>
                  {STATUS_LABELS.slot[form.status] || form.status}
                </span>
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Origine</span>
              <span className="detail-value">{originBadge}</span>
            </div>
          </div>
          <hr />
          <div className="form-group">
            <label>Médiateurs</label>
            <MultiSelect
              options={mediatorOptions}
              value={selectedMediators}
              onChange={handleMediatorsChange}
              ariaLabel="Médiateurs"
              placeholder="Rechercher un médiateur…"
              noOptionsMessage="Aucun médiateur disponible"
            />
            <div className="form-hint">
              {warning ? (
                <span className="warning-text">{warning}</span>
              ) : (
                'Cliquez pour ajouter, × pour retirer'
              )}
            </div>
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Annuler</button>
            <button type="submit" className="btn btn-primary">Enregistrer</button>
          </div>
        </form>
      </Modal>
    );
  }

  // ---- Full edit mode ----
  const isImported = form.origin === 'imported';
  const originInfo = isImported ? (
    <div className="origin-info">
      <span className="badge origin-badge-imported">📥 {ORIGIN_LABELS.imported}</span>
      {form.modifiedAfterImport && <span className="badge origin-badge-modified">✏ Modifié après import</span>}
      {form.importSource && (
        <div className="origin-detail">Source : <strong>{form.importSource}</strong></div>
      )}
      {form.importedAt && (
        <div className="origin-detail">Importé le : {formatImportDate(form.importedAt)}</div>
      )}
    </div>
  ) : (
    <div className="origin-info">
      <span className="badge origin-badge-manual">✋ {ORIGIN_LABELS.manual}</span>
    </div>
  );

  return (
    <Modal title={isEdit ? 'Modifier le créneau' : 'Nouveau créneau'} onClose={onClose}>
      <form id="form-slot" onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Offre *</label>
          <select
            value={form.offerId}
            onChange={(e) => setField('offerId', e.target.value)}
            required
            disabled={isImported && locked}
          >
            <option value="">— Choisir —</option>
            {state.data.offers.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
          {offer && (
            <div className="form-hint">
              <OfferPill offer={offer} id="slot-offer-pill" />
            </div>
          )}
        </div>
        <div className="form-group">
          <label>Médiateurs</label>
          <MultiSelect
            options={mediatorOptions}
            value={selectedMediators}
            onChange={handleMediatorsChange}
            ariaLabel="Médiateurs"
            placeholder="Rechercher un médiateur…"
            noOptionsMessage="Aucun médiateur disponible"
          />
          <div className="form-hint">
            {warning ? (
              <span className="warning-text">{warning}</span>
            ) : (
              'Cliquez pour ajouter, × pour retirer'
            )}
          </div>
        </div>
        <div className="form-group">
          <label>Date *</label>
          <input
            type="date"
            value={form.date}
            onChange={(e) => setField('date', e.target.value)}
            required
            disabled={isImported && locked}
          />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Début *</label>
            <input
              type="time"
              value={form.startTime}
              onChange={(e) => setField('startTime', e.target.value)}
              required
              disabled={isImported && locked}
            />
          </div>
          <div className="form-group">
            <label>Fin *</label>
            <input
              type="time"
              value={form.endTime}
              onChange={(e) => setField('endTime', e.target.value)}
              required
              disabled={isImported && locked}
            />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Participants</label>
            <input
              type="number"
              value={form.participantCount}
              min={0}
              onChange={(e) => setField('participantCount', parseInt(e.target.value) || 0)}
            />
          </div>
          <div className="form-group">
            <label>Statut</label>
            <select
              value={form.status}
              onChange={(e) => setField('status', e.target.value as Slot['status'])}
            >
              {SlotStatusValues.map((val) => (
                <option key={val} value={val}>{STATUS_LABELS.slot[val]}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Mise en place (min)</label>
            <input
              type="number"
              value={setupTimeInput}
              min={0}
              step={5}
              onChange={(e) => setSetupTimeInput(e.target.value)}
              title="Durée de préparation avant la réservation"
            />
            <div className="form-hint">Par défaut : {setupDefault} min (offre)</div>
          </div>
          <div className="form-group">
            <label>Rangement (min)</label>
            <input
              type="number"
              value={teardownTimeInput}
              min={0}
              step={5}
              onChange={(e) => setTeardownTimeInput(e.target.value)}
              title="Durée de rangement après la réservation"
            />
            <div className="form-hint">Par défaut : {teardownDefault} min (offre)</div>
          </div>
        </div>
        <div className="form-group">
          <label>Origine</label>
          {originInfo}
        </div>
        <div className="form-group">
          <label>Notes</label>
          <textarea
            value={form.notes}
            onChange={(e) => setField('notes', e.target.value)}
          ></textarea>
        </div>
        <div className="form-actions">
          {isEdit && !(isImported && locked) && (
            <button type="button" className="btn btn-danger" id="slot-delete" onClick={handleDelete}>
              Supprimer
            </button>
          )}
          <button type="button" className="btn btn-secondary" onClick={onClose}>Annuler</button>
          <button type="submit" className="btn btn-primary">{isEdit ? 'Enregistrer' : 'Ajouter'}</button>
        </div>
      </form>
    </Modal>
  );
}
