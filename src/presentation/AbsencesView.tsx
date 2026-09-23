// AbsencesView.tsx — Absence table + filter + add/edit/delete + sort

import { useState, useMemo } from 'react';
import { useData, useCRUD } from './DataContext';
import { ABSENCE_TYPE_LABELS } from '../domain/models';
import { HALF_DAY_LABELS } from './types';
import AbsenceModal from './AbsenceModal';
import type { Absence } from '../domain/types';

type SortConfig = {
  key: keyof Absence | null;
  direction: 'asc' | 'desc' | null;
};

export default function AbsencesView() {
  const { state, dispatch } = useData();
  const crud = useCRUD();
  const [editing, setEditing] = useState<Absence | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showPast, setShowPast] = useState(false);

  const filterMed = state.absenceFilter.mediatorId;
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortConfig>({ key: 'startDate', direction: 'asc' });

  // Get today's date string for filtering
  const todayStr = new Date().toISOString().slice(0, 10);

  const filtered = useMemo(() => {
    let absences = state.data.absences || [];
    
    // Apply filters
    if (filterMed) absences = absences.filter((a) => a.mediatorId === filterMed);
    if (!showPast) {
      absences = absences.filter((a) => a.endDate >= todayStr);
    }
    if (search) {
      const s = search.toLowerCase();
      absences = absences.filter(
        (a) =>
          a.notes.toLowerCase().includes(s) ||
          (ABSENCE_TYPE_LABELS[a.type] || a.type).toLowerCase().includes(s) ||
          (HALF_DAY_LABELS[a.halfDay] || a.halfDay).toLowerCase().includes(s)
      );
    }
    
    // Apply sorting
    if (sort.key && sort.direction) {
      absences = [...absences].sort((a, b) => {
        const aVal = a[sort.key!]?.toString().toLowerCase() || '';
        const bVal = b[sort.key!]?.toString().toLowerCase() || '';
        if (aVal < bVal) return sort.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sort.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    
    return absences;
  }, [state.data.absences, filterMed, showPast, todayStr, search, sort]);

  function handleDelete(id: string) {
    if (!confirm('Supprimer cette absence ?')) return;
    crud({ type: 'DELETE_ABSENCE', id });
  }

  function openAdd() {
    setEditing(null);
    setShowModal(true);
  }

  function openEdit(a: Absence) {
    setEditing(a);
    setShowModal(true);
  }

  function clearFilters() {
    dispatch({ type: 'SET_ABSENCE_FILTER_MEDIATOR', mediatorId: '' });
    setShowPast(false);
    setSearch('');
    setSort({ key: 'startDate', direction: 'asc' });
  }

  function handleSort(key: keyof Absence) {
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

  function getSortIndicator(key: keyof Absence) {
    if (sort.key !== key) return null;
    if (sort.direction === 'asc') return '↑';
    if (sort.direction === 'desc') return '↓';
    return null;
  }

  const hasFilters = filterMed !== '' || showPast || search !== '' || sort.key !== 'startDate' || sort.direction !== 'asc';

  return (
    <div className="view active">
      <div className="toolbar">
        <div className="toolbar-left">
          <h2>Absences</h2>
          <input
            type="text"
            className="search-input"
            id="search-absence"
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="select"
            id="filter-absence-mediator"
            value={filterMed}
            onChange={(e) =>
              dispatch({ type: 'SET_ABSENCE_FILTER_MEDIATOR', mediatorId: e.target.value })
            }
          >
            <option value="">Tous les médiateurs</option>
            {state.data.mediators.map((m) => (
              <option key={m.id} value={m.id}>
                {m.firstName} {m.lastName}
              </option>
            ))}
          </select>
          <label className="toggle-switch">
            <input
              type="checkbox"
              id="toggle-show-past"
              checked={showPast}
              onChange={(e) => setShowPast(e.target.checked)}
            />
            <span className="toggle-slider"></span>
            <span className="toggle-label">Absences passées</span>
          </label>
          {hasFilters && (
            <button className="btn btn-secondary" onClick={clearFilters}>
              Supprimer filtres
            </button>
          )}
        </div>
        <div className="toolbar-right">
          <button className="btn btn-primary" id="btn-add-absence" onClick={openAdd} title="Ajouter une absence (N)">
            + Ajouter une absence
          </button>
        </div>
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th onClick={() => handleSort('mediatorId')}>
                Médiateur {getSortIndicator('mediatorId')}
              </th>
              <th onClick={() => handleSort('type')}>
                Type {getSortIndicator('type')}
              </th>
              <th onClick={() => handleSort('startDate')}>
                Du {getSortIndicator('startDate')}
              </th>
              <th onClick={() => handleSort('endDate')}>
                Au {getSortIndicator('endDate')}
              </th>
              <th onClick={() => handleSort('halfDay')}>
                Demi-journée {getSortIndicator('halfDay')}
              </th>
              <th onClick={() => handleSort('notes')}>
                Notes {getSortIndicator('notes')}
              </th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="absences-tbody">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <div className="empty-state">
                    <p>Aucune absence enregistrée</p>
                    <button className="btn btn-primary" onClick={openAdd}>+ Ajouter une absence</button>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((a) => {
                const mediator = state.data.mediators.find((m) => m.id === a.mediatorId);
                const medName = mediator ? `${mediator.firstName} ${mediator.lastName}` : '—';
                return (
                  <tr key={a.id}>
                    <td>{medName}</td>
                    <td>
                      <span className={`badge absence-badge-${a.type}`}>
                        {ABSENCE_TYPE_LABELS[a.type] || a.type}
                      </span>
                    </td>
                    <td>{a.startDate}</td>
                    <td>{a.endDate}</td>
                    <td>{HALF_DAY_LABELS[a.halfDay] || a.halfDay}</td>
                    <td>{a.notes || '—'}</td>
                    <td className="actions-cell">
                      <button className="action-btn" title="Modifier" onClick={() => openEdit(a)}>✏</button>
                      <button className="action-btn" title="Supprimer" onClick={() => handleDelete(a.id)}>🗑</button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <AbsenceModal
          absence={editing}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
