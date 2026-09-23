// history.ts — Undo/redo state history manager
// Pure logic, no browser APIs — testable in Node

export const DEFAULT_HISTORY_SIZE = 50;

function deepClone<T>(obj: T): T {
  return structuredClone ? structuredClone(obj) : JSON.parse(JSON.stringify(obj));
}

export interface History<T = unknown> {
  init: (data: T) => void;
  push: (data: T) => void;
  undo: () => T | null;
  redo: () => T | null;
  getCurrent: () => T | null;
  canUndo: () => boolean;
  canRedo: () => boolean;
  getSize: () => number;
}

export function createHistory<T = unknown>(maxSize: number = DEFAULT_HISTORY_SIZE): History<T> {
  const states: T[] = [];
  let pointer = -1; // index of the current state

  function init(data: T): void {
    states.length = 0;
    states.push(deepClone(data));
    pointer = 0;
  }

  function push(data: T): void {
    // Drop any redo states (everything after pointer)
    if (pointer < states.length - 1) {
      states.length = pointer + 1;
    }
    states.push(deepClone(data));
    // Enforce max size: remove oldest entries
    while (states.length > maxSize) {
      states.shift();
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

  return { init, push, undo, redo, getCurrent, canUndo, canRedo, getSize };
}
