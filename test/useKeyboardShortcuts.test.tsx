// useKeyboardShortcuts.test.tsx — Tests for the global keyboard shortcuts hook
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { DataProvider, useData } from '../src/presentation/DataContext';
import useKeyboardShortcuts from '../src/presentation/useKeyboardShortcuts';
import {
  shouldIgnoreShortcut,
  SHORTCUT_VIEWS,
} from '../src/presentation/useKeyboardShortcuts';
import MediatorsView from '../src/presentation/MediatorsView';
import OffersView from '../src/presentation/OffersView';
import AbsencesView from '../src/presentation/AbsencesView';
import type { AppData } from '../src/domain/types';

// Minimal data set: one active mediator, one offer, no slots
const mockData: AppData = {
  mediators: [
    { id: 'm1', firstName: 'Jean', lastName: 'Dupont', email: '', phone: '', notes: '', color: '#FF0000', active: true, competences: [] },
  ],
  offers: [
    { id: 'o1', name: 'Visite guidée', description: '', duration: 60, capacity: 20, location: 'Salle 1', setupTime: 10, teardownTime: 10, welcomeType: 'Réservable encadrée par médiateur' },
  ],
  schedules: [],
  slots: [],
  absences: [],
};

// Host component mounting the hook INSIDE DataProvider (useData rule)
function Host() {
  useKeyboardShortcuts();
  return null;
}

// Test-only component rendering the current view + date so assertions can
// read the rendered DOM instead of internal state.
function Probe() {
  const { state } = useData();
  return (
    <div>
      <div data-testid="view">{state.currentView}</div>
      <div data-testid="date">{toLocalYMD(state.currentDate)}</div>
    </div>
  );
}

// KeyboardEventInit helper (jsdom does not expose modifiers via fireEvent.keyDown
// reliably for all keys; build the event explicitly)
function keyDown(key: string, opts: KeyboardEventInit = {}) {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...opts,
  });
  act(() => {
    document.dispatchEvent(event);
  });
}

// Mini view router rendering the real views that own creation modals (so the
// N shortcut can reach their own "+ Ajouter" buttons)
function ModalViews() {
  const { state } = useData();
  switch (state.currentView) {
    case 'mediators':
      return <MediatorsView />;
    case 'offers':
      return <OffersView />;
    case 'absences':
      return <AbsencesView />;
    default:
      return null;
  }
}

function renderApp(withViews = false) {
  return render(
    <DataProvider>
      <Host />
      <Probe />
      {withViews && <ModalViews />}
    </DataProvider>
  );
}

