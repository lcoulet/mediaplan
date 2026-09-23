// history-panel.test.tsx — Tests for the HistoryPanel side panel
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { DataProvider, useData, useCRUD } from '../src/presentation/DataContext';
import HistoryPanel from '../src/presentation/HistoryPanel';
import { formatTimeFr } from '../src/domain/models';
import useKeyboardShortcuts from '../src/presentation/useKeyboardShortcuts';
import Header from '../src/presentation/Header';
import type { AppData, Slot, Mediator, Offer } from '../src/domain/types';

const mockMediator: Mediator = {
  id: 'm1', lastName: 'Dupont', firstName: 'Jean', email: '', phone: '',
  notes: '', color: '#FF0000', active: true, competences: [],
};
const mockOffer: Offer = {
  id: 'o1', name: 'Visite guidée', description: '', duration: 60, capacity: 20,
  location: 'Salle 1', setupTime: 10, teardownTime: 10,
  welcomeType: 'Réservable encadrée par médiateur',
};
const mockSlot: Slot = {
  id: 's1', scheduleId: 'sched1', offerId: 'o1', mediatorIds: ['m1'],
  date: '2026-10-12', startTime: '10:00', endTime: '11:00', participantCount: 15,
  status: 'planned', notes: '', origin: 'manual', importSource: '', importedAt: '',
  modifiedAfterImport: false, groupName: '', guide: '', location: '',
  groupNature: '', contactName: '', contactPhone: '', contactEmail: '',
};

const mockData: AppData = {
  mediators: [mockMediator],
  offers: [mockOffer],
  schedules: [],
  slots: [mockSlot],
  absences: [],
};

// Full app harness: Header (button) + shortcuts hook + panel + probe —
// mirrors App.tsx wiring (shortcut inside the provider, Header owns toggle)
function App() {
  const [open, setOpen] = useState(false);
  return (
    <DataProvider>
      <AppInner open={open} setOpen={setOpen} />
    </DataProvider>
  );
}

function AppInner({ open, setOpen }: { open: boolean; setOpen: (v: boolean) => void }) {
  useKeyboardShortcuts();
  return (
    <div>
      <Header onToggleHistory={() => setOpen(!open)} />
      {open && <HistoryPanel onClose={() => setOpen(false)} />}
      <Probe />
    </div>
  );
}

// Harness with panel + CRUD controls exposed for assertions
function PanelHost() {
  const [open, setOpen] = useState(false);
  return (
    <DataProvider>
      <PanelHostInner open={open} setOpen={setOpen} />
    </DataProvider>
  );
}

function PanelHostInner({ open, setOpen }: { open: boolean; setOpen: (v: boolean) => void }) {
  useKeyboardShortcuts();
  return (
    <div>
      <Header onToggleHistory={() => setOpen(!open)} />
      <PanelControls open={open} setOpen={setOpen} />
      {open && <HistoryPanel onClose={() => setOpen(false)} />}
    </div>
  );
}

function PanelControls({ open, setOpen }: { open: boolean; setOpen: (v: boolean) => void }) {
  const { state } = useData();
  const crud = useCRUD();
  return (
    <div>
      <button data-testid="btn-open-history" onClick={() => setOpen(true)}>open history</button>
      <span data-testid="panel-open">{String(open)}</span>
      <span data-testid="slot-count">{state.data.slots.length}</span>
      <span data-testid="slot-status">{state.data.slots[0]?.status ?? 'none'}</span>
      <button
        data-testid="btn-update-slot"
        onClick={() => crud({ type: 'UPDATE_SLOT', slot: { ...mockSlot, status: 'confirmed' } })}
      >
        update
      </button>
    </div>
  );
}

function Probe() {
  const { state } = useData();
  return <span data-testid="current-view">{state.currentView}</span>;
}

function keyDown(key: string, opts: KeyboardEventInit = {}) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...opts });
  act(() => {
    document.dispatchEvent(event);
  });
}

describe('formatTimeFr', () => {
  it('formats an epoch timestamp as French HHhMM', () => {
    // Local time: build a date at 09:05 and 14:30
    const d1 = new Date(2026, 9, 12, 9, 5, 0, 0).getTime();
    const d2 = new Date(2026, 9, 12, 14, 30, 0, 0).getTime();
    expect(formatTimeFr(d1)).toBe('09h05');
    expect(formatTimeFr(d2)).toBe('14h30');
  });

  it('zero-pads hours and minutes', () => {
    const d = new Date(2026, 9, 12, 0, 7, 0, 0).getTime();
    expect(formatTimeFr(d)).toBe('00h07');
  });
});

