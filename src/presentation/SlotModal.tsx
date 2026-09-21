// SlotModal.tsx — Slot creation/editing, tabbed (booking, contact, details)

import { useState, useMemo } from 'react';
import { useData, useCRUD } from './DataContext';
import {
  createSlot,
  isMediatorAvailable,
  hasMediatorOverlap,
  STATUS_LABELS,
  ORIGIN_LABELS,
  formatImportDate,
  mediatorConfirmedForOffer,
  mediatorLearningOffer,
} from '../domain/models';
import type { Slot } from '../domain/types';
import Modal from './Modal';
import MultiSelect from './MultiSelect';
import OfferPill from './OfferPill';
import { SlotStatusValues } from './types';

interface Props {
  slot: Slot | null;
  mediatorOnly: boolean;
  defaultDate: string;
  onClose: () => void;
}

type TabId = 'reservation' | 'contact' | 'details';

const TABS: { id: TabId; label: string }[] = [
  { id: 'reservation', label: 'Réservation' },
  { id: 'contact', label: 'Contact' },
  { id: 'details', label: 'Détails' },
];

export default function SlotModal({ slot, mediatorOnly, defaultDate, onClose }: Props) {
  const { state } = useData();
  const crud = useCRUD();
  const isEdit = !!slot;
  const locked = state.locked;

  const [form, setForm] = useState<Slot>(() => slot || createSlot({ date: defaultDate }));
  const [activeTab, setActiveTab] = useState<TabId>('reservation');

  // Restricted mode (imported slot while the planning is locked, or
  // mediator-only mode): only mediator assignment, setup and teardown
  // stay editable — booking details remain visible but read-only.
  const isImported = form.origin === 'imported';
  const restricted = mediatorOnly || (isImported && locked);

  // Default setup/teardown from the offer when the slot has none yet
  const currentOffer = state.data.offers.find((o) => o.id === form.offerId);
  const setupDefault = form.setupTime ?? currentOffer?.setupTime ?? 0;
  const teardownDefault = form.teardownTime ?? currentOffer?.teardownTime ?? 0;

  const [selectedMediators, setSelectedMediators] = useState<string[]>(form.mediatorIds);
  const [setupTimeInput, setSetupTimeInput] = useState<string>(String(setupDefault));
  const [teardownTimeInput, setTeardownTimeInput] = useState<string>(String(teardownDefault));

  // Mediator warning: overlap or absence for the first selected mediator
  const warning = useMemo(() => {
    const firstMed = selectedMediators[0];
    if (!firstMed) return '';
    const overlap = hasMediatorOverlap(firstMed, form.date, form.startTime, form.endTime, state.data.slots, form.id);
    const absent = !isMediatorAvailable(firstMed, form.date, form.startTime, form.endTime, state.data.absences, state.data.halfDayConfig);
    if (overlap) return '⚠️ Ce médiateur a déjà un créneau à cet horaire';
    if (absent) return '🚫 Ce médiateur est absent à ce créneau';
    return '';
  }, [selectedMediators, form.date, form.startTime, form.endTime, form.id, state.data.slots, state.data.absences]);

  function setField<K extends keyof Slot>(key: K, value: Slot[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Setup/teardown are editable regardless of lock state
    const setupVal = setupTimeInput !== '' ? parseInt(setupTimeInput) || 0 : setupDefault;
    const teardownVal = teardownTimeInput !== '' ? parseInt(teardownTimeInput) || 0 : teardownDefault;

    const updated: Slot = {
      ...form,
      mediatorIds: selectedMediators,
      participantCount: parseInt(String(form.participantCount)) || 0,
      groupName: form.groupName.trim(),
      guide: form.guide.trim(),
      location: form.location.trim(),
      groupNature: form.groupNature.trim(),
      contactName: form.contactName.trim(),
      contactPhone: form.contactPhone.trim(),
      contactEmail: form.contactEmail.trim(),
      contractNumber: form.contractNumber?.trim() || undefined,
      notes: form.notes.trim(),
      setupTime: setupVal,
      teardownTime: teardownVal,
    };

    if (isEdit) {
      // Mark imported slots as modified after import when edited
      if (updated.origin === 'imported') {
        updated.modifiedAfterImport = true;
      }
      crud({ type: 'UPDATE_SLOT', slot: updated });
    } else {
      updated.origin = 'manual';
      crud({ type: 'ADD_SLOT', slot: updated });
    }
    onClose();
  }

  function handleDelete() {
    if (!slot) return;
    crud({ type: 'DELETE_SLOT', id: slot.id });
    onClose();
  }

  // Build mediator options with overlap/absence/competence indicators
  // Sort: confirmed first, then learning, then none — alphabetical within each group
  const mediatorOptions = useMemo(() => {
    const offerId = form.offerId;
    return state.data.mediators.map((m) => {
      const overlap = hasMediatorOverlap(m.id, form.date, form.startTime, form.endTime, state.data.slots, form.id);
      const absent = !isMediatorAvailable(m.id, form.date, form.startTime, form.endTime, state.data.absences, state.data.halfDayConfig);
      const confirmed = mediatorConfirmedForOffer(m, offerId);
      const learning = mediatorLearningOffer(m, offerId);

      let label = `${m.firstName} ${m.lastName}`;

      if (confirmed) {
        label += ' ✅';
      } else if (learning) {
        label += ' 📚';
      } else if (offerId) {
        label += ' ⚠️ Incompétent';
      }

      if (overlap) label += ' — Conflit horaire';
      else if (absent) label += ' — Absent';

      const competenceRank = confirmed ? 0 : learning ? 1 : 2;

      return {
        value: m.id,
        label,
        color: m.color,
        isDisabled: overlap,
        competenceStatus: confirmed ? 'confirmed' : learning ? 'learning' : null,
        competenceRank,
        sortName: `${m.lastName} ${m.firstName}`.toLowerCase(),
      };
    }).sort((a, b) => {
      if (a.competenceRank !== b.competenceRank) return a.competenceRank - b.competenceRank;
      return a.sortName.localeCompare(b.sortName);
    });
  }, [state.data.mediators, state.data.slots, state.data.absences, form.date, form.startTime, form.endTime, form.id, form.offerId]);

  const offer = state.data.offers.find((o) => o.id === form.offerId);

  // Origin badges — visible above the tabs on every tab
  const originBadges = isImported ? (
    <>
      <span className="badge origin-badge-imported">📥 {ORIGIN_LABELS.imported}</span>
      {form.modifiedAfterImport && <span className="badge origin-badge-modified">✏ Modifié après import</span>}
      {form.importSource && <span className="origin-detail">Source : {form.importSource}</span>}
      {form.importedAt && <span className="origin-detail">Importé le {formatImportDate(form.importedAt)}</span>}
    </>
  ) : (
    <span className="badge origin-badge-manual">✋ {ORIGIN_LABELS.manual}</span>
  );

  return (
    <Modal title={isEdit ? 'Modifier le créneau' : 'Nouveau créneau'} onClose={onClose}>
      <form id="form-slot" onSubmit={handleSubmit}>
        <div className="origin-info">{originBadges}</div>

        <div className="modal-tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={activeTab === t.id}
              className={`modal-tab${activeTab === t.id ? ' active' : ''}`}
              onClick={() => setActiveTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {activeTab === 'reservation' && (
          <div className="tab-panel" role="tabpanel">
            <div className="form-group">
              <label>Offre *</label>
              <select
                value={form.offerId}
                onChange={(e) => setField('offerId', e.target.value)}
                required
                disabled={restricted}
              >
                <option value="">— Choisir —</option>
                {state.data.offers.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
              {offer && (
                <div className="form-hint">
                  <OfferPill offer={offer} id="slot-offer-pill" />
                </div>
              )}
            </div>
            <div className="form-group">
              <label>Nom du groupe</label>
              <input
                type="text"
                value={form.groupName}
                onChange={(e) => setField('groupName', e.target.value)}
                disabled={restricted}
                placeholder="Groupe visiteur"
              />
            </div>
            <div className="form-group">
              <label>Médiateurs</label>
              <MultiSelect
                options={mediatorOptions}
                value={selectedMediators}
                onChange={setSelectedMediators}
                ariaLabel="Médiateurs"
                placeholder="Rechercher un médiateur…"
                noOptionsMessage="Aucun médiateur disponible"
              />
              <div className="form-hint">
                {warning ? (
                  <span className="warning-text">{warning}</span>
                ) : (
                  'Cliquez pour ajouter, × pour retirer'
                )}
              </div>
            </div>
            <div className="form-group">
              <label>Date *</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setField('date', e.target.value)}
                required
                disabled={restricted}
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Début *</label>
                <input
                  type="time"
                  value={form.startTime}
                  onChange={(e) => setField('startTime', e.target.value)}
                  required
                  disabled={restricted}
                />
              </div>
              <div className="form-group">
                <label>Fin *</label>
                <input
                  type="time"
                  value={form.endTime}
                  onChange={(e) => setField('endTime', e.target.value)}
                  required
                  disabled={restricted}
                />
              </div>
            </div>
            <div className="form-group">
              <label>Espace</label>
              <input
                type="text"
                value={form.location}
                onChange={(e) => setField('location', e.target.value)}
                disabled={restricted}
                placeholder={offer?.location || 'Espace'}
              />
              {offer?.location && !form.location && (
                <div className="form-hint">Par défaut : {offer.location} (offre)</div>
              )}
            </div>
            <div className="form-group">
              <label>Notes / Remarques</label>
              <textarea
                value={form.notes}
                onChange={(e) => setField('notes', e.target.value)}
                disabled={restricted}
              ></textarea>
            </div>
          </div>
        )}

        {activeTab === 'contact' && (
          <div className="tab-panel" role="tabpanel">
            <div className="form-group">
              <label>N° dossier d'achat</label>
              <input
                type="text"
                value={form.contractNumber ?? ''}
                onChange={(e) => setField('contractNumber', e.target.value)}
                disabled={restricted}
                placeholder="Contrat Secutix"
              />
              <div className="form-hint">Un même dossier peut regrouper plusieurs réservations</div>
            </div>
            <div className="form-group">
              <label>Contact</label>
              <input
                type="text"
                value={form.contactName}
                onChange={(e) => setField('contactName', e.target.value)}
                disabled={restricted}
                placeholder="Nom du contact du dossier"
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Téléphone</label>
                <input
                  type="tel"
                  value={form.contactPhone}
                  onChange={(e) => setField('contactPhone', e.target.value)}
                  disabled={restricted}
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={form.contactEmail}
                  onChange={(e) => setField('contactEmail', e.target.value)}
                  disabled={restricted}
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'details' && (
          <div className="tab-panel" role="tabpanel">
            <div className="form-row">
              <div className="form-group">
                <label>Mise en place (min)</label>
                <input
                  type="number"
                  value={setupTimeInput}
                  min={0}
                  step={5}
                  onChange={(e) => setSetupTimeInput(e.target.value)}
                  title="Durée de préparation avant la réservation"
                />
                <div className="form-hint">Par défaut : {setupDefault} min (offre)</div>
              </div>
              <div className="form-group">
                <label>Rangement (min)</label>
                <input
                  type="number"
                  value={teardownTimeInput}
                  min={0}
                  step={5}
                  onChange={(e) => setTeardownTimeInput(e.target.value)}
                  title="Durée de rangement après la réservation"
                />
                <div className="form-hint">Par défaut : {teardownDefault} min (offre)</div>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Participants</label>
                <input
                  type="number"
                  value={form.participantCount}
                  min={0}
                  onChange={(e) => setField('participantCount', parseInt(e.target.value) || 0)}
                  disabled={restricted}
                />
              </div>
              <div className="form-group">
                <label>Statut</label>
                <select
                  value={form.status}
                  onChange={(e) => setField('status', e.target.value as Slot['status'])}
                  disabled={restricted}
                >
                  {SlotStatusValues.map((val) => (
                    <option key={val} value={val}>{STATUS_LABELS.slot[val]}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Guide</label>
                <input
                  type="text"
                  value={form.guide}
                  onChange={(e) => setField('guide', e.target.value)}
                  disabled={restricted}
                  placeholder="Guide indiqué dans Secutix (si connu)"
                />
              </div>
              <div className="form-group">
                <label>Nature du groupe</label>
                <input
                  type="text"
                  value={form.groupNature}
                  onChange={(e) => setField('groupNature', e.target.value)}
                  disabled={restricted}
                  placeholder="ex. SCOLAIRES C2, PSH"
                />
              </div>
            </div>
          </div>
        )}

        <div className="form-actions">
          {isEdit && !restricted && (
            <button type="button" className="btn btn-danger" id="slot-delete" onClick={handleDelete}>
              Supprimer
            </button>
          )}
          <button type="button" className="btn btn-secondary" onClick={onClose}>Annuler</button>
          <button type="submit" className="btn btn-primary">{isEdit ? 'Enregistrer' : 'Ajouter'}</button>
        </div>
      </form>
    </Modal>
  );
}
