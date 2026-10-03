// SpacesSection.tsx — Espaces section of the Configuration view:
// CRUD of the space list using the domain functions (slice 1).
//
// Spec: test/features/spaces/spaces.feature (list management part) and
// configuration-view.feature (Espaces section).
// - Add form: validateSpace errors shown inline (name required, duplicate).
// - Rename: in-place edit (✎) with duplicate error inline; renameSpace makes
//   the referencing offers/slots follow.
// - Color: per-row color input, committed immediately (validateSpace format).
// - Delete: canDeleteSpace first — refused shows the spec message inline;
//   otherwise a confirmation dialog then removal.
// Every change flows through commit() (AppData snapshot → undoable).
// The row-edit state machine is UI glue, not unit-tested (convention).

import { useState } from 'react';
import { useData } from './DataContext';
import type { AppData } from '../domain/types';
import type { Space } from '../domain/types';
import {
  createSpace,
  validateSpace,
  renameSpace,
  canDeleteSpace,
  defaultSpacePalette,
  SECUTIX_SPACE_COLOR,
} from '../domain/spaces';

const SPACE_LABELS = {
  add: 'Espace ajouté',
  rename: 'Espace renommé',
  recolor: 'Couleur d\u2019espace modifiée',
  delete: 'Espace supprimé',
};

