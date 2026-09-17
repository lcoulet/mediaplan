# ADR-0006: Planning locked by default

## Status
Accepted (2026-09-14)

## Context
Imported slots (from Secutix) represent confirmed reservations. Accidental
modifications could break the integrity of the imported data.

## Decision
The planning is locked by default. Unlocking requires a confirmation warning.
Locking is instant (no confirmation needed). Mediator assignment is always
allowed, even when locked — it opens a mediator-only modal in locked mode.

## Consequences
- Users cannot accidentally move or delete imported slots without explicitly
  unlocking first
- Mediator assignment (the most frequent action) remains frictionless
- Imported slots modified after unlock are marked `modifiedAfterImport: true`
  for traceability
- The lock state is per-schedule, not global
