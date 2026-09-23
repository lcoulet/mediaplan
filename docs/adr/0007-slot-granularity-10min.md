# ADR-0007: Slot time granularity of 10 minutes

## Status
Accepted (2026-09-17)

## Context
Slots need a time granularity that is flexible enough for the museum's
scheduling needs while remaining practical for calendar interaction.
Originally assumed 30-minute multiples.

## Decision
Use 10-minute increments for all slot times (start, end, setup, teardown).
Sub-10-minute precision is not needed.

## Consequences
- More flexible scheduling than 30-minute multiples
- Calendar grid can still snap to 10-minute intervals
- No additional complexity in the data model (times stored as ISO 8601)
- Overlap detection must account for 10-minute boundaries
