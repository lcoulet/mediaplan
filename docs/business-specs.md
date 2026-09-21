# Business Specifications — MediaPlan

## Background

The Museum of Toulouse offers mediation programs (guided tours, workshops,
special events, etc.) that require scheduling the mediators who lead them.
MediaPlan is the tool used to manage these schedules. It is used by
coordinators who build and maintain the planning, assign mediators to
offers, and share the result at the daily briefing with mediators (via
Excel export or paper printout).

## Entities

### Mediator

- `id`: unique identifier
- `lastName`: last name
- `firstName`: first name
- `email`: email address (optional)
- `phone`: phone number (optional)
- `competences`: list of { offerId, status } pairs where status is
  `confirmed` (can lead alone) or `learning` (in acquisition, can be
  assigned as supplemental or exceptionally lead)
- `active`: boolean (active mediator or not)
- `notes`: free-form notes (optional)
- `workCycleId`: reference to the active work cycle (optional)

### Work Cycle

- `id`: unique identifier
- `mediatorId`: reference to the mediator
- `name`: cycle name (e.g. "S1", "S2", "S3")
- `weeks`: list of cycle weeks (1 to N)
- `active`: boolean — one active cycle per mediator at a time

### Cycle Week

- `id`: unique identifier
- `cycleId`: reference to the work cycle
- `weekNumber`: position in the cycle (1, 2, 3, ...)
- `label`: display name (e.g. "S1", "S2")
- `days`: list of { dayOfWeek, startTime, endTime } for each working day
  (dayOfWeek: 1=Monday .. 7=Sunday)

### Cycle Override

- `id`: unique identifier
- `mediatorId`: reference to the mediator
- `weekStartDate`: ISO date of the Monday of the overridden week
- `cycleWeekId`: reference to the cycle week used instead of the rotated one
- `notes`: reason for override (optional)

### Mediation Offer

- `id`: unique identifier
- `name`: offer name (e.g. "Dinosauria guided tour")
- `description`: description (optional)
- `duration`: duration in minutes
- `capacity`: maximum number of participants
- `location`: intervention location (optional)
- `setupTime`: preparation time in minutes before the offer (fixed, same
  for all mediators)
- `teardownTime`: cleanup time in minutes after the offer (fixed, same
  for all mediators)
- `welcomeType`: `Accueil Libre` | `Réservable encadrée par médiateur` |
  `Animation par médiateur` — how the offer is staffed. An
  `Accueil Libre` offer needs NO mediator: its slots display as OK
  (green) even when unassigned. Defaults to
  `Réservable encadrée par médiateur`. Legacy persisted data is migrated
  with the default on load.

### Schedule (Planning)

- `id`: unique identifier
- `title`: schedule title (e.g. "September 2026 schedule")
- `startDate`: period start date
- `endDate`: period end date
- `status`: `draft` | `published` | `archived`
- `locked`: boolean — when true, slots cannot be added, edited, or deleted
  without unlocking first (locked by default)

### Slot (Reservation)

- `id`: unique identifier
- `scheduleId`: reference to the schedule
- `offerId`: reference to the mediation offer
- `mediatorIds`: array of assigned mediator IDs (multiple for training or
  parallel assignment). Replaces the singular `mediatorId` field.
- `date`: slot date (ISO 8601, e.g. `2026-09-15`)
- `startTime`: start time (10-minute increments, e.g. `09:00`, `09:10`)
- `endTime`: end time (10-minute increments)
- `setupTime`: setup duration in minutes (optional). Defaults to the offer's
  `setupTime` at creation; editable per slot regardless of lock state.
  `0` is a real override; undefined (legacy) falls back to the offer.
- `teardownTime`: teardown duration in minutes (optional). Same rules as
  `setupTime`.
- `participantCount`: number of participants (optional)
- `status`: `planned` | `confirmed` | `cancelled` | `completed`
- `notes`: free-form notes (optional)
- `origin`: `manual` | `imported`
- `importSource`: source label (e.g. `"Secutix"`, `"Coordination"`)
- `importedAt`: import timestamp (ISO 8601) — empty for manual slots
- `modifiedAfterImport`: boolean — true if edited after import
- `contractNumber`: unique identifier from Secutix for deduplication
  (reserved slots only)

The stored `startTime`/`endTime` are always the REAL booking period (the
public-facing time). Setup extends the planning block BEFORE the booking,
teardown AFTER it — this geometry is derived at display time
(`getSlotTotalRange()`), never stored on the booking hours.

### Mediator Unavailability (Absence)

- `id`: unique identifier
- `mediatorId`: reference to the mediator
- `startDate`: absence start date
- `endDate`: absence end date (inclusive)
- `halfDay`: `none` (full day) | `morning` | `afternoon`
- `type`: `leave` | `mission` | `training` | `sick` | `other` | `leave_request`
- `notes`: free-form notes (optional)
- `startTime`/`endTime`: display-only time range derived from `halfDay` and
  the configurable half-day boundaries (`halfDayConfig` in AppData:
  `morningEnd`, default `13:00`; `afternoonStart`, default `13:00`)

## Features

### Mediator Management
- List, add, edit, delete a mediator
- Manage competences: assign offers with status (confirmed/learning)
- Filter by competence / active status
- Search by name
- Manage work cycle (create, edit, activate)

