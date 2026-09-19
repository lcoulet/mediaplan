# ADR-0009: Competence status with learning mode

## Status
Accepted (2026-09-17)

## Context
Originally, mediator competence for an offer was binary: a mediator
either could or could not lead an offer. In practice, mediators in
training need to be assigned as supplemental mediators to learn offers,
and may exceptionally lead an offer if no confirmed mediator is
available.

## Decision
Replace the binary competence model with a status per mediator-offer
pair:
- `confirmed` — can lead the offer alone
- `learning` — in acquisition, can be assigned as supplemental, may
  exceptionally lead

The coordinator manages competence statuses. Assignment suggestions
filter by status. A learning mediator can be assigned as a second
mediator (training assignment) or, exceptionally, as the sole mediator.

## Consequences
- Mediator skills field changes from a list of offer IDs to a list of
  { offerId, status } pairs
- Assignment UI must show competence status and allow learning
  assignments with a visible indicator
- No hard block on assigning a learning mediator as sole mediator —
  the coordinator decides (exception process is manual, not enforced)
- The `skills` field in the data model needs migration from
  string[] to [{ offerId: string, status: "confirmed" | "learning" }]
