// DataContext.tsx — Global state via Context API + useReducer

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useCallback,
  type ReactNode,
} from 'react';
import type { AppData, Mediator } from '../domain/types';
import type { ViewName } from './types';
import { createMediator, normalizeCompetences, parseLocalDate, toLocalDateString } from '../domain/models';
import { createHistory, DEFAULT_HISTORY_SIZE } from '../domain/history';
import { load, save, STORAGE_KEY } from '../infrastructure/store';
import type { AppState, Action } from './types';
import { seedDemoData } from './DemoData';

// ---- Week helpers ----

export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day; // Monday start
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ---- Initial state ----

function getInitialState(): AppState {
  let data = load();
  // Migrate: assign colors to mediators that don't have one
  data.mediators.forEach((m: Mediator) => {
    if (!m.color) {
      m.color = createMediator().color;
    }
  });
  // Migrate: skills -> competences
  data.mediators.forEach((m: Mediator) => {
    if (m.hasOwnProperty('skills') && !m.hasOwnProperty('competences')) {
      // @ts-ignore - legacy field
      const skills: string[] = m.skills || [];
      m.competences = skills.map(offerId => ({ offerId, status: 'confirmed' as const }));
      // @ts-ignore - remove legacy field
      delete m.skills;
    }
  });
  // Seed demo data ONLY on first launch (no localStorage key at all).
  // A user who deliberately cleared all data (Nettoyer les données) must
  // NOT get demo data back on reload.
  if (!localStorage.getItem(STORAGE_KEY)) {
    seedDemoData(data);
    save(data);
  }
  
  // Read view and date from URL if present
  let initialView: ViewName = 'daily';
  let initialDate = new Date();

  if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    const viewParam = urlParams.get('view') || urlParams.get('display');
    const dateParam = urlParams.get('date');

    const viewMap: Record<string, ViewName> = {
      'jour': 'daily',
      'journee': 'daily',
      'day': 'daily',
      'reservations': 'reservations',
      'hebdo': 'weekly',
      'week': 'weekly',
      'semaine': 'weekly',
      'mediateurs': 'mediators',
      'offres': 'offers',
      'absences': 'absences',
      'statistiques': 'stats',
      'import-export': 'import-export',
    };

    if (viewParam && viewMap[viewParam]) {
      initialView = viewMap[viewParam];
    }
    
    // If date is provided, use it (parsed as LOCAL midnight, no UTC shift)
    if (dateParam && !isNaN(parseLocalDate(dateParam).getTime())) {
      initialDate = parseLocalDate(dateParam);
    }
  }
  
  return {
    data,
    currentView: initialView,
    currentDate: initialDate,
    filters: { mediatorId: '', offerId: '' },
    absenceFilter: { mediatorId: '' },
    locked: true,
    showAbsences: true,
  };
}

