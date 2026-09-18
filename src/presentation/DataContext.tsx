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
import { createMediator } from '../domain/models';
import { createHistory, DEFAULT_HISTORY_SIZE } from '../domain/history';
import { load, save } from '../infrastructure/store';
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
  if (data.mediators.length === 0 && data.offers.length === 0) {
    seedDemoData(data);
    save(data);
  }
  return {
    data,
    currentView: 'calendar',
    currentWeekStart: getWeekStart(new Date()),
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
    case 'SET_WEEK_START':
      return { ...state, currentWeekStart: action.date };
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
            skills: m.skills.filter((sid) => sid !== action.id),
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
    localStorage.removeItem('mediaplan_data_v1');
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
              skills: m.skills.filter((sid) => sid !== action.id),
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
        default:
          return; // non-CRUD action
      }
      // Dispatch the action AND commit the computed next state
      commit(nextData);
    },
    [state.data, dispatch, commit]
  );
}