describe('useKeyboardShortcuts', () => {
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

  describe('digit shortcuts switch views', () => {
    it.each([
      ['1', 'daily'],
      ['2', 'weekly'],
      ['3', 'reservations'],
      ['4', 'mediators'],
      ['5', 'offers'],
      ['6', 'absences'],
      ['7', 'stats'],
      ['8', 'import-export'],
    ] as const)('key %s switches to %s view', (key, view) => {
      renderApp();
      // Initial view is daily
      expect(screen.getByTestId('view').textContent).toBe('daily');
      keyDown(key);
      expect(screen.getByTestId('view').textContent).toBe(view);
    });

    it('ignores digits with Ctrl modifier (browser tab shortcuts)', () => {
      renderApp();
      keyDown('2', { ctrlKey: true });
      expect(screen.getByTestId('view').textContent).toBe('daily');
    });

    it('ignores digits with Alt modifier', () => {
      renderApp();
      keyDown('2', { altKey: true });
      expect(screen.getByTestId('view').textContent).toBe('daily');
    });

    it('ignores digits with Meta modifier', () => {
      renderApp();
      keyDown('2', { metaKey: true });
      expect(screen.getByTestId('view').textContent).toBe('daily');
    });
  });

  describe('arrow navigation in day and week views', () => {
    it('ArrowRight moves to the next day in daily view', () => {
      renderApp();
      const before = screen.getByTestId('date').textContent;
      keyDown('ArrowRight');
      const after = screen.getByTestId('date').textContent;
      expect(after).not.toBe(before);
      expect(new Date(after!).getTime() - new Date(before!).getTime()).toBe(24 * 3600 * 1000);
    });

    it('ArrowLeft moves to the previous day in daily view', () => {
      renderApp();
      const before = screen.getByTestId('date').textContent;
      keyDown('ArrowLeft');
      const after = screen.getByTestId('date').textContent;
      expect(new Date(before!).getTime() - new Date(after!).getTime()).toBe(24 * 3600 * 1000);
    });

    it('ArrowRight moves +7 days in weekly view', () => {
      renderApp();
      keyDown('2'); // weekly
      const before = screen.getByTestId('date').textContent;
      keyDown('ArrowRight');
      const after = screen.getByTestId('date').textContent;
      expect(new Date(after!).getTime() - new Date(before!).getTime()).toBe(7 * 24 * 3600 * 1000);
    });

    it('ArrowLeft moves -7 days in weekly view', () => {
      renderApp();
      keyDown('2'); // weekly
      const before = screen.getByTestId('date').textContent;
      keyDown('ArrowLeft');
      const after = screen.getByTestId('date').textContent;
      expect(new Date(before!).getTime() - new Date(after!).getTime()).toBe(7 * 24 * 3600 * 1000);
    });

    it('does nothing in mediators view', () => {
      renderApp();
      keyDown('4'); // mediators
      const before = screen.getByTestId('date').textContent;
      keyDown('ArrowRight');
      expect(screen.getByTestId('date').textContent).toBe(before);
    });
  });

  describe('T jumps to today', () => {
    it('jumps to today in daily view', () => {
      renderApp();
      // Navigate away from today first
      keyDown('ArrowRight');
      keyDown('ArrowRight');
      expect(screen.getByTestId('date').textContent).not.toBe(
        new Date().toISOString().slice(0, 10)
      );
      keyDown('t');
      expect(screen.getByTestId('date').textContent).toBe(
        toLocalYMD(new Date())
      );
    });

    it('jumps to today in weekly view', () => {
      renderApp();
      keyDown('2'); // weekly
      keyDown('ArrowLeft');
      keyDown('t');
      expect(screen.getByTestId('date').textContent).toBe(toLocalYMD(new Date()));
    });

    it('does nothing in mediators view', () => {
      renderApp();
      keyDown('ArrowRight'); // move off today in daily view
      keyDown('4'); // mediators
      const before = screen.getByTestId('date').textContent;
      keyDown('t');
      expect(screen.getByTestId('date').textContent).toBe(before);
      expect(before).not.toBe(toLocalYMD(new Date()));
    });

    it('ignores Ctrl+T (browser new tab)', () => {
      renderApp();
      const before = screen.getByTestId('date').textContent;
      keyDown('t', { ctrlKey: true });
      expect(screen.getByTestId('date').textContent).toBe(before);
    });
  });

  describe('N opens the new-entity modal', () => {
    it('opens the mediator modal in mediators view', () => {
      renderApp(true);
      keyDown('4'); // mediators
      keyDown('n');
      expect(screen.getByText('Nouveau médiateur')).toBeInTheDocument();
    });

    it('opens the offer modal in offers view', () => {
      renderApp(true);
      keyDown('5'); // offers
      keyDown('n');
      expect(screen.getByText('Nouvelle offre')).toBeInTheDocument();
    });

    it('opens the absence modal in absences view', () => {
      renderApp(true);
      keyDown('6'); // absences
      keyDown('n');
      expect(screen.getByText('Nouvelle absence')).toBeInTheDocument();
    });

    it('does nothing in daily view', () => {
      renderApp();
      keyDown('n');
      expect(screen.queryByText('Nouveau médiateur')).not.toBeInTheDocument();
    });

    it('ignores Ctrl+N (browser new window)', () => {
      renderApp(true);
      keyDown('4'); // mediators
      keyDown('n', { ctrlKey: true });
      expect(screen.queryByText('Nouveau médiateur')).not.toBeInTheDocument();
    });
  });

  describe('? opens the user guide', () => {
    it('calls window.open with the guide URL in a new tab', () => {
      const openSpy = vi.fn();
      vi.stubGlobal('open', openSpy);
      renderApp();
      keyDown('?');
      expect(openSpy).toHaveBeenCalledWith('guide/index.html', '_blank');
    });
  });

  describe('guards', () => {
    it('ignores shortcuts when the target is an input', () => {
      renderApp();
      const input = document.createElement('input');
      document.body.appendChild(input);
      act(() => {
        input.focus();
        input.dispatchEvent(
          new KeyboardEvent('keydown', { key: '2', bubbles: true, cancelable: true })
        );
      });
      expect(screen.getByTestId('view').textContent).toBe('daily');
      input.remove();
    });

    it('ignores shortcuts when the target is a textarea', () => {
      renderApp();
      const ta = document.createElement('textarea');
      document.body.appendChild(ta);
      act(() => {
        ta.focus();
        ta.dispatchEvent(
          new KeyboardEvent('keydown', { key: '2', bubbles: true, cancelable: true })
        );
      });
      expect(screen.getByTestId('view').textContent).toBe('daily');
      ta.remove();
    });

    it('ignores shortcuts when the target is a select', () => {
      renderApp();
      const sel = document.createElement('select');
      document.body.appendChild(sel);
      act(() => {
        sel.focus();
        sel.dispatchEvent(
          new KeyboardEvent('keydown', { key: '2', bubbles: true, cancelable: true })
        );
      });
      expect(screen.getByTestId('view').textContent).toBe('daily');
      sel.remove();
    });

    it('ignores shortcuts when the target is contentEditable', () => {
      renderApp();
      const div = document.createElement('div');
      div.setAttribute('contenteditable', 'true');
      document.body.appendChild(div);
      act(() => {
        div.focus();
        div.dispatchEvent(
          new KeyboardEvent('keydown', { key: '2', bubbles: true, cancelable: true })
        );
      });
      expect(screen.getByTestId('view').textContent).toBe('daily');
      div.remove();
    });

    it('ignores shortcuts when the target is a .date-picker-input', () => {
      renderApp();
      const input = document.createElement('input');
      input.type = 'date';
      input.className = 'date-picker-input';
      document.body.appendChild(input);
      act(() => {
        input.focus();
        input.dispatchEvent(
          new KeyboardEvent('keydown', { key: '2', bubbles: true, cancelable: true })
        );
      });
      expect(screen.getByTestId('view').textContent).toBe('daily');
      input.remove();
    });

    it('ignores shortcuts when a modal is open (modal-overlay in the DOM)', () => {
      renderApp(true);
      keyDown('4'); // mediators
      keyDown('n'); // open modal -> .modal-overlay exists
      expect(screen.getByText('Nouveau médiateur')).toBeInTheDocument();
      // Press view-switch keys while the modal is open
      keyDown('2');
      keyDown('t');
      expect(screen.getByTestId('view').textContent).toBe('mediators');
      // ESC still closes the modal (existing Modal.tsx behavior)
      act(() => {
        fireEvent.keyDown(document, { key: 'Escape' });
      });
      expect(screen.queryByText('Nouveau médiateur')).not.toBeInTheDocument();
    });
  });

  describe('shouldIgnoreShortcut (pure helper)', () => {
    it('ignores input, textarea, select and contentEditable targets', () => {
      expect(shouldIgnoreShortcut(document.createElement('input'))).toBe(true);
      expect(shouldIgnoreShortcut(document.createElement('textarea'))).toBe(true);
      expect(shouldIgnoreShortcut(document.createElement('select'))).toBe(true);
      const editable = document.createElement('div');
      editable.setAttribute('contenteditable', 'true');
      expect(shouldIgnoreShortcut(editable)).toBe(true);
    });

    it('ignores .date-picker-input targets', () => {
      const el = document.createElement('input');
      el.className = 'date-picker-input';
      expect(shouldIgnoreShortcut(el)).toBe(true);
    });

    it('does not ignore plain elements', () => {
      expect(shouldIgnoreShortcut(document.createElement('div'))).toBe(false);
    });

    it('exposes the digit→view mapping in Header order', () => {
      expect(SHORTCUT_VIEWS).toEqual([
        'daily',
        'weekly',
        'reservations',
        'mediators',
        'offers',
        'absences',
        'stats',
        'import-export',
      ]);
    });
  });
});

// Local YYYY-MM-DD (test env timezone), matching toLocalDateString semantics
function toLocalYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
