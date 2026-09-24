# ADR-0015: Whole-version conflict resolution with manual choice and bidirectional undo

## Status
Accepted (2026-09-24)

## Context
With concurrent editing via the OneDrive sync (ADR-0014), two clients can
diverge from the last common synced state: local changes exist AND remote
changes exist. Something must reconcile them.

The data volume is small (~20 mediators, few dozen slots/day, few
coordinators), so true same-entity collisions are rare — but they are
possible, and the team is not technical: a silent automatic merge could
lose work without anyone noticing.

Alternatives considered:
- **Last-write-wins (whole file)**: simplest; one user's work silently
  disappears — unacceptable for a planning tool
- **Automatic per-entity merge**: merge non-conflicting entities (slots
  vs mediators vs offers), last-write-wins on same-entity collisions —
  complex to implement and test, and silent on the collision cases that
  matter most
- **CRDT (per-slot merge)**: technically best, but heavy dependency and
  opaque to users
- **Operational transforms / event log replay**: requires modeling every
  mutation as an event with parentage (DAG); overkill for whole-file
  snapshots and complicates the existing undo/redo (ADR-0004)

## Decision
Conflict detection and resolution operate on WHOLE VERSIONS, resolved by
explicit user choice, undoable in both directions:

- Divergence is detected by comparing local and remote states against
  the last synced common state (base version). Both changed = conflict
- A conflict dialog presents both versions with their last-modified
  date/time and author: "Garder ma version" vs "Garder la version
  partagée"
- The user's choice applies the WHOLE version — no per-entity merge
- Both versions remain available (the losing one is kept in the app's
  history/undo stack and in the drive's `history/` files), so undo/redo
  (ADR-0004) can navigate back: choosing one version is NOT irreversible
- Dialog behavior:
  - Configurable no-response timeout (default 5 min); the timer does
    NOT reset when the remote changes again
  - Polling continues while the dialog is open — the dialog updates
    live if new remote versions arrive ("N nouvelles versions sur le
    drive"), reusing the same UX as reconnecting after offline edits
  - On timeout: sync pauses with a notification; the user is
    re-prompted only on manual re-enable. No silent automatic choice
  - If the connection drops while the dialog is open, the dialog closes
    cleanly and sync pauses

## Consequences
- Much simpler than merge: no diff engine, no entity-level conflict
  logic; testable as pure domain functions (base/local/remote triple)
- Work is never silently lost; the team always sees and chooses
- Non-conventional: users of sync tools expect merge; this must be
  explained in the user guide. Accepted because transparency beats
  cleverness for a small non-technical team
- A conflicting choice discards the other version's changes from the
  live planning (recoverable only via history/undo until the history
  horizon: 50 undo entries locally, 30 days of files on the drive)
- Same-entity rapid collaboration (two coordinators editing the same
  slot within the poll window) always ends in a dialog — acceptable at
  the team's working rhythm
