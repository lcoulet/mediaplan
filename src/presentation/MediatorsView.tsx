// MediatorsView.tsx — Searchable mediator table + add/edit/delete + sort + filter

import { useState, useMemo } from 'react';
import { useData, useCRUD } from './DataContext';
import MediatorModal from './MediatorModal';
import OfferPill from './OfferPill';
import type { Mediator, Offer } from '../domain/types';

type SortConfig = {
  key: keyof Mediator | null;
  direction: 'asc' | 'desc' | null;
};

export default function MediatorsView() {
  const { state } = useData();
  const crud = useCRUD();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Mediator | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showActiveOnly, setShowActiveOnly] = useState(false);
  const [sort, setSort] = useState<SortConfig>({ key: null, direction: null });

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    let mediators = state.data.mediators;
    
    // Apply filters
    if (showActiveOnly) {
      mediators = mediators.filter(m => m.active);
    }
    if (s) {
      mediators = mediators.filter(
        (m) =>
          m.lastName.toLowerCase().includes(s) ||
          m.firstName.toLowerCase().includes(s) ||
          m.email.toLowerCase().includes(s) ||
          m.phone.toLowerCase().includes(s)
      );
    }
    
    // Apply sorting
    if (sort.key && sort.direction) {
      mediators = [...mediators].sort((a, b) => {
        const aVal = a[sort.key!]?.toString().toLowerCase() || '';
        const bVal = b[sort.key!]?.toString().toLowerCase() || '';
        if (aVal < bVal) return sort.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sort.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    
    return mediators;
  }, [state.data.mediators, search, showActiveOnly, sort]);

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

  function clearFilters() {
    setSearch('');
    setShowActiveOnly(false);
    setSort({ key: null, direction: null });
  }

  function handleSort(key: keyof Mediator) {
    if (sort.key === key) {
      if (sort.direction === 'asc') {
        setSort({ key, direction: 'desc' });
      } else if (sort.direction === 'desc') {
        setSort({ key: null, direction: null });
      } else {
        setSort({ key, direction: 'asc' });
      }
    } else {
      setSort({ key, direction: 'asc' });
    }
  }

  function getSortIndicator(key: keyof Mediator) {
    if (sort.key !== key) return null;
    if (sort.direction === 'asc') return '↑';
    if (sort.direction === 'desc') return '↓';
    return null;
  }

  const hasFilters = search !== '' || showActiveOnly || sort.key !== null;

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
          <label className="toggle-switch">
            <input
              type="checkbox"
              id="filter-active-only"
              checked={showActiveOnly}
              onChange={(e) => setShowActiveOnly(e.target.checked)}
            />
            <span className="toggle-slider"></span>
            <span className="toggle-label">Actifs seulement</span>
          </label>
          {hasFilters && (
            <button className="btn btn-secondary" onClick={clearFilters}>
              Supprimer filtres
            </button>
          )}
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
              <th onClick={() => handleSort('lastName')}>
                Nom {getSortIndicator('lastName')}
              </th>
              <th onClick={() => handleSort('firstName')}>
                Prénom {getSortIndicator('firstName')}
              </th>
              <th onClick={() => handleSort('email')}>
                Email {getSortIndicator('email')}
              </th>
              <th onClick={() => handleSort('phone')}>
                Téléphone {getSortIndicator('phone')}
              </th>
              <th>Compétences</th>
              <th onClick={() => handleSort('active')}>
                Statut {getSortIndicator('active')}
              </th>
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
                const skillOffers = m.competences
                  .map((c) => state.data.offers.find((o) => o.id === c.offerId))
                  .filter((o): o is Offer => !!o);
                return (
                  <tr key={m.id}>
                    <td>
                      <span className="mediator-color-dot" style={{ background: m.color || '#ccc' }}></span>{' '}
                      {m.lastName}
                    </td>
                    <td>{m.firstName}</td>
                    <td>{m.email || '—'}</td>
                    <td>{m.phone || '—'}</td>
                    <td>
                      {skillOffers.length > 0 ? (
                        skillOffers.map((o) => (
                          <OfferPill key={o.id} offer={o} />
                        ))
                      ) : (
                        '—'
                      )}
                    </td>
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
