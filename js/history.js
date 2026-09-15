// history.js — Undo/redo state history manager
// Pure logic, no browser APIs — testable in Node

export const DEFAULT_HISTORY_SIZE = 50;

function deepClone(obj) {
    return structuredClone ? structuredClone(obj) : JSON.parse(JSON.stringify(obj));
}

export function createHistory(maxSize = DEFAULT_HISTORY_SIZE) {
    const states = [];
    let pointer = -1; // index of the current state

    function init(data) {
        states.length = 0;
        states.push(deepClone(data));
        pointer = 0;
    }

    function push(data) {
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

    function undo() {
        if (pointer <= 0) return null;
        pointer--;
        return deepClone(states[pointer]);
    }

    function redo() {
        if (pointer >= states.length - 1) return null;
        pointer++;
        return deepClone(states[pointer]);
    }

    function getCurrent() {
        if (pointer < 0 || pointer >= states.length) return null;
        return deepClone(states[pointer]);
    }

    function canUndo() {
        return pointer > 0;
    }

    function canRedo() {
        return pointer < states.length - 1;
    }

    function getSize() {
        return states.length;
    }

    return { init, push, undo, redo, getCurrent, canUndo, canRedo, getSize };
}
