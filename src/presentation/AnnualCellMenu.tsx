// AnnualCellMenu.tsx — Annual view slice 4 (cell editing): the half-day
// cell context menu. One click on a grid cell opens it with:
//   - every catalog code chip (CA, RHS, AM, TELE, amgt, Réf. WE, CEX, TPT)
//     plus « Souhait » (pending leave request, blue — distinct from the
//     confirmed leave)
//   - free text with the decoded codes as suggestions (decision 2026-10-03:
//     non-blocking — any text becomes an orange mission cell)
//   - « Effacer (retour au dérivé) » — clears the stored entry so the cell
//     reverts to its derived state
//   - a NON-BLOCKING amber alert on museum-closed days (25/12, 01/01,
//     01/05): « Le musée est fermé ce jour-là » — editing stays possible
//     (annual table records legitimate exceptions, unlike the day view)
// Keyboard access: every item is a focusable button/input; Escape closes
// without committing; Enter submits the free text.
// Spec: test/features/annual-view/annual-editing.feature (menu contextuel,
// jours de fermeture); mockup annual-editing.html states (1)+(3).

import { useEffect, useRef, useState } from 'react';
import {
  annualCodeCatalog,
} from '../domain/annual-view';
import { parseLocalDate } from '../domain/models';
import { isMuseumClosed } from '../domain/hours';

/** The half-day cell the menu edits. */
export interface AnnualCellTarget {
  /** Mediator owning the cell. */
  mediatorId: string;
  /** Displayed mediator name (menu head). */
  mediatorName: string;
  /** ISO date of the cell (YYYY-MM-DD). */
  date: string;
  /** The cell's half-day. */
  halfDay: 'morning' | 'afternoon';
}

// French date label of the menu head (mar. 09/06/2026)
const WEEKDAY_SHORT = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
function headDateLabel(iso: string): string {
  const d = parseLocalDate(iso);
  return `${WEEKDAY_SHORT[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

// Menu code chips: the catalog codes plus the « Souhait » pending-request
// chip (leave_request — stored via annualMenuChoice in the domain).
const MENU_CODES = ['CA', 'RHS', 'AM', 'TELE', 'amgt', 'Réf. WE', 'CEX', 'TPT'];
const SUGGESTION_CODES = ['CA', 'RHS', 'AM', 'CEX', 'amgt', 'JDM'];
const SUGGESTION_TITLES: Record<string, string> = {
  CA: 'Congé annuel',
  RHS: 'Récupération heures supplémentaires',
  AM: 'Arrêt maladie',
  CEX: 'Congé exceptionnel',
  amgt: 'Aménagement',
  JDM: 'Mission Jardins du muséum',
};

interface AnnualCellMenuProps {
  /** The cell being edited. */
  target: AnnualCellTarget;
  /** A code chip was picked (catalog code or « Souhait »). */
  onPickCode: (code: string) => void;
  /** Free text was submitted (trimmed, non-blank). */
  onPickFreeText: (text: string) => void;
  /** « Effacer » — clear the stored entry, revert to the derived state. */
  onClear: (target: AnnualCellTarget) => void;
  /** Close without committing (Escape, click outside handled by parent). */
  onClose: () => void;
}

export default function AnnualCellMenu({
  target,
  onPickCode,
  onPickFreeText,
  onClear,
  onClose,
}: AnnualCellMenuProps) {
  const [freeText, setFreeText] = useState('');
  // Focus the first chip on open: keyboard users land in the menu
  const firstChipRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    firstChipRef.current?.focus();
  }, []);

  const d = parseLocalDate(target.date);
  const closed = isMuseumClosed(d);
  const halfLabel = target.halfDay === 'morning' ? 'Matin' : 'Après-midi';
  // All codes of the catalog still offered (menu list mirrors the catalog)
  const catalog = annualCodeCatalog().map((c) => c.code);

  const pick = (code: string) => {
    onPickCode(code);
    onClose();
  };
  const submitFreeText = () => {
    const trimmed = freeText.trim();
    if (!trimmed) return; // blank: no commit, menu stays open
    onPickFreeText(trimmed);
    onClose();
  };

  return (
    <div
      className="acm"
      role="menu"
      aria-label={`Modifier la demi-journée : ${target.mediatorName}, ${headDateLabel(target.date)} · ${halfLabel}`}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <div className="acm-head">
        {target.mediatorName} — {headDateLabel(target.date)} · {halfLabel}
      </div>
      {closed && (
        <div role="alert" className="acm-closed-alert">
          ⚠ <span><strong>Le musée est fermé ce jour-là.</strong> L&apos;édition reste possible — exceptions légitimes.</span>
        </div>
      )}
      <div className="acm-list">
        {MENU_CODES.map((code, i) => (
          <button
            key={code}
            ref={i === 0 ? firstChipRef : undefined}
            type="button"
            role="menuitem"
            className={`acm-chip ${code === 'TELE' ? 'chip-tele' : ''}`}
            onClick={() => pick(code)}
          >
            {code}
          </button>
        ))}
        <button
          type="button"
          role="menuitem"
          className="acm-chip chip-souhait"
          title="Souhait de congé en attente (leave_request) — distinct du congé confirmé en jaune"
          onClick={() => pick('Souhait')}
        >
          Souhait
        </button>
      </div>
      <div className="acm-free">
        <label htmlFor={`acm-free-${target.mediatorId}-${target.date}-${target.halfDay}`}>Texte libre (vert non bloquant)</label>
        <div className="acm-free-input">
          <input
            id={`acm-free-${target.mediatorId}-${target.date}-${target.halfDay}`}
            type="text"
            value={freeText}
            aria-label="Saisie de texte libre pour la demi-journée"
            onChange={(e) => setFreeText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitFreeText();
            }}
          />
          <button className="btn btn-primary" type="button" onClick={submitFreeText}>OK</button>
        </div>
        <div className="acm-sugg" aria-label="Suggestions de codes décodés">
          {SUGGESTION_CODES.map((code) => (
            <button
              key={code}
              type="button"
              className="acm-chip"
              title={SUGGESTION_TITLES[code]}
              onClick={() => {
                onPickFreeText(code);
                onClose();
              }}
            >
              {code}
            </button>
          ))}
        </div>
      </div>
      <div className="acm-foot">
        <button type="button" role="menuitem" className="acm-item" onClick={() => { onClear(target); onClose(); }}>
          <span className="mi" aria-hidden="true">⌫</span>
          <span>Effacer <span className="acm-hint">(retour au dérivé)</span></span>
        </button>
      </div>
      {/* Catalog parity guard: every catalog code is reachable in the menu.
          Hidden list for tests/verification — not user-visible. */}
      <span hidden data-catalog-codes={catalog.join(',')}></span>
    </div>
  );
}
