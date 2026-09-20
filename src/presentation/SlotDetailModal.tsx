// SlotDetailModal.tsx — Read-only slot detail view

import { useData } from './DataContext';
import {
  isMediatorAvailable,
  STATUS_LABELS,
  ORIGIN_LABELS,
  formatImportDate,
} from '../domain/models';
import type { Slot } from '../domain/types';
import Modal from './Modal';
import OfferPill from './OfferPill';

interface Props {
  slot: Slot;
  onClose: () => void;
}

export default function SlotDetailModal({ slot, onClose }: Props) {
  const { state } = useData();
  const { data } = state;

  const offer = data.offers.find((o) => o.id === slot.offerId);
  const mediator = data.mediators.find((m) => m.id === slot.mediatorIds[0]);
  const available = mediator
    ? isMediatorAvailable(slot.mediatorIds[0], slot.date, slot.startTime, slot.endTime, data.absences, data.halfDayConfig)
    : true;

  const originBadge = slot.origin === 'imported' ? (
    <>
      <span className="badge origin-badge-imported">📥 {ORIGIN_LABELS.imported}</span>
      {slot.modifiedAfterImport && <span className="badge origin-badge-modified">✏ Modifié après import</span>}
    </>
  ) : (
    <span className="badge origin-badge-manual">✋ {ORIGIN_LABELS.manual}</span>
  );

  const conflictWarning = available ? null : (
    <div className="detail-warning">⚠️ Médiateur absent à ce créneau</div>
  );

  return (
    <Modal title="Détails du créneau" onClose={onClose}>
      <div className="detail-view">
        <div className="detail-row">
          <span className="detail-label">Offre</span>
          <span className="detail-value">
            {offer ? <OfferPill offer={offer} /> : '—'}
          </span>
        </div>
        {offer?.description && (
          <div className="detail-row">
            <span className="detail-label">Description</span>
            <span className="detail-value">{offer.description}</span>
          </div>
        )}
        {offer && (
          <div className="detail-row">
            <span className="detail-label">Durée</span>
            <span className="detail-value">{offer.duration} min</span>
          </div>
        )}
        {offer && (
          <div className="detail-row">
            <span className="detail-label">Capacité</span>
            <span className="detail-value">{offer.capacity}</span>
          </div>
        )}
        {offer?.location && (
          <div className="detail-row">
            <span className="detail-label">Lieu</span>
            <span className="detail-value">{offer.location}</span>
          </div>
        )}
        <hr />
        <div className="detail-row">
          <span className="detail-label">Médiateur</span>
          <span className="detail-value">
            {mediator ? (
              <>
                <span className="slot-mediator-dot" style={{ background: mediator.color || '#ccc' }}></span>
                {mediator.firstName} {mediator.lastName}
              </>
            ) : (
              'Non assigné'
            )}
          </span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Date</span>
          <span className="detail-value">
            {new Date(slot.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Horaire</span>
          <span className="detail-value">{slot.startTime} – {slot.endTime}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Participants</span>
          <span className="detail-value">{slot.participantCount}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Statut</span>
          <span className="detail-value">
            <span className={`badge badge-${slot.status}`}>
              {STATUS_LABELS.slot[slot.status] || slot.status}
            </span>
          </span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Origine</span>
          <span className="detail-value">{originBadge}</span>
        </div>
        {slot.importSource && (
          <div className="detail-row">
            <span className="detail-label">Source</span>
            <span className="detail-value">{slot.importSource}</span>
          </div>
        )}
        {slot.importedAt && (
          <div className="detail-row">
            <span className="detail-label">Importé le</span>
            <span className="detail-value">{formatImportDate(slot.importedAt)}</span>
          </div>
        )}
        {slot.notes && (
          <div className="detail-row">
            <span className="detail-label">Notes</span>
            <span className="detail-value">{slot.notes}</span>
          </div>
        )}
        {conflictWarning}
        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Fermer</button>
        </div>
      </div>
    </Modal>
  );
}
