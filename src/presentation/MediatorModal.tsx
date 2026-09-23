// MediatorModal.tsx — Add/edit mediator form

import { useState } from 'react';
import { useData, useCRUD } from './DataContext';
import { createMediator, normalizeCompetences } from '../domain/models';
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
    };
    if (isEdit) {
      crud({ type: 'UPDATE_MEDIATOR', mediator: m });
    } else {
      crud({ type: 'ADD_MEDIATOR', mediator: m });
    }
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
