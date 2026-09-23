// useKeyboardShortcuts.ts — Global keyboard shortcuts (view switch, date
// navigation, new-entity modals, user guide)
//
// Mounted ONCE, inside DataProvider (a child of the provider, e.g. next to
// ViewRouter in App.tsx), because it reads the context via useData().
//
// Shortcuts (all ignored when typing in a form field or when a modal is open):
//   1-8        switch views (Header nav order)
//   ←/→        previous/next day in daily view, ±7 days in weekly view
//   T          jump to today (daily and weekly views)
//   N          open the current view's "new entity" modal (mediators/offers/absences)
//   H          open/close the history panel (same as the Header button)
//   ?          open the user guide in a new tab
//
// Ctrl/Meta/Alt+<key> combinations are left to the browser and to the existing
// undo/redo handlers in DataContext (Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y).

import { useEffect } from 'react';
import { useData } from './DataContext';
import type { ViewName } from './types';

// Digit → view, in the Header's nav order
export const SHORTCUT_VIEWS: ViewName[] = [
  'daily',
  'weekly',
  'reservations',
  'mediators',
  'offers',
  'absences',
  'stats',
  'import-export',
];

// True when a keydown event must NOT trigger a shortcut: the event target is
// a form control (input, textarea, select), a contentEditable element, or one
// of the hidden date pickers.
export function shouldIgnoreShortcut(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  // jsdom does not implement isContentEditable — check the attribute
  if (target.getAttribute('contenteditable') === 'true') return true;
  if (target.classList.contains('date-picker-input')) return true;
  return false;
}

// True when any modal is open (Modal.tsx renders .modal-overlay)
export function isModalOpen(): boolean {
  return document.querySelector('.modal-overlay') !== null;
}

export default function useKeyboardShortcuts() {
  const { state, dispatch } = useData();

  useEffect(() => {
    function handleKeydown(e: KeyboardEvent) {
      // Never intercept browser/undo-redo modifier combos
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      // Typing in a field: leave the keys to the field
      if (shouldIgnoreShortcut(e.target)) return;
      // A modal is open: leave the keys to the modal (ESC closes it)
      if (isModalOpen()) return;

      // ? opens the user guide in a new tab (same target as the Header link)
      if (e.key === '?') {
        window.open('guide/index.html', '_blank');
        return;
      }

      // H opens the history panel, reusing the Header's own button (the
      // panel is a side panel, not a modal — isModalOpen stays accurate)
      if (e.key === 'h' || e.key === 'H') {
        const button = document.getElementById('btn-history');
        if (button instanceof HTMLElement) button.click();
        return;
      }

      // 1-8 switch views, in the Header's nav order
      if (e.key >= '1' && e.key <= '8') {
        const view = SHORTCUT_VIEWS[Number(e.key) - 1];
        if (view) dispatch({ type: 'SET_VIEW', view });
        return;
      }

      // Date navigation — only in the daily and weekly views
      if (state.currentView === 'daily' || state.currentView === 'weekly') {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          const sign = e.key === 'ArrowRight' ? 1 : -1;
          // Weekly: move by whole weeks (same weekday); daily: move by one day
          const days = state.currentView === 'weekly' ? 7 : 1;
          const d = new Date(state.currentDate);
          d.setDate(d.getDate() + sign * days);
          dispatch({ type: 'SET_CURRENT_DATE', date: d });
          return;
        }

        // T jumps to today (same as the "Aujourd'hui" button)
        if (e.key === 't' || e.key === 'T') {
          dispatch({ type: 'SET_CURRENT_DATE', date: new Date() });
          return;
        }
      }

      // N opens the current view's "new entity" modal, reusing exactly the
      // views' own buttons so the modal logic is never duplicated here.
      if (e.key === 'n' || e.key === 'N') {
        const buttonIds: Partial<Record<ViewName, string>> = {
          mediators: 'btn-add-mediator',
          offers: 'btn-add-offer',
          absences: 'btn-add-absence',
        };
        const id = buttonIds[state.currentView];
        if (id) {
          const button = document.getElementById(id);
          if (button instanceof HTMLElement) button.click();
        }
      }
    }

    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  }, [state.currentView, state.currentDate, dispatch]);
}
