// OffersView.tsx — Offer table + add/edit/delete + sort + filter

import { useState, useMemo } from 'react';
import { useData, useCRUD } from './DataContext';
import OfferModal from './OfferModal';
import OfferPill from './OfferPill';
import type { Offer } from '../domain/types';

type SortConfig = {
  key: keyof Offer | null;
  direction: 'asc' | 'desc' | null;
};

export default function OffersView() {
  const { state } = useData();
  const crud = useCRUD();
  const [editing, setEditing] = useState<Offer | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortConfig>({ key: null, direction: null });

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    let offers = state.data.offers;
    
    // Apply search filter
    if (s) {
      offers = offers.filter(
        (o) =>
          o.name.toLowerCase().includes(s) ||
          o.description.toLowerCase().includes(s) ||
          o.location.toLowerCase().includes(s)
      );
    }
    
    // Apply sorting
    if (sort.key && sort.direction) {
      offers = [...offers].sort((a, b) => {
        const aVal = a[sort.key!]?.toString().toLowerCase() || '';
        const bVal = b[sort.key!]?.toString().toLowerCase() || '';
        if (aVal < bVal) return sort.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sort.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    
    return offers;
  }, [state.data.offers, search, sort]);

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

  function clearFilters() {
    setSearch('');
    setSort({ key: null, direction: null });
  }

  function handleSort(key: keyof Offer) {
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

  function getSortIndicator(key: keyof Offer) {
    if (sort.key !== key) return null;
    if (sort.direction === 'asc') return '↑';
    if (sort.direction === 'desc') return '↓';
    return null;
  }

  const hasFilters = search !== '' || sort.key !== null;

  return (
    <div className="view active">
      <div className="toolbar">
        <div className="toolbar-left">
          <h2>Offres</h2>
          <input
            type="text"
            className="search-input"
            id="search-offer"
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {hasFilters && (
            <button className="btn btn-secondary" onClick={clearFilters}>
              Supprimer filtres
            </button>
          )}
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
              <th onClick={() => handleSort('name')}>
                Nom {getSortIndicator('name')}
              </th>
              <th onClick={() => handleSort('description')}>
                Description {getSortIndicator('description')}
              </th>
              <th onClick={() => handleSort('duration')}>
                Durée {getSortIndicator('duration')}
              </th>
              <th onClick={() => handleSort('capacity')}>
                Capacité {getSortIndicator('capacity')}
              </th>
              <th onClick={() => handleSort('location')}>
                Lieu {getSortIndicator('location')}
              </th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="offers-tbody">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <div className="empty-state">
                    <p>Aucune offre</p>
                    <button className="btn btn-primary" onClick={openAdd}>+ Ajouter une offre</button>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((o) => (
                <tr key={o.id}>
                  <td>
                    <OfferPill offer={o} />{' '}
                    <strong>{o.name}</strong>
                  </td>
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
