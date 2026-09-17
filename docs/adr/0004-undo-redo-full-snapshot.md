# ADR-0004: Undo/redo via full-state snapshots

## Status
Accepted (2026-09-13)

## Context
The app needs undo/redo. Two approaches: full-state snapshots (copy entire
data model on each change) or diff-based (record only what changed).

Alternatives considered:
- Diff/patch (e.g., JSON patch RFC 6902): memory-efficient, but complex to
  implement and debug
- Command pattern: each action knows how to undo itself — clean but requires
  discipline for every new action type

## Decision
Use full-state snapshots via history.js. Deep clone the entire data model
on each commit. Max 50 snapshots (circular buffer — oldest dropped).

## Consequences
- Simple to implement and reason about — no merge conflicts, no missed
  inverse operations
- Memory cost: 50 × full data model in RAM. Negligible at current scale
  (~64 slots, 5 mediators). Could grow with real data volume.
- Undo/redo is O(1) — just move a pointer
- No partial undo — every snapshot is a complete, consistent state
- If memory becomes an issue, migrate to diff-based or command pattern
