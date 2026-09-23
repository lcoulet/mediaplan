# ADR-0008: Setup and teardown times as offer attributes

## Status
Accepted (2026-09-17)

## Context
Offers require preparation time before and cleanup time after the
activity. These times affect mediator availability and overlap
detection. The times are the same for all mediators assigned to the
same offer.

## Decision
Add `setupTime` and `teardownTime` as attributes of the Mediation Offer
entity, in minutes. When a mediator is assigned to a slot, their
occupied time range is extended by setup time before the slot start
and teardown time after the slot end. Overlap detection uses this
extended range.

## Consequences
- Overlap detection must compute effective occupied range (start - setup,
  end + teardown) per mediator
- Setup/teardown are fixed per offer, not per mediator — simpler model
- If a mediator is assigned to consecutive slots with the same offer,
  teardown of the first may overlap setup of the second — this is
  acceptable (same room/equipment)
- UI must visually indicate setup/teardown time on the calendar
