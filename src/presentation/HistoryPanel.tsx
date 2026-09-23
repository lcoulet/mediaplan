// HistoryPanel.tsx — Side panel listing undo/redo history entries
//
// Opened from the Header's "Historique" button or the H shortcut. Lists the
// in-memory history ring (newest first) with time, French action label and a
// derived diff summary (previous entry → this entry). Clicking an entry
// jumps the undo/redo pointer to that state via DataContext.jumpTo().
//
// The metadata (labels, timestamps) and the snapshots live only in memory:
// they are lost on page reload (accepted design — see the panel footer).

import { useEffect, useMemo } from 'react';
import { useData } from './DataContext';
import { formatTimeFr } from '../domain/models';
import { diffAppData, summarizeDiff } from '../domain/history-diff';

interface HistoryPanelProps {
  onClose: () => void;
}

export default function HistoryPanel({ onClose }: HistoryPanelProps) {
  const { getHistoryEntries, getHistoryPointer, jumpTo } = useData();

  // ESC closes the panel — the listener exists only while the panel is
  // mounted (no leak when closed; Modal.tsx keeps its own separate handler).
  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const entries = getHistoryEntries();
  const pointer = getHistoryPointer();

  // Newest first; every entry EXCEPT the oldest shows the diff summary of
  // (previous entry → this entry), derived at display time.
  const rows = useMemo(() => {
    return [...entries]
      .map((entry, index) => ({
        entry,
        index,
        summaryLines:
          index > 0 && entries[index - 1]
            ? summarizeDiff(diffAppData(entries[index - 1].data, entry.data))
            : [],
      }))
      .reverse();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, pointer]);

  return (
    <aside className="history-panel" aria-label="Historique">
      <div className="history-panel-header">
        <h3>Historique</h3>
        <button className="modal-close" onClick={onClose} title="Fermer">✕</button>
      </div>
      <div className="history-panel-body">
        {rows.map(({ entry, index, summaryLines }) => {
          const isCurrent = index === pointer;
          const isRedoSide = index > pointer;
          return (
            <div
              key={`${entry.at}-${index}`}
              className={`history-entry${isCurrent ? ' current' : ''}${isRedoSide ? ' redo-side' : ''}`}
              onClick={() => jumpTo(index)}
              role="button"
              tabIndex={0}
            >
              <div className="history-entry-head">
                <span className="history-entry-time">{formatTimeFr(entry.at)}</span>
                <span className="history-entry-label">{entry.label}</span>
                {isCurrent && <span className="history-entry-badge">— actuel</span>}
              </div>
              {summaryLines.length > 0 && (
                <ul className="history-entry-summary">
                  {summaryLines.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
      <div className="history-panel-footer">
        L'historique est conservé en mémoire — il est perdu au rechargement de la page
      </div>
    </aside>
  );
}
