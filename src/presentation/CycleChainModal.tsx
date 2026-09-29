// CycleChainModal.tsx — Work-cycle editing modal (chaîne de cycles), opened
// per mediator from the Mediators view. Structure follows the validated
// mockup docs/mockups/cycles/cycle-chain-modal.html exactly: ordered weeks
// with ▲▼ reorder + ▾/▸ expand + rename, 7-day worked grid, rotation anchor,
// forced ISO weeks, Copier/Coller footer, paste confirmation dialog.
// Spec: test/features/cycles/cycle-model.feature (modal scenarios).

import { useMemo, useState } from 'react';
import { useData } from './DataContext';
import { COMMIT_LABELS } from './DataContext';
import Modal from './Modal';
import {
  createDefaultCycle,
  validateCycle,
  copyCycleToJSON,
  pasteCycleFromJSON,
  cycleWeekForIsoWeek,
  isoWeekKey,
} from '../domain/cycles';
import {
  addCycleWeek,
  removeCycleWeek,
  renameCycleWeek,
  moveCycleWeek,
  setDayWorked,
  setDayRange,
  summarizeCycleWeek,
  validateIsoWeekKey,
} from '../domain/cycle-edit';
import { generateId } from '../domain/models';
import type { CycleWeek, Mediator, WorkCycle } from '../domain/types';

const DAY_LABELS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const DEFAULT_RANGE: [string, string] = ['09:30', '18:00'];

interface Props {
  mediator: Mediator;
  onClose: () => void;
}

type PasteState =
  | { kind: 'none' }
  | { kind: 'confirm' }
  | { kind: 'error'; message: string };