### Work Cycle Management
- Create a cycle with 1 to N named weeks
- Define working days and hours per week (10-minute granularity)
- One active cycle per mediator at a time
- Cycles rotate in sequence (S1 → S2 → S3 → S1)
- Override specific weeks manually
- Cycles view: grid with one mediator per row, columns showing week
  numbers and date ranges

### Mediation Offer Management
- List, add, edit, delete an offer
- Define setup time and teardown time per offer
- Set the welcome type (Accueil Libre / Réservable encadrée par
  médiateur / Animation par médiateur)
- Associate offers with mediators (competences)

### Mediator Unavailability Management
- List, add, edit, delete an absence for a mediator
- Absence types: leave, mission, training, sick, other
- Granularity: full day or half-day (morning/afternoon)
- Detect conflicts: warn when assigning a mediator during an absence
- Calendar: colored banner on affected days
- Dedicated view: list absences per mediator with filters

### Schedule Management
- Create a schedule for a given period
- Visualize the schedule as a calendar/grid
- Edit slots (drag & drop or selection)
- Assign one or more mediators to each slot (filtered by competence)
- Lock/unlock schedule editing (locked by default, warning on unlock)
- Visual distinction between imported and manual slots:
  - Imported slots: badge showing source, read-only feel
  - Manual slots: distinct visual style
  - Modified imported slots: badge showing "imported (modified)"
- Setup/teardown time displayed on calendar for assigned mediators
- Overlap detection uses extended time range (start - setup, end + teardown)

### Day Planning View (Plan Jour)
- Layout: time as horizontal columns (8h-19h), rows organized as:
  - **Unassigned lane** (top): imported offers not yet allocated to a mediator,
    shown only for the selected day, positioned on their time slot
  - **Mediator rows**: active mediators with their color badge, each row
    displays assigned slots for that mediator
    - **Competence highlighting**: When a slot is selected (click) or dragged,
      mediator rows are highlighted by competence for the slot's offer:
      - Blue: confirmed competence
      - Yellow: learning competence
      - Hatched: no competence
  - **Standard offers lane** (bottom): catalog of all standard offers, draggable
    onto a mediator row + time position to create a manual slot
- Time grid: thin lines every 10 minutes, thick lines every hour
- Background: mediator availability (work cycle) + unavailability (absences)
- Drag-and-drop offers from unassigned lane to a mediator row to assign
- Drag standard offer onto mediator row + time to create manual slot
- Drag slot body to move within same day (no day change)
- Duplicate slot onto other mediators — adds mediator to same slot
  (multi-mediator assignment, not independent copy)
- Slot overlap on same mediator: red hatching and/or red highlight,
  warning confirmation required
- Navigation: prev/next/today buttons to change the selected day
- Toggle between day / week views
- Slot assignment: can assign mediators from the slot modal (multi-select)
- Mediator selector sorted by competence (confirmed → learning → none),
  then alphabetical within each group
- Mediator colors: displayed as colored badges/pills next to mediator names
- Overlap detection uses extended time range (start - setup, end + teardown)
- **Lock toggle** ("Mode modification"): same switch as Weekly View
  - Locked (default): imported slots open in mediator-only mode (assign only);
    standard offers remain draggable to create manual slots; manual slots
    remain fully editable
  - Unlocked: all slots (imported and manual) fully editable (offer, date,
    time, deletion); imported slots marked "modified after import" on save
  - Slots (imported or manual) are always draggable for mediator assignment
    regardless of lock state

### Secutix Import (Synchronization)
- Import Secutix Excel export to create/update reserved slots
- Deduplicate using contract number — skip slots already imported
- Update existing slots when reservation modified (headcount, time)
- Deallocate slots no longer in the Secutix file (cancelled reservations)
- Preserve mediator assignments on modified slots when possible

### Excel Import/Export
- Export the schedule in .xlsx format (one tab per entity or per week)
- Export the mediator list and their assignments
- Import data from Secutix and coordination files
- Configurable import format (column mapping)

### Data Persistence
- All data in `localStorage`
- Full JSON export/import (backup/restore)
- V1: export as `.json.gz` with timestamp in filename
  (e.g. `mediaplan_2026-09-17_1430.json.gz`)
- V1: manual sharing via shared filesystem
- V2: server with client-side encryption and versioning

## User Interface

- **Default language: French**
- Responsive design (desktop-first, tablet-secondary)
- Main calendar view (week / month)
- Secondary views: mediators, offers, absences, cycles
- Navigation bar / main menu
- Filters: by mediator, by offer, by date

## User Access

- V1: coordinators only (no authentication)
- V1: mediators see the planning via export (Excel/paper)
- Future: read-only mediator view
- Future: authentication when backend is added

## External Data Sources

- **Secutix**: the Museum's ticketing/reservation system — Excel file
  exported from Secutix, imported into MediaPlan to synchronize reserved
  slots. Import is a synchronization, not a simple append: deduplicate by
  contract number, update modified reservations, deallocate cancelled ones.
- **Coordination files**: internal Excel files from the mediation team,
  may include VBA macros. Format to be analyzed from sample files.

## Deployment

- Hosted on external VPS (not on museum SI)
- Domain: mediaplan.coulet.me
- Caddy with HTTPS (Let's Encrypt)
- V1: static files served by Caddy (or dev server)
- V2: server component for encrypted blob storage and sync

## Glossary

See `docs/LEXICON.md` for the authoritative domain vocabulary.
