// OfferModal.tsx — Add/edit offer form

import { useState } from 'react';
import { useCRUD } from './DataContext';
import { createOffer } from '../domain/models';
import type { Offer } from '../domain/types';
import Modal from './Modal';

interface Props {
  offer: Offer | null;
  onClose: () => void;
}

export default function OfferModal({ offer, onClose }: Props) {
  const crud = useCRUD();
  const isEdit = !!offer;

  const [form, setForm] = useState<Offer>(() => offer || createOffer());

  function setField<K extends keyof Offer>(key: K, value: Offer[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const o: Offer = {
      ...form,
      name: form.name.trim(),
      description: form.description.trim(),
      duration: parseInt(String(form.duration)) || 60,
      capacity: parseInt(String(form.capacity)) || 30,
      location: form.location.trim(),
      setupTime: form.setupTime ? parseInt(String(form.setupTime)) || 0 : 0,
      teardownTime: form.teardownTime ? parseInt(String(form.teardownTime)) || 0 : 0,
    };
    crud(isEdit ? { type: 'UPDATE_OFFER', offer: o } : { type: 'ADD_OFFER', offer: o });
    onClose();
  }

  return (
    <Modal title={isEdit ? "Modifier l'offre" : 'Nouvelle offre'} onClose={onClose}>
      <form id="form-offer" onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Nom *</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setField('name', e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label>Description</label>
          <textarea
            value={form.description}
            onChange={(e) => setField('description', e.target.value)}
          ></textarea>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Durée (min) *</label>
            <input
              type="number"
              value={form.duration}
              min={5}
              step={5}
              onChange={(e) => setField('duration', parseInt(e.target.value) || 60)}
              required
            />
          </div>
          <div className="form-group">
            <label>Capacité *</label>
            <input
              type="number"
              value={form.capacity}
              min={1}
              onChange={(e) => setField('capacity', parseInt(e.target.value) || 30)}
              required
            />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Mise en place (min)</label>
            <input
              type="number"
              value={form.setupTime ?? 0}
              min={0}
              step={5}
              onChange={(e) => setField('setupTime', parseInt(e.target.value) || 0)}
              title="Durée de préparation avant la réservation"
            />
          </div>
          <div className="form-group">
            <label>Rangement (min)</label>
            <input
              type="number"
              value={form.teardownTime ?? 0}
              min={0}
              step={5}
              onChange={(e) => setField('teardownTime', parseInt(e.target.value) || 0)}
              title="Durée de rangement après la réservation"
            />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Lieu</label>
            <input
              type="text"
              value={form.location}
              onChange={(e) => setField('location', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Couleur</label>
            <div className="color-picker">
              <input
                type="color"
                value={form.color || '#2c6e49'}
                onChange={(e) => setField('color', e.target.value)}
              />
              <span className="color-preview" style={{ background: form.color || '#2c6e49' }}></span>
            </div>
          </div>
        </div>
        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Annuler</button>
          <button type="submit" className="btn btn-primary">{isEdit ? 'Enregistrer' : 'Ajouter'}</button>
        </div>
      </form>
    </Modal>
  );
}