export default function CycleChainModal({ mediator, onClose }: Props) {
  const { state, dispatch, commit } = useData();
  const name = `${mediator.firstName} ${mediator.lastName}`.trim();

  // The mediator's cycle, or null when none is defined yet. The modal starts
  // in "create the default cycle" state for a mediator without activeCycleId.
  const existing = useMemo(
    () =>
      mediator.activeCycleId
        ? state.data.cycles.find((c) => c.id === mediator.activeCycleId)
        : undefined,
    [mediator.activeCycleId, state.data.cycles]
  );

  const [draft, setDraft] = useState<WorkCycle | null>(
    () => existing ?? null
  );
  const [errors, setErrors] = useState<string[]>([]);
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(
    () => new Set(existing ? [existing.weeks[0]?.id] : [])
  );
  const [copied, setCopied] = useState(false);
  const [paste, setPaste] = useState<PasteState>({ kind: 'none' });

  // Current ISO week, for the header's active-week pill
  const currentWeekKey = isoWeekKey(new Date());

  function persistCycle(cycle: WorkCycle, label: string) {
    const mediators = state.data.mediators.map((m) =>
      m.id === mediator.id ? { ...m, activeCycleId: cycle.id } : m
    );
    // One active cycle per mediator: the new cycle replaces the previous one
    const cycles = [...state.data.cycles.filter((c) => c.mediatorId !== mediator.id), cycle];
    const next = { ...state.data, mediators, cycles };
    dispatch({ type: 'SET_DATA', data: next });
    commit(next, label);
  }

  function handleSave() {
    if (!draft) return;
    const v = validateCycle(draft);
    if (!v.ok) {
      setErrors(v.errors);
      return;
    }
    persistCycle(draft, COMMIT_LABELS.saveCycle);
    onClose();
  }

  function handleCreateDefault() {
    const cycle = createDefaultCycle(mediator.id, currentWeekKey);
    setDraft(cycle);
    setExpandedWeeks(new Set([cycle.weeks[0].id]));
    setErrors([]);
  }

  function handleRemoveWeek(week: CycleWeek) {
    if (draft && draft.weeks.length <= 1) {
      // Spec: a cycle must keep at least one week — the removal is refused
      setErrors(['Le cycle doit comporter au moins une semaine']);
      return;
    }
    setErrors([]);
    setDraft((d) => (d ? removeCycleWeek(d, week.id) : d));
  }

  function handleCopy() {
    if (!draft) return;
    const json = copyCycleToJSON(draft);
    // Clipboard API with execCommand fallback (http contexts)
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(json).catch(() => fallbackCopy(json));
    } else {
      fallbackCopy(json);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function fallbackCopy(text: string) {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
    } finally {
      document.body.removeChild(ta);
    }
  }

  async function readClipboard(): Promise<string> {
    if (navigator.clipboard?.readText) {
      return navigator.clipboard.readText();
    }
    // No clipboard read API (http / older browsers): prompt for the JSON
    return window.prompt('Collez ici le JSON du cycle :') ?? '';
  }

  function handlePasteClick() {
    setPaste({ kind: 'confirm' });
  }

  async function handlePasteConfirm() {
    const json = await readClipboard();
    const result = pasteCycleFromJSON(json, mediator.id, () => generateId('cyc'));
    if (!result.ok) {
      setPaste({ kind: 'error', message: result.error });
      return;
    }
    // The pasted cycle replaces the draft in the modal; Enregistrer persists
    setDraft(result.cycle);
    setExpandedWeeks(new Set([result.cycle.weeks[0]?.id]));
    setPaste({ kind: 'none' });
    setErrors([]);
    persistCycle(result.cycle, COMMIT_LABELS.pasteCycle);
    onClose();
  }

  // ---- No-cycle state: offer creating the default cycle ------------------
  if (!draft) {
    return (
      <Modal title={`Cycle de travail — ${name}`} onClose={onClose}>
        <p style={{ marginBottom: 12 }}>
          {name} n’a pas encore de cycle de travail défini.
        </p>
        <p className="form-hint" style={{ marginBottom: 16 }}>
          Le cycle par défaut comporte une semaine « S1 », travaillée du lundi
          au vendredi de 09:30 à 18:00, week-ends non travaillés.
        </p>
        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Annuler</button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleCreateDefault}
            aria-label={`Créer le cycle par défaut de ${name}`}
          >
            Créer le cycle par défaut
          </button>
        </div>
      </Modal>
    );
  }

  const anchorWeek = draft.weeks.find((w) => w.name === anchorCycleWeekName(draft, currentWeekKey));

  return (
    <Modal title={`Cycle de travail — ${name}`} onClose={onClose}>
      <div
        className="cycle-modal-top"
        style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}
      >
        {anchorWeek && (
          <span
            className="pill pill-week"
            title={`Semaine de cycle active pour la semaine ISO affichée`}
          >
            {anchorWeek.name} active
          </span>
        )}
        <span className="form-hint">Semaine ISO courante : {currentWeekKey}</span>
      </div>

      {/* ============ Ordered cycle weeks ============ */}
      <section className="modal-section" aria-labelledby="cycle-weeks-title">
        <div className="section-head-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          <h4 id="cycle-weeks-title" className="modal-section-title">Semaines de cycle (ordre de rotation)</h4>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setDraft((d) => (d ? addCycleWeek(d) : d));
              setErrors([]);
            }}
          >
            + Ajouter une semaine
          </button>
        </div>
        <p className="form-hint" style={{ marginBottom: 8 }}>
          La rotation suit l’ordre de la liste : {draft.weeks.map((w) => w.name).join(' → ')}
          {draft.weeks.length > 0 && ` → ${draft.weeks[0].name}…`} Une semaine au minimum.
        </p>

        <div className="week-list" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {draft.weeks.map((week, index) => {
            const expanded = expandedWeeks.has(week.id);
            return (
              <div key={week.id} className={`week-item${expanded ? ' expanded' : ' collapsed'}`}>
                <div className="week-head">
                  <span className="order-btns" title="Monter / descendre dans la rotation">
                    <button
                      type="button"
                      aria-label={`Monter ${week.name} dans la rotation`}
                      disabled={index === 0}
                      onClick={() => setDraft((d) => (d ? moveCycleWeek(d, week.id, -1) : d))}
                    >▲</button>
                    <button
                      type="button"
                      aria-label={`Descendre ${week.name} dans la rotation`}
                      disabled={index === draft.weeks.length - 1}
                      onClick={() => setDraft((d) => (d ? moveCycleWeek(d, week.id, 1) : d))}
                    >▼</button>
                  </span>
                  <input
                    className="week-name-input"
                    type="text"
                    value={week.name}
                    aria-label="Nom de la semaine de cycle"
                    onChange={(e) =>
                      setDraft((d) => (d ? renameCycleWeek(d, week.id, e.target.value) : d))
                    }
                  />
                  <span className="week-summary">
                    <strong>{summarizeCycleWeek(week)}</strong>
                  </span>
                  <span className="week-actions" style={{ display: 'flex', gap: 4, marginLeft: 'auto', alignItems: 'center' }}>
                    <button
                      type="button"
                      className="expand-btn"
                      title={expanded ? 'Replier la semaine' : 'Déplier la semaine'}
                      aria-label={expanded ? `Réduire la semaine ${week.name}` : `Développer la semaine ${week.name}`}
                      onClick={() =>
                        setExpandedWeeks((prev) => {
                          const next = new Set(prev);
                          if (next.has(week.id)) next.delete(week.id);
                          else next.add(week.id);
                          return next;
                        })
                      }
                    >
                      {expanded ? '▾' : '▸'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger icon-only"
                      title={`Supprimer la semaine ${week.name}`}
                      aria-label={`Supprimer la semaine ${week.name}`}
                      onClick={() => handleRemoveWeek(week)}
                    >🗑</button>
                  </span>
                </div>
                {expanded && (
                  <div className="week-days">
                    <div className="day-grid" role="group" aria-label={`Jours travaillés et plages horaires de ${week.name}`}>
                      <span className="grid-head">Jour</span>
                      <span className="grid-head">Travaillé</span>
                      <span className="grid-head">Début</span>
                      <span className="grid-head">Fin</span>
                      {week.days.map((day, di) => {
                        const worked = day.startTime !== undefined && day.endTime !== undefined;
                        return (
                          <DayRow
                            key={day.day}
                            label={DAY_LABELS[di]}
                            worked={worked}
                            startTime={day.startTime}
                            endTime={day.endTime}
                            onChange={(patch) =>
                              setDraft((d) => {
                                if (!d) return d;
                                let c = d;
                                if (patch.worked !== undefined) {
                                  c = setDayWorked(c, week.id, day.day, patch.worked);
                                }
                                if (patch.startTime !== undefined || patch.endTime !== undefined) {
                                  c = setDayRange(c, week.id, day.day, patch.startTime, patch.endTime);
                                }
                                return c;
                              })
                            }
                          />
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ============ Rotation anchor + forced ISO weeks ============ */}
      <section className="modal-section" aria-labelledby="cycle-rotation-title" style={{ marginTop: 20 }}>
        <h4 id="cycle-rotation-title" className="modal-section-title">Rotation et ancrage</h4>
        <div className="rotation-box">
          <div className="anchor-row" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <label htmlFor="anchor-week">Ancrage : la rotation démarre sur</label>
            <select
              id="anchor-cycle-week"
              aria-label="Semaine de cycle d'ancrage"
              value={draft.weeks[0]?.name}
              onChange={(e) => {
                // The anchor cycle week is weeks[0] by construction: the
                // rotation starts at weeks[0] during anchorIsoWeek. Choosing
                // another start week re-orders it to the front.
                const target = draft.weeks.find((w) => w.name === e.target.value);
                if (!target) return;
                setDraft((d) => {
                  if (!d) return d;
                  const rest = d.weeks.filter((w) => w.id !== target.id);
                  return { ...d, weeks: [target, ...rest] };
                });
              }}
            >
              {draft.weeks.map((w) => (
                <option key={w.id} value={w.name}>{w.name}</option>
              ))}
            </select>
            <span className="form-hint">à la semaine ISO</span>
            <input
              id="anchor-week"
              className="anchor-input"
              type="text"
              value={draft.anchorIsoWeek}
              spellCheck={false}
              aria-label="Semaine ISO d'ancrage"
              onChange={(e) =>
                setDraft((d) => (d ? { ...d, anchorIsoWeek: e.target.value } : d))
              }
            />
            {!validateIsoWeekKey(draft.anchorIsoWeek) && (
              <span className="warning-text" role="alert">Clé de semaine ISO invalide (ex. 2026-W40)</span>
            )}
          </div>
          <p className="form-hint" style={{ marginTop: 6 }}>
            Par défaut la rotation démarre à {draft.weeks[0]?.name}. Les semaines ISO
            antérieures à l’ancrage suivent la rotation précédente.
          </p>

          <div className="forced-list" aria-label="Semaines ISO forcées" style={{ marginTop: 10 }}>
            {Object.entries(draft.forcedWeeks).length === 0 && (
              <p className="form-hint" style={{ fontStyle: 'italic' }}>Aucune semaine forcée.</p>
            )}
            {Object.entries(draft.forcedWeeks).map(([isoKey, weekName]) => (
              <div key={isoKey} className="forced-row">
                <span className="iso-week">{isoKey}</span>
                <span className="arrow">→</span>
                <select
                  className="force-select"
                  aria-label={`Semaine de cycle forcée pour ${isoKey}`}
                  value={weekName}
                  onChange={(e) =>
                    setDraft((d) =>
                      d ? { ...d, forcedWeeks: { ...d.forcedWeeks, [isoKey]: e.target.value } } : d
                    )
                  }
                >
                  {draft.weeks.map((w) => (
                    <option key={w.id} value={w.name}>{w.name}</option>
                  ))}
                </select>
                <span className="form-hint">forçage manuel</span>
                <button
                  type="button"
                  className="forced-remove"
                  title={`Annuler le forçage de ${isoKey}`}
                  aria-label={`Annuler le forçage de ${isoKey}`}
                  onClick={() =>
                    setDraft((d) => {
                      if (!d) return d;
                      const forcedWeeks = { ...d.forcedWeeks };
                      delete forcedWeeks[isoKey];
                      return { ...d, forcedWeeks };
                    })
                  }
                >✕</button>
              </div>
            ))}
            <ForceWeekForm
              weekNames={draft.weeks.map((w) => w.name)}
              onAdd={(isoKey, weekName) =>
                setDraft((d) =>
                  d ? { ...d, forcedWeeks: { ...d.forcedWeeks, [isoKey]: weekName } } : d
                )
              }
            />
          </div>
          <p className="form-hint" style={{ marginTop: 8 }}>
            Une semaine ISO forcée ignore la rotation pour cette semaine uniquement ; les
            semaines suivantes reprennent la rotation comme si le forçage n’existait pas.
          </p>
        </div>
      </section>

      {errors.length > 0 && (
        <div className="cycle-errors" role="alert" style={{ marginTop: 12 }}>
          {errors.map((err, i) => (
            <p key={i} className="warning-text">⚠ {err}</p>
          ))}
        </div>
      )}

      <div className="form-actions" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary"
            title="Copier le cycle au format JSON dans le presse-papiers"
            onClick={handleCopy}
          >
            ⧉ Copier le cycle
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            title="Coller un cycle depuis le presse-papiers (avec confirmation)"
            onClick={handlePasteClick}
          >
            ⇩ Coller le cycle
          </button>
          {copied && (
            <span className="form-hint" role="status" style={{ alignSelf: 'center' }}>Cycle copié</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Annuler</button>
          <button type="button" className="btn btn-primary" onClick={handleSave}>Enregistrer</button>
        </div>
      </div>

      {/* ===== Paste confirmation / error dialog (above the modal) ===== */}
      {paste.kind !== 'none' && (
        <div
          className="confirm-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="paste-confirm-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPaste({ kind: 'none' });
          }}
        >
          <div className="confirm-dialog">
            <h4 id="paste-confirm-title">Remplacer le cycle de {name} ?</h4>
            {paste.kind === 'error' ? (
              <div className="paste-error" role="alert">⚠ {paste.message}</div>
            ) : (
              <p>
                Le contenu du presse-papiers remplacera intégralement le cycle actuel
                {' '}de {name} ({draft.weeks.length}{' '}
                semaine{draft.weeks.length > 1 ? 's' : ''}).
              </p>
            )}
            <div className="confirm-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              {paste.kind === 'confirm' ? (
                <>
                  <button type="button" className="btn btn-secondary" onClick={() => setPaste({ kind: 'none' })}>
                    Annuler
                  </button>
                  <button type="button" className="btn btn-primary" onClick={handlePasteConfirm}>
                    Remplacer
                  </button>
                </>
              ) : (
                <button type="button" className="btn btn-secondary" onClick={() => setPaste({ kind: 'none' })}>
                  Fermer
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

/** The cycle week active for the current ISO week (header pill). */
function anchorCycleWeekName(cycle: WorkCycle, weekKey: string): string | undefined {
  return cycleWeekForIsoWeek(cycle, weekKey)?.name;
}

// ---- One day row of the expanded week grid ------------------------------------

interface DayRowProps {
  label: string;
  worked: boolean;
  startTime?: string;
  endTime?: string;
  onChange: (patch: { worked?: boolean; startTime?: string; endTime?: string }) => void;
}

function DayRow({ label, worked, startTime, endTime, onChange }: DayRowProps) {
  return (
    <>
      <span className="day-name">{label}</span>
      <label className="day-toggle">
        <input
          type="checkbox"
          checked={worked}
          aria-label={`${label} travaillé`}
          onChange={(e) => onChange({ worked: e.target.checked })}
        />
        <span className="toggle-state">{worked ? 'oui' : 'non'}</span>
      </label>
      <span className="time-pair">
        <input
          type="time"
          value={startTime ?? ''}
          disabled={!worked}
          placeholder="—"
          aria-label={`Début ${label.toLowerCase()}${worked ? '' : ' (jour non travaillé)'}`}
          onChange={(e) => onChange({ startTime: e.target.value || DEFAULT_RANGE[0] })}
        />
        <span> – </span>
        <input
          type="time"
          value={endTime ?? ''}
          disabled={!worked}
          placeholder="—"
          aria-label={`Fin ${label.toLowerCase()}${worked ? '' : ' (jour non travaillé)'}`}
          onChange={(e) => onChange({ endTime: e.target.value || DEFAULT_RANGE[1] })}
        />
      </span>
    </>
  );
}

// ---- Add-a-forced-week inline form ----------------------------------------------

function ForceWeekForm({
  weekNames,
  onAdd,
}: {
  weekNames: string[];
  onAdd: (isoKey: string, weekName: string) => void;
}) {
  const [isoKey, setIsoKey] = useState('');
  const [weekName, setWeekName] = useState(weekNames[0] ?? '');
  const [error, setError] = useState('');

  function add() {
    if (!validateIsoWeekKey(isoKey)) {
      setError('Clé de semaine ISO invalide (ex. 2026-W40)');
      return;
    }
    onAdd(isoKey, weekName || weekNames[0]);
    setIsoKey('');
    setError('');
  }

  return (
    <div className="forced-add" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <input
        type="text"
        className="anchor-input"
        placeholder="2026-W41"
        spellCheck={false}
        aria-label="Semaine ISO à forcer"
        value={isoKey}
        onChange={(e) => setIsoKey(e.target.value)}
      />
      <span className="arrow">→</span>
      <select
        className="force-select"
        aria-label="Semaine de cycle à forcer"
        value={weekName}
        onChange={(e) => setWeekName(e.target.value)}
      >
        {weekNames.map((n) => (
          <option key={n} value={n}>{n}</option>
        ))}
      </select>
      <button type="button" className="btn btn-secondary" onClick={add}>
        + Forcer une semaine ISO
      </button>
      {error && <span className="warning-text" role="alert">{error}</span>}
    </div>
  );
}
