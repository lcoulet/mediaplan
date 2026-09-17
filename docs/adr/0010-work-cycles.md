# ADR-0010: Work cycles for mediator availability

## Status
Accepted (2026-09-17)

## Context
Mediators have recurring weekly schedules (work cycles) that define
their base availability — days and hours they work. This is distinct
from absences (which reduce availability on top of the cycle). Without
cycles, the coordinator would have to manually track each mediator's
working hours.

## Decision
Add a Work Cycle entity. Each mediator has one active cycle at a time.
A cycle consists of 1 to N named weeks (S1, S2, ...), each specifying
precise working days and hours. Cycles rotate in sequence but can be
manually overridden for specific weeks.

A new "Cycles view" provides a grid: one mediator per row, columns
showing week numbers and date ranges, allowing visualization and
editing of cycle assignments.

Cycle management (create, edit) is done in the mediator's own
view/settings.

## Consequences
- New entity: WorkCycle with sub-entities CycleWeek
- Availability = cycle base hours minus absences
- Assignment suggestions must check cycle availability, not just
  absence records
- Manual overrides per week add complexity to the data model
- New UI view needed (Cycles view) alongside Planning, Mediators,
  Offers, Absences
- Cycle rotation logic needed (S1 → S2 → S3 → S1)
- Open questions remain: week start day, override reversion behavior,
  shared vs per-mediator cycle definitions