// ---- Reducer ----

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_DATA':
      return { ...state, data: action.data };
    case 'SET_VIEW':
      return { ...state, currentView: action.view };
    case 'SET_CURRENT_DATE':
      return { ...state, currentDate: action.date };
    case 'SET_FILTER_MEDIATOR':
      return { ...state, filters: { ...state.filters, mediatorId: action.mediatorId } };
    case 'SET_FILTER_OFFER':
      return { ...state, filters: { ...state.filters, offerId: action.offerId } };
    case 'SET_ABSENCE_FILTER_MEDIATOR':
      return { ...state, absenceFilter: { mediatorId: action.mediatorId } };
    case 'SET_LOCKED':
      return { ...state, locked: action.locked };
    case 'SET_SHOW_ABSENCES':
      return { ...state, showAbsences: action.show };
    case 'SET_HALF_DAY_CONFIG':
      return {
        ...state,
        data: {
          ...state.data,
          halfDayConfig: action.config,
        },
      };
    case 'ADD_MEDIATOR':
      return {
        ...state,
        data: { ...state.data, mediators: [...state.data.mediators, action.mediator] },
      };
    case 'UPDATE_MEDIATOR':
      return {
        ...state,
        data: {
          ...state.data,
          mediators: state.data.mediators.map((m) =>
            m.id === action.mediator.id ? action.mediator : m
          ),
        },
      };
    case 'DELETE_MEDIATOR':
      return {
        ...state,
        data: {
          ...state.data,
          mediators: state.data.mediators.filter((m) => m.id !== action.id),
          slots: state.data.slots.filter((s) => !s.mediatorIds.includes(action.id)),
        },
      };
    case 'ADD_OFFER':
      return {
        ...state,
        data: { ...state.data, offers: [...state.data.offers, action.offer] },
      };
    case 'UPDATE_OFFER':
      return {
        ...state,
        data: {
          ...state.data,
          offers: state.data.offers.map((o) =>
            o.id === action.offer.id ? action.offer : o
          ),
        },
      };
    case 'DELETE_OFFER':
      return {
        ...state,
        data: {
          ...state.data,
          offers: state.data.offers.filter((o) => o.id !== action.id),
          slots: state.data.slots.filter((s) => s.offerId !== action.id),
          mediators: state.data.mediators.map((m) => ({
            ...m,
            competences: normalizeCompetences(m.competences.filter((c) => c.offerId !== action.id)),
          })),
        },
      };
    case 'ADD_SLOT':
      return {
        ...state,
        data: { ...state.data, slots: [...state.data.slots, action.slot] },
      };
    case 'UPDATE_SLOT':
      return {
        ...state,
        data: {
          ...state.data,
          slots: state.data.slots.map((s) =>
            s.id === action.slot.id ? action.slot : s
          ),
        },
      };
    case 'DELETE_SLOT':
      return {
        ...state,
        data: { ...state.data, slots: state.data.slots.filter((s) => s.id !== action.id) },
      };
    case 'ADD_ABSENCE':
      return {
        ...state,
        data: { ...state.data, absences: [...state.data.absences, action.absence] },
      };
    case 'UPDATE_ABSENCE':
      return {
        ...state,
        data: {
          ...state.data,
          absences: state.data.absences.map((a) =>
            a.id === action.absence.id ? action.absence : a
          ),
        },
      };
    case 'DELETE_ABSENCE':
      return {
        ...state,
        data: { ...state.data, absences: state.data.absences.filter((a) => a.id !== action.id) },
      };
    case 'UNDO':
      return { ...state, data: action.data };
    case 'REDO':
      return { ...state, data: action.data };
    case 'RESET_DATA':
      return { ...state, data: action.data };
    default:
      return state;
  }
}

// ---- Context interface ----

export interface DataContextValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  // History
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  resetData: () => void;
  // commit: saves to localStorage + pushes to history
  commit: (data?: AppData) => void;
  // body edit-mode class
}

const DataContext = createContext<DataContextValue | null>(null);

// ---- Provider ----

export function DataProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, getInitialState);
  const history = useMemo(() => createHistory<AppData>(DEFAULT_HISTORY_SIZE), []);

  // Keep the URL in sync with view + date (single source of truth).
  // Changing the view does NOT touch the date — the date param only
  // changes when the user navigates dates or weeks.
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const displayMap: Record<ViewName, string> = {
      'daily': 'day',
      'reservations': 'reservations',
      'weekly': 'week',
      'mediators': 'mediateurs',
      'offers': 'offres',
      'absences': 'absences',
      'stats': 'statistiques',
      'import-export': 'import-export',
    };
    urlParams.set('display', displayMap[state.currentView]);
    urlParams.set('date', toLocalDateString(state.currentDate));
    // Remove legacy 'view' param to avoid conflicting sources
    urlParams.delete('view');
    const newUrl = `${window.location.pathname}?${urlParams.toString()}`;
    window.history.replaceState({}, '', newUrl);
  }, [state.currentView, state.currentDate]);

  // Track undo/redo capability
  const [undoRedo, setUndoRedo] = useReducer(
    (_s: { canUndo: boolean; canRedo: boolean }, v: { canUndo: boolean; canRedo: boolean }) => v,
    { canUndo: false, canRedo: false }
  );

  const updateUndoRedo = useCallback(() => {
    setUndoRedo({ canUndo: history.canUndo(), canRedo: history.canRedo() });
  }, [history]);

  // Initialize history on mount
  useEffect(() => {
    history.init(state.data);
    updateUndoRedo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // commit: save to localStorage + push to history
  const commit = useCallback(
    (data?: AppData) => {
      const d = data ?? state.data;
      save(d);
      history.push(d);
      updateUndoRedo();
    },
    [state.data, history, updateUndoRedo]
  );

  // Undo
  const undo = useCallback(() => {
    const prev = history.undo();
    if (!prev) return;
    save(prev);
    dispatch({ type: 'UNDO', data: prev });
    updateUndoRedo();
  }, [history, updateUndoRedo]);

  // Redo
  const redo = useCallback(() => {
    const next = history.redo();
    if (!next) return;
    save(next);
    dispatch({ type: 'REDO', data: next });
    updateUndoRedo();
  }, [history, updateUndoRedo]);

  // Reset demo data
  const resetData = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    const fresh: AppData = { mediators: [], offers: [], schedules: [], slots: [], absences: [] };
    seedDemoData(fresh);
    save(fresh);
    history.init(fresh);
    dispatch({ type: 'RESET_DATA', data: fresh });
    updateUndoRedo();
  }, [history, updateUndoRedo]);

  // Keyboard shortcuts: Ctrl+Z, Ctrl+Shift+Z, Ctrl+Y
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === 'Z' || (e.key === 'z' && e.shiftKey) || e.key === 'y')
      ) {
        e.preventDefault();
        redo();
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [undo, redo]);

  // Body edit-mode class
  useEffect(() => {
    if (state.locked) {
      document.body.classList.remove('edit-mode');
    } else {
      document.body.classList.add('edit-mode');
    }
  }, [state.locked]);

  const value: DataContextValue = {
    state,
    dispatch,
    canUndo: undoRedo.canUndo,
    canRedo: undoRedo.canRedo,
    undo,
    redo,
    resetData,
    commit,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

// ---- Hook ----

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}

