// MediatorsView.tsx — Searchable mediator table + add/edit/delete

import { useState, useMemo } from 'react';
import { useData, useCRUD } from './DataContext';
import MediatorModal from './MediatorModal';
import type { Mediator } from '../domain/types';

export default function MediatorsView() {
  const { state } = useData();
  const crud = useCRUD();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Mediator | null>(null);
  const [showModal, setShowModal] = useState(false);

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    let mediators = state.data.mediators;
    if (s) {
      mediators = mediators.filter(
        (m) =>
          m.lastName.toLowerCase().includes(s) ||
          m.firstName.toLowerCase().includes(s)
      );
    }
    return mediators;
  }, [state.data.mediators, search]);

  function handleDelete(id: string) {
    if (!confirm('Supprimer ce médiateur ?')) return;
    crud({ type: 'DELETE_MEDIATOR', id });
  }

  function openAdd() {
    setEditing(null);
    setShowModal(true);
  }

  function openEdit(m: Mediator) {
    setEditing(m);
    setShowModal(true);
  }

  return (
    <div className="view active">
      <div className="toolbar">
        <div className="toolbar-left">
          <h2>Médiateurs</h2>
          <input
            type="text"
            className="search-input"
            id="search-mediator"
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="toolbar-right">
          <button className="btn btn-primary" id="btn-add-mediator" onClick={openAdd}>
            + Ajouter un médiateur
          </button>
        </div>
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Nom</th>
              <th>Prénom</th>
              <th>Email</th>
              <th>Téléphone</th>
              <th>Compétences</th>
              <th>Statut</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="mediators-tbody">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <div className="empty-state">
                    <p>Aucun médiateur</p>
                    <button className="btn btn-primary" onClick={openAdd}>+ Ajouter un médiateur</button>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((m) => {
                const skills = m.skills
                  .map((sid) => state.data.offers.find((o) => o.id === sid)?.name)
                  .filter(Boolean)
                  .join(', ');
                return (
                  <tr key={m.id}>
                    <td>
                      <span className="mediator-color-dot" style={{ background: m.color || '#ccc' }}></span>{' '}
                      {m.lastName}
                    </td>
                    <td>{m.firstName}</td>
                    <td>{m.email || '—'}</td>
                    <td>{m.phone || '—'}</td>
                    <td>{skills || '—'}</td>
                    <td>
                      <span className={`badge ${m.active ? 'badge-active' : 'badge-inactive'}`}>
                        {m.active ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td className="actions-cell">
                      <button className="action-btn" title="Modifier" onClick={() => openEdit(m)}>✏</button>
                      <button className="action-btn" title="Supprimer" onClick={() => handleDelete(m.id)}>🗑</button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <MediatorModal
          mediator={editing}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
