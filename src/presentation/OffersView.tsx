// OffersView.tsx — Offer table + add/edit/delete

import { useState } from 'react';
import { useData, useCRUD } from './DataContext';
import OfferModal from './OfferModal';
import type { Offer } from '../domain/types';

export default function OffersView() {
  const { state } = useData();
  const crud = useCRUD();
  const [editing, setEditing] = useState<Offer | null>(null);
  const [showModal, setShowModal] = useState(false);

  function handleDelete(id: string) {
    if (!confirm('Supprimer cette offre ?')) return;
    crud({ type: 'DELETE_OFFER', id });
  }

  function openAdd() {
    setEditing(null);
    setShowModal(true);
  }

  function openEdit(o: Offer) {
    setEditing(o);
    setShowModal(true);
  }

  return (
    <div className="view active">
      <div className="toolbar">
        <div className="toolbar-left">
          <h2>Offres</h2>
        </div>
        <div className="toolbar-right">
          <button className="btn btn-primary" id="btn-add-offer" onClick={openAdd}>
            + Ajouter une offre
          </button>
        </div>
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Nom</th>
              <th>Description</th>
              <th>Durée</th>
              <th>Capacité</th>
              <th>Lieu</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="offers-tbody">
            {state.data.offers.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <div className="empty-state">
                    <p>Aucune offre</p>
                    <button className="btn btn-primary" onClick={openAdd}>+ Ajouter une offre</button>
                  </div>
                </td>
              </tr>
            ) : (
              state.data.offers.map((o) => (
                <tr key={o.id}>
                  <td><strong>{o.name}</strong></td>
                  <td>{o.description || '—'}</td>
                  <td>{o.duration} min</td>
                  <td>{o.capacity}</td>
                  <td>{o.location || '—'}</td>
                  <td className="actions-cell">
                    <button className="action-btn" title="Modifier" onClick={() => openEdit(o)}>✏</button>
                    <button className="action-btn" title="Supprimer" onClick={() => handleDelete(o.id)}>🗑</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <OfferModal
          offer={editing}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
