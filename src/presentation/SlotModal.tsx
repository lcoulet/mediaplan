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
} from '../domain/models';
import type { Slot } from '../domain/types';
import Modal from './Modal';
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

  const [form, setForm] = useState<Slot>(() => slot || createSlot({ date: defaultDate }));

  // Mediator warning: overlap or absence for the first selected mediator
  const [selectedMediators, setSelectedMediators] = useState<string[]>(form.mediatorIds);

  const warning = useMemo(() => {
    const firstMed = selectedMediators[0];
    if (!firstMed) return '';
    const overlap = hasMediatorOverlap(firstMed, form.date, form.startTime, form.endTime, state.data.slots, form.id);
    const absent = !isMediatorAvailable(firstMed, form.date, form.startTime, form.endTime, state.data.absences);
    if (overlap) return '⚠️ Ce médiateur a déjà un créneau à cet horaire';
    if (absent) return '🚫 Ce médiateur est absent à ce créneau';
    return '';
  }, [selectedMediators, form.date, form.startTime, form.endTime, form.id, state.data.slots, state.data.absences]);

  function setField<K extends keyof Slot>(key: K, value: Slot[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleMediatorChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const selected = Array.from(e.target.selectedOptions).map((o) => o.value).filter(Boolean);
    setSelectedMediators(selected);
  }

  function handleDelete() {
    if (!slot) return;
    crud({ type: 'DELETE_SLOT', id: slot.id });
    onClose();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

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

  // Build mediator options with overlap/absence indicators
  const mediatorOptions = useMemo(() => {
    return state.data.mediators.map((m) => {
      const overlap = hasMediatorOverlap(m.id, form.date, form.startTime, form.endTime, state.data.slots, form.id);
      const absent = !isMediatorAvailable(m.id, form.date, form.startTime, form.endTime, state.data.absences);
      let label = `${m.firstName} ${m.lastName}`;
      if (overlap) label += ' ⚠️ Conflit horaire';
      else if (absent) label += ' 🚫 Absent';
      return { id: m.id, label, overlap, selected: selectedMediators.includes(m.id) };
    });
  }, [state.data.mediators, state.data.slots, state.data.absences, form.date, form.startTime, form.endTime, form.id, selectedMediators]);

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
              <span className="detail-value">{offer ? offer.name : '—'}</span>
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
            <select
              multiple
              size={5}
              value={selectedMediators}
              onChange={handleMediatorChange}
            >
              {mediatorOptions.map((opt) => (
                <option key={opt.id} value={opt.id} disabled={opt.overlap}>
                  {opt.label}
                </option>
              ))}
            </select>
            <div className="form-hint">
              {warning ? (
                <span className="warning-text">{warning}</span>
              ) : (
                'Ctrl+clic pour sélectionner plusieurs'
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
  const originInfo = form.origin === 'imported' ? (
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
          >
            <option value="">— Choisir —</option>
            {state.data.offers.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Médiateurs</label>
          <select
            multiple
            size={5}
            value={selectedMediators}
            onChange={handleMediatorChange}
          >
            {mediatorOptions.map((opt) => (
              <option key={opt.id} value={opt.id} disabled={opt.overlap}>
                {opt.label}
              </option>
            ))}
          </select>
          <div className="form-hint">
            {warning ? (
              <span className="warning-text">{warning}</span>
            ) : (
              'Ctrl+clic pour sélectionner plusieurs'
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
            />
          </div>
          <div className="form-group">
            <label>Fin *</label>
            <input
              type="time"
              value={form.endTime}
              onChange={(e) => setField('endTime', e.target.value)}
              required
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
          {isEdit && (
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
