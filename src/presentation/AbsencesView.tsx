// AbsencesView.tsx — Absence table + filter + add/edit/delete

import { useState, useMemo } from 'react';
import { useData, useCRUD } from './DataContext';
import { ABSENCE_TYPE_LABELS } from '../domain/models';
import { HALF_DAY_LABELS } from './types';
import AbsenceModal from './AbsenceModal';
import type { Absence } from '../domain/types';

export default function AbsencesView() {
  const { state, dispatch } = useData();
  const crud = useCRUD();
  const [editing, setEditing] = useState<Absence | null>(null);
  const [showModal, setShowModal] = useState(false);

  const filterMed = state.absenceFilter.mediatorId;

  const filtered = useMemo(() => {
    let absences = state.data.absences || [];
    if (filterMed) absences = absences.filter((a) => a.mediatorId === filterMed);
    return absences;
  }, [state.data.absences, filterMed]);

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

  return (
    <div className="view active">
      <div className="toolbar">
        <div className="toolbar-left">
          <h2>Absences</h2>
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
        </div>
        <div className="toolbar-right">
          <button className="btn btn-primary" id="btn-add-absence" onClick={openAdd}>
            + Ajouter une absence
          </button>
        </div>
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Médiateur</th>
              <th>Type</th>
              <th>Du</th>
              <th>Au</th>
              <th>Demi-journée</th>
              <th>Notes</th>
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