export default function SpacesSection() {
  const { state, dispatch, commit } = useData();
  const { spaces, offers, slots } = state.data;

  // Add form
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(defaultSpacePalette(spaces.length));
  const [addError, setAddError] = useState('');

  // Row editing: space id being renamed (in-place input)
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Per-row transient errors: space id -> message (delete refused, rename refused)
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

  // Delete confirmation: space pending deletion
  const [deletePending, setDeletePending] = useState<Space | null>(null);

  function setRowError(id: string, message: string) {
    setRowErrors((prev) => ({ ...prev, [id]: message }));
  }

  function clearRowError(id: string) {
    setRowErrors((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  // commitData: dispatch the next data so the in-memory state updates AND
  // commit it so localStorage + history capture the snapshot (undoable).
  function commitData(next: AppData, label: string) {
    dispatch({ type: 'SET_DATA', data: next });
    commit(next, label);
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const validation = validateSpace(spaces, { name: newName, color: newColor });
    if (!validation.ok) {
      setAddError(validation.errors[0]);
      return;
    }
    const space = createSpace(newName, newColor);
    commitData({ ...state.data, spaces: [...spaces, space] }, SPACE_LABELS.add);
    setAddError('');
    setNewName('');
    // Cycle the default color for the next space
    setNewColor(defaultSpacePalette(spaces.length + 1));
  }

  function handleColorChange(space: Space, color: string) {
    // Native color input always yields a valid #RRGGBB; still validate the
    // domain contract before committing. excludeId is REQUIRED: without it
    // the space validates against itself and is seen as its own name
    // duplicate, silently rejecting every color change (fixed bug).
    const validation = validateSpace(spaces, {
      name: space.name,
      color,
      excludeId: space.id,
    });
    if (!validation.ok) return;
    clearRowError(space.id);
    commitData(
      {
        ...state.data,
        spaces: spaces.map((s) => (s.id === space.id ? { ...s, color } : s)),
      },
      SPACE_LABELS.recolor
    );
  }

  function startRename(space: Space) {
    clearRowError(space.id);
    setRenamingId(space.id);
    setRenameValue(space.name);
  }

  function commitRename(space: Space) {
    const result = renameSpace(spaces, offers, slots, space.id, renameValue);
    if (!result.ok) {
      setRowError(space.id, result.errors[0]);
      return;
    }
    setRenamingId(null);
    clearRowError(space.id);
    commitData(
      {
        ...state.data,
        spaces: result.spaces,
        offers: result.offers,
        slots: result.slots,
      },
      SPACE_LABELS.rename
    );
  }

  function cancelRename() {
    if (renamingId) clearRowError(renamingId);
    setRenamingId(null);
  }

  function requestDelete(space: Space) {
    clearRowError(space.id);
    // Refusal is inline, never a dialog (spec: no automatic re-attribution)
    const check = canDeleteSpace(spaces, offers, slots, space.id);
    if (!check.ok) {
      setRowError(space.id, check.reason);
      return;
    }
    setDeletePending(space);
  }

  function confirmDelete() {
    if (!deletePending) return;
    commitData(
      {
        ...state.data,
        spaces: spaces.filter((s) => s.id !== deletePending.id),
      },
      SPACE_LABELS.delete
    );
    setDeletePending(null);
  }

  return (
    <section className="config-section" aria-labelledby="config-spaces-title">
      <div className="config-section-head">
        <h3 id="config-spaces-title">Espaces</h3>
        <span className="section-hint">
          Lieux où se déroulent les créneaux. La couleur d'espace est le signal
          principal de la vue quotidienne et du plan accueil. Le blanc est
          réservé aux espaces auto-créés par l'import Secutix.
        </span>
      </div>
      <div className="config-body">
        {spaces.length === 0 && (
          <p className="empty-state">Aucun espace pour l'instant. Ajoutez-en un ci-dessous.</p>
        )}
        <div className="space-list">
          {spaces.map((space) => {
            const isWhite = space.color.toUpperCase() === SECUTIX_SPACE_COLOR;
            const error = rowErrors[space.id];
            const renaming = renamingId === space.id;
            return (
              <div
                key={space.id}
                className={`space-row${error ? ' refused' : ''}`}
              >
                <span className="space-swatch" style={{ background: space.color }} aria-hidden="true" />
                {renaming ? (
                  <>
                    <input
                      className={`rename-input${error ? ' invalid' : ''}`}
                      type="text"
                      value={renameValue}
                      aria-label="Nouveau nom de l'espace"
                      autoFocus
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitRename(space);
                        if (e.key === 'Escape') cancelRename();
                      }}
                    />
                    <span className="space-color-hex">{space.color}</span>
                    <div className="space-actions">
                      <button
                        className="btn btn-primary icon-only"
                        type="button"
                        title="Valider le renommage"
                        aria-label={`Valider le renommage de l'espace ${space.name}`}
                        onClick={() => commitRename(space)}
                      >
                        ✓
                      </button>
                      <button
                        className="btn btn-secondary icon-only"
                        type="button"
                        title="Annuler le renommage"
                        aria-label={`Annuler le renommage de l'espace ${space.name}`}
                        onClick={cancelRename}
                      >
                        ✕
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <span className="space-name">{space.name}</span>
                    {isWhite && (
                      <span className="space-note">(auto Secutix — blanc réservé)</span>
                    )}
                    <input
                      className="space-color-input"
                      type="color"
                      value={space.color}
                      aria-label={`Couleur de l'espace ${space.name}`}
                      onChange={(e) => handleColorChange(space, e.target.value)}
                    />
                    <span className="space-color-hex">{space.color}</span>
                    <div className="space-actions">
                      <button
                        className="btn btn-secondary icon-only"
                        type="button"
                        title="Renommer l'espace"
                        aria-label={`Renommer l'espace ${space.name}`}
                        onClick={() => startRename(space)}
                      >
                        ✎
                      </button>
                      <button
                        className="btn btn-danger icon-only"
                        type="button"
                        title="Supprimer l'espace"
                        aria-label={`Supprimer l'espace ${space.name}`}
                        onClick={() => requestDelete(space)}
                      >
                        🗑
                      </button>
                    </div>
                  </>
                )}
                {error && (
                  <span className="space-row-error" role="alert">⚠ {error}</span>
                )}
              </div>
            );
          })}
        </div>

        <form className="add-space-form" aria-labelledby="add-space-title" onSubmit={handleAdd}>
          <span id="add-space-title" className="add-space-title">Ajouter un espace</span>
          <label htmlFor="new-space-name" className="visually-hidden">Nom du nouvel espace</label>
          <input
            id="new-space-name"
            type="text"
            placeholder="Nom du nouvel espace"
            value={newName}
            aria-label="Nom du nouvel espace"
            className={addError ? 'invalid' : ''}
            onChange={(e) => setNewName(e.target.value)}
          />
          <span className="color-wrap">
            <label htmlFor="new-space-color">Couleur</label>
            <input
              id="new-space-color"
              className="space-color-input"
              type="color"
              value={newColor}
              aria-label="Couleur du nouvel espace"
              onChange={(e) => setNewColor(e.target.value)}
            />
          </span>
          <button className="btn btn-primary" type="submit">+ Ajouter</button>
          {addError && (
            <span className="form-error" role="alert">⚠ {addError}</span>
          )}
        </form>
      </div>

      {/* Delete confirmation dialog (only for unreferenced spaces) */}
      {deletePending && (
        <div
          className="confirm-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-space-confirm-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeletePending(null);
          }}
        >
          <div className="confirm-dialog">
            <h4 id="delete-space-confirm-title">Supprimer l'espace « {deletePending.name} » ?</h4>
            <p>Cette action supprime définitivement cet espace de la liste.</p>
            <div className="confirm-actions">
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => setDeletePending(null)}
              >
                Annuler
              </button>
              <button
                className="btn btn-danger"
                type="button"
                onClick={confirmDelete}
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
