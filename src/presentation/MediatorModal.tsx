// MediatorModal.tsx — Add/edit mediator form

import { useState } from 'react';
import { useData, useCRUD } from './DataContext';
import { createMediator } from '../domain/models';
import type { Mediator } from '../domain/types';
import Modal from './Modal';
import MultiSelect from './MultiSelect';
import type { MultiSelectOption } from './MultiSelect';

interface Props {
  mediator: Mediator | null;
  onClose: () => void;
}

export default function MediatorModal({ mediator, onClose }: Props) {
  const { state } = useData();
  const crud = useCRUD();
  const isEdit = !!mediator;

  const [form, setForm] = useState<Mediator>(() => mediator || createMediator());

  function setField<K extends keyof Mediator>(key: K, value: Mediator[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSkillsChange(selected: string[]) {
    setForm((prev) => ({ ...prev, skills: selected }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const m: Mediator = {
      ...form,
      lastName: form.lastName.trim(),
      firstName: form.firstName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      notes: form.notes.trim(),
    };
    if (isEdit) {
      crud({ type: 'UPDATE_MEDIATOR', mediator: m });
    } else {
      crud({ type: 'ADD_MEDIATOR', mediator: m });
    }
    onClose();
  }

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
        <div className="form-group">
          <label>Compétences</label>
          {state.data.offers.length === 0 ? (
            <span style={{ color: 'var(--color-text-muted)' }}>Aucune offre définie</span>
          ) : (
            <MultiSelect
              options={state.data.offers.map((o): MultiSelectOption => ({
                value: o.id,
                label: o.name,
              }))}
              value={form.skills}
              onChange={handleSkillsChange}
              ariaLabel="Compétences"
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