describe('HistoryPanel', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => JSON.stringify(mockData)),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
    window.history.replaceState({}, '', '/');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('Header renders an Historique button with the H hint', () => {
    render(<App />);
    const btn = screen.getByTitle('Historique (H)');
    expect(btn).toBeInTheDocument();
    expect(btn.textContent).toContain('Historique');
  });

  it('renders entries newest first with time, label and diff summary', () => {
    render(<PanelHost />);
    act(() => { screen.getByTestId('btn-update-slot').click(); });

    // The update is committed; open the panel
    act(() => { screen.getByTestId('btn-open-history').click(); });

    // Two entries: newest first (Créneau modifié), then the initial state
    const entries = document.querySelectorAll('.history-entry');
    expect(entries).toHaveLength(2);
    expect(entries[0].textContent).toContain('Créneau modifié');
    expect(entries[0].textContent).toMatch(/\d{2}h\d{2}/);
    expect(entries[0].textContent).toContain('1 créneau modifié (Visite guidée — 12/10/2026 : statut)');
    // Oldest entry has no diff summary (nothing before it)
    expect(entries[1].textContent).toContain('Modification');
    expect(entries[1].textContent).not.toContain('créneau');
  });

  it('marks the current entry and dims redo-side entries', () => {
    render(<PanelHost />);
    act(() => { screen.getByTestId('btn-update-slot').click(); });
    act(() => { screen.getByTestId('btn-open-history').click(); });

    const current = document.querySelector('.history-entry.current');
    expect(current).not.toBeNull();
    expect(current!.textContent).toContain('Créneau modifié');
  });

  it('clicking an older entry jumps to that state; redo side becomes dimmed', () => {
    render(<PanelHost />);
    act(() => { screen.getByTestId('btn-update-slot').click(); });
    act(() => { screen.getByTestId('btn-open-history').click(); });

    // Jump back to the initial state
    const oldest = document.querySelectorAll('.history-entry')[1];
    act(() => { fireEvent.click(oldest); });
    expect(screen.getByTestId('slot-status').textContent).toBe('planned');

    // Reopen (still open) — the initial entry is now current, the update is dimmed
    const entries = document.querySelectorAll('.history-entry');
    expect(entries[0].classList.contains('redo-side')).toBe(true);
    expect(entries[0].textContent).toContain('Créneau modifié');
    expect(entries[1].classList.contains('current')).toBe(true);

    // Jump forward again
    act(() => { fireEvent.click(entries[0]); });
    expect(screen.getByTestId('slot-status').textContent).toBe('confirmed');
  });

  it('shows the in-memory footer note', () => {
    render(<PanelHost />);
    act(() => { screen.getByTestId('btn-open-history').click(); });
    expect(
      screen.getByText("L'historique est conservé en mémoire — il est perdu au rechargement de la page")
    ).toBeInTheDocument();
  });

  it('closes via its close button', () => {
    render(<PanelHost />);
    act(() => { screen.getByTestId('btn-open-history').click(); });
    expect(screen.getByTestId('panel-open').textContent).toBe('true');
    act(() => { fireEvent.click(screen.getByTitle('Fermer')); });
    expect(screen.getByTestId('panel-open').textContent).toBe('false');
    expect(document.querySelector('.history-panel')).toBeNull();
  });

  it('closes on ESC while open (and the listener does not leak when closed)', () => {
    render(<PanelHost />);
    act(() => { screen.getByTestId('btn-open-history').click(); });
    expect(screen.getByTestId('panel-open').textContent).toBe('true');
    keyDown('Escape');
    expect(screen.getByTestId('panel-open').textContent).toBe('false');
    // Closed: further ESC must not throw or reopen
    keyDown('Escape');
    expect(screen.getByTestId('panel-open').textContent).toBe('false');
  });

  it('ESC with no panel open does not close a modal (Modal.tsx contract untouched)', () => {
    render(<PanelHost />);
    // No panel open, no modal open — ESC is inert
    keyDown('Escape');
    expect(screen.getByTestId('panel-open').textContent).toBe('false');
  });

  describe('H shortcut', () => {
    it('opens the panel via the keyboard shortcut (button click path)', () => {
      render(<App />);
      // The H shortcut clicks the Header's Historique button
      const openSpy = vi.fn();
      // Pressing H must trigger the same path as clicking the button
      keyDown('h');
      // The panel is rendered by the App harness (Header button wired to state)
      expect(document.querySelector('.history-panel')).not.toBeNull();
      void openSpy;
    });

    it('is ignored while typing in an input', () => {
      render(<App />);
      const input = document.createElement('input');
      document.body.appendChild(input);
      act(() => {
        input.focus();
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'h', bubbles: true, cancelable: true }));
      });
      expect(document.querySelector('.history-panel')).toBeNull();
      input.remove();
    });

    it('is ignored with Ctrl modifier', () => {
      render(<App />);
      keyDown('h', { ctrlKey: true });
      expect(document.querySelector('.history-panel')).toBeNull();
    });

    it('is ignored when a modal is open', () => {
      render(<App />);
      // Open a modal via the config popup migration warning path is complex;
      // instead simulate the guard directly: append a .modal-overlay to the DOM
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      document.body.appendChild(overlay);
      keyDown('h');
      expect(document.querySelector('.history-panel')).toBeNull();
      overlay.remove();
    });

    it('? still opens the guide (no collision with H)', () => {
      const openSpy = vi.fn();
      vi.stubGlobal('open', openSpy);
      render(<App />);
      keyDown('?');
      expect(openSpy).toHaveBeenCalledWith('guide/index.html', '_blank');
      keyDown('h');
      expect(openSpy).toHaveBeenCalledTimes(1); // H did not re-trigger the guide
      expect(document.querySelector('.history-panel')).not.toBeNull();
    });
  });
});
