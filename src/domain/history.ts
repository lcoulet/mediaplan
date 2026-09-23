// history.ts — Undo/redo state history manager
// Pure logic, no browser APIs — testable in Node
//
// Each entry carries display metadata (per ADR-0004 the stored state stays a
// full snapshot): a French action label and a commit timestamp. Both live
// only in memory — they are never persisted in AppData/localStorage.

export const DEFAULT_HISTORY_SIZE = 50;

// Label used when a commit provides no explicit one
export const DEFAULT_HISTORY_LABEL = 'Modification';

export interface HistoryEntryMeta {
  label: string;
  // Commit time, epoch ms (Date.now())
  at: number;
}

export interface HistoryEntry<T = unknown> {
  data: T;
  label: string;
  at: number;
}

function deepClone<T>(obj: T): T {
  return structuredClone ? structuredClone(obj) : JSON.parse(JSON.stringify(obj));
}

export interface History<T = unknown> {
  init: (data: T) => void;
  push: (data: T, meta?: HistoryEntryMeta) => void;
  undo: () => T | null;
  redo: () => T | null;
  getCurrent: () => T | null;
  canUndo: () => boolean;
  canRedo: () => boolean;
  getSize: () => number;
  // Full ring, oldest first — for rendering the history panel
  getEntries: () => HistoryEntry<T>[];
  // Index of the current state within the ring (-1 before init)
  getPointer: () => number;
}

export function createHistory<T = unknown>(maxSize: number = DEFAULT_HISTORY_SIZE): History<T> {
  // Parallel to `states`: label + timestamp per entry (kept separate so the
  // data snapshots stay plain deep-cloned AppData objects)
  const states: T[] = [];
  const metas: HistoryEntryMeta[] = [];
  let pointer = -1; // index of the current state

  function init(data: T): void {
    states.length = 0;
    metas.length = 0;
    states.push(deepClone(data));
    metas.push({ label: DEFAULT_HISTORY_LABEL, at: Date.now() });
    pointer = 0;
  }

  function push(data: T, meta?: HistoryEntryMeta): void {
    // Drop any redo states (everything after pointer)
    if (pointer < states.length - 1) {
      states.length = pointer + 1;
      metas.length = pointer + 1;
    }
    states.push(deepClone(data));
    metas.push({
      label: meta?.label ?? DEFAULT_HISTORY_LABEL,
      at: meta?.at ?? Date.now(),
    });
    // Enforce max size: remove oldest entries
    while (states.length > maxSize) {
      states.shift();
      metas.shift();
    }
    pointer = states.length - 1;
  }

  function undo(): T | null {
    if (pointer <= 0) return null;
    pointer--;
    return deepClone(states[pointer]);
  }

  function redo(): T | null {
    if (pointer >= states.length - 1) return null;
    pointer++;
    return deepClone(states[pointer]);
  }

  function getCurrent(): T | null {
    if (pointer < 0 || pointer >= states.length) return null;
    return deepClone(states[pointer]);
  }

  function canUndo(): boolean {
    return pointer > 0;
  }

  function canRedo(): boolean {
    return pointer < states.length - 1;
  }

  function getSize(): number {
    return states.length;
  }

  function getEntries(): HistoryEntry<T>[] {
    return states.map((data, i) => ({
      data: deepClone(data),
      label: metas[i].label,
      at: metas[i].at,
    }));
  }

  function getPointer(): number {
    return pointer;
  }

  return {
    init,
    push,
    undo,
    redo,
    getCurrent,
    canUndo,
    canRedo,
    getSize,
    getEntries,
    getPointer,
  };
}
