// AbsenceModal.tsx — Add/edit absence form

import { useState } from 'react';
import { useCRUD } from './DataContext';
import { createAbsence, ABSENCE_TYPE_LABELS } from '../domain/models';
import type { Absence } from '../domain/types';
import Modal from './Modal';
import { AbsenceTypeValues, AbsenceHalfDayValues, HALF_DAY_LABELS } from './types';

interface Props {
  absence: Absence | null;
  onClose: () => void;
}

export default function AbsenceModal({ absence, onClose }: Props) {
  const { state } = useData();
  const crud = useCRUD();
  const isEdit = !!absence;

  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState<Absence>(() =>
    absence || createAbsence({ startDate: today, endDate: today })
  );

  function setField<K extends keyof Absence>(key: K, value: Absence[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleDelete() {
    if (!absence) return;
    crud({ type: 'DELETE_ABSENCE', id: absence.id });
    onClose();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const a: Absence = {
      ...form,
      notes: form.notes.trim(),
    };
    if (isEdit) {
      crud({ type: 'UPDATE_ABSENCE', absence: a });
    } else {
      crud({ type: 'ADD_ABSENCE', absence: a });
    }
    onClose();
  }

  return (
    <Modal title={isEdit ? "Modifier l'absence" : 'Nouvelle absence'} onClose={onClose}>
      <form id="form-absence" onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Médiateur *</label>
          <select
            value={form.mediatorId}
            onChange={(e) => setField('mediatorId', e.target.value)}
            required
          >
            <option value="">— Choisir —</option>
            {state.data.mediators.map((m) => (
              <option key={m.id} value={m.id}>
                {m.firstName} {m.lastName}
              </option>
            ))}
          </select>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Du *</label>
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => setField('startDate', e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Au *</label>
            <input
              type="date"
              value={form.endDate}
              onChange={(e) => setField('endDate', e.target.value)}
              required
            />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Type</label>
            <select
              value={form.type}
              onChange={(e) => setField('type', e.target.value as Absence['type'])}
            >
              {AbsenceTypeValues.map((val) => (
                <option key={val} value={val}>{ABSENCE_TYPE_LABELS[val]}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Demi-journée</label>
            <select
              value={form.halfDay}
              onChange={(e) => setField('halfDay', e.target.value as Absence['halfDay'])}
            >
              {AbsenceHalfDayValues.map((val) => (
                <option key={val} value={val}>{HALF_DAY_LABELS[val]}</option>
              ))}
            </select>
          </div>
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
            <button type="button" className="btn btn-danger" id="absence-delete" onClick={handleDelete}>
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