// ---- Convenience: dispatch + commit ----
// Components call dispatchCRUD to modify data; the helper auto-commits.

export function useCRUD() {
  const { state, dispatch, commit } = useData();

  return useCallback(
    (action: Action) => {
      dispatch(action);
      // After dispatch, the state hasn't updated yet synchronously (React batches).
      // We need to compute the new data and commit it.
      // For simplicity, we compute the next data here and pass it to commit.
      let nextData = state.data;
      switch (action.type) {
        case 'ADD_MEDIATOR':
          nextData = { ...state.data, mediators: [...state.data.mediators, action.mediator] };
          break;
        case 'UPDATE_MEDIATOR':
          nextData = {
            ...state.data,
            mediators: state.data.mediators.map((m) =>
              m.id === action.mediator.id ? action.mediator : m
            ),
          };
          break;
        case 'DELETE_MEDIATOR':
          nextData = {
            ...state.data,
            mediators: state.data.mediators.filter((m) => m.id !== action.id),
            slots: state.data.slots.filter((s) => !s.mediatorIds.includes(action.id)),
          };
          break;
        case 'ADD_OFFER':
          nextData = { ...state.data, offers: [...state.data.offers, action.offer] };
          break;
        case 'UPDATE_OFFER':
          nextData = {
            ...state.data,
            offers: state.data.offers.map((o) =>
              o.id === action.offer.id ? action.offer : o
            ),
          };
          break;
        case 'DELETE_OFFER':
          nextData = {
            ...state.data,
            offers: state.data.offers.filter((o) => o.id !== action.id),
            slots: state.data.slots.filter((s) => s.offerId !== action.id),
            mediators: state.data.mediators.map((m) => ({
              ...m,
              competences: normalizeCompetences(m.competences.filter((c) => c.offerId !== action.id)),
            })),
          };
          break;
        case 'ADD_SLOT':
          nextData = { ...state.data, slots: [...state.data.slots, action.slot] };
          break;
        case 'UPDATE_SLOT':
          nextData = {
            ...state.data,
            slots: state.data.slots.map((s) => (s.id === action.slot.id ? action.slot : s)),
          };
          break;
        case 'DELETE_SLOT':
          nextData = { ...state.data, slots: state.data.slots.filter((s) => s.id !== action.id) };
          break;
        case 'ADD_ABSENCE':
          nextData = { ...state.data, absences: [...state.data.absences, action.absence] };
          break;
        case 'UPDATE_ABSENCE':
          nextData = {
            ...state.data,
            absences: state.data.absences.map((a) =>
              a.id === action.absence.id ? action.absence : a
            ),
          };
          break;
        case 'DELETE_ABSENCE':
          nextData = { ...state.data, absences: state.data.absences.filter((a) => a.id !== action.id) };
          break;
        case 'SET_HALF_DAY_CONFIG':
          nextData = { ...state.data, halfDayConfig: action.config };
          break;
        default:
          return; // non-CRUD action
      }
      // Dispatch the action AND commit the computed next state
      commit(nextData);
    },
    [state.data, dispatch, commit]
  );
}
