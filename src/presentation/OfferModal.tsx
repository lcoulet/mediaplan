// OfferModal.tsx — Add/edit offer form

import { useState } from 'react';
import { useCRUD, useData } from './DataContext';
import { createOffer } from '../domain/models';
import type { Offer } from '../domain/types';
import Modal from './Modal';

interface Props {
  offer: Offer | null;
  onClose: () => void;
}

export default function OfferModal({ offer, onClose }: Props) {
  const crud = useCRUD();
  const { state } = useData();
  // Locked planning: only setup/teardown durations remain editable
  // (coordinators adjust logistics without touching the booking data)
  const durationsOnly = state.locked;
  const isEdit = !!offer;

  const [form, setForm] = useState<Offer>(() => offer || createOffer());

  function setField<K extends keyof Offer>(key: K, value: Offer[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (durationsOnly && !isEdit) return; // cannot create an offer when locked
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
    if (isEdit) {
      if (durationsOnly) {
        // Locked: update ONLY the setup/teardown durations on the stored offer
        crud({
          type: 'UPDATE_OFFER',
          offer: { ...offer!, setupTime: o.setupTime, teardownTime: o.teardownTime },
        });
      } else {
        crud({ type: 'UPDATE_OFFER', offer: o });
      }
    } else {
      crud({ type: 'ADD_OFFER', offer: o });
    }
    onClose();
  }

  const disabled = durationsOnly && isEdit;

  return (
    <Modal
      title={isEdit ? (durationsOnly ? "Durées de mise en place / rangement" : "Modifier l'offre") : 'Nouvelle offre'}
      onClose={onClose}
    >
      <form id="form-offer" onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Nom *</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setField('name', e.target.value)}
            disabled={disabled}
            required
          />
        </div>
        <div className="form-group">
          <label>Description</label>
          <textarea
            value={form.description}
            onChange={(e) => setField('description', e.target.value)}
            disabled={disabled}
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
              disabled={disabled}
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
              disabled={disabled}
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
              disabled={disabled}
            />
          </div>
          <div className="form-group">
            <label>Couleur</label>
            <div className="color-picker">
              <input
                type="color"
                value={form.color || '#2c6e49'}
                onChange={(e) => setField('color', e.target.value)}
                disabled={disabled}
              />
              <span className="color-preview" style={{ background: form.color || '#2c6e49' }}></span>
            </div>
          </div>
        </div>
        {disabled && (
          <p className="form-hint">
            🔒 Planning verrouillé : seules les durées de mise en place et de rangement
            sont modifiables.
          </p>
        )}
        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Annuler</button>
          {(isEdit || !durationsOnly) && (
            <button type="submit" className="btn btn-primary">
              {disabled ? 'Enregistrer les durées' : isEdit ? 'Enregistrer' : 'Ajouter'}
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}
