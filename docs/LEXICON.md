# Lexicon — MediaPlan Domain Vocabulary

This file defines the precise meaning of domain terms used across the
MediaPlan project. All agents, documentation, code, and discussions must
use these terms consistently. When a French term and English term are
listed, the English term is used in code, the French term in the UI.

## Entities

### Mediator (Médiateur)
A staff member who leads mediation activities at the museum.
Has: name, color (for calendar display), **competences** (list of offers they
can lead with a status: confirmed or learning), active status (can be deactivated without deletion).

### Mediation Offer (Offre de médiation)
An activity proposed by the museum to visitors (guided tour, workshop,
show, etc.). Has: name, duration, capacity, location, **setup time**
(temps de mise en place), **teardown time** (temps de démontage), **welcomeType** (type d’accueil). Can be:
- **Reserved** (réservée) — booked by a visitor group via Secutix import
- **Ad hoc** (ponctuelle) — entered manually, scheduled once without reservation

No recurring offers exist in the current scope. All offers are unique
instances.

### Welcome Type (Type d’Accueil)
Categorizes how an offer is managed in the planning. Values:
- **Accueil Libre** : offer reservable without requiring a mediator assignment
  (e.g., free-entry visits). Its slots display as **OK** (green) even when
  unassigned — no mediator is needed, so no "to assign" state applies.
- **Réservable encadrée par médiateur** : offer requiring a mediator assignment (e.g., guided tour).
- **Animation par médiateur** : offer always requiring a mediator (e.g., educational workshop).

### Setup Time (Temps de mise en place)
The time needed before an offer to prepare the activity (room, equipment).
Defined on the offer (default value) and OVERRIDABLE PER SLOT: a slot created
from an offer copies the offer's setup time, and coordinators can adjust it
per reservation without touching the booking hours or unlocking the planning.
The setup time extends the mediator's occupied block BEFORE the booking start.
Used for overlap detection and planning display.

### Teardown Time (Temps de démontage)
The time needed after an offer to clean up and store equipment.
Same per-slot override rules as setup time. Extends the mediator's occupied
block AFTER the booking end.

### Booking (Réservation)
The PUBLIC-FACING time of a slot: the period during which visitors benefit
from the offer. Stored as `slot.startTime`/`slot.endTime`, ALWAYS distinct
from setup/teardown — the offer's `duration` is the booking duration,
logistics extend around it and are never included in it. When dragging an
offer onto the planning, the cursor aims at the booking start (snapped to the
10-minute grid); the setup block extends before the cursor and the teardown
block after the booking.

### Total Block (Bloc total)
The full planning footprint of a slot: setup + booking + teardown. Derived
at display time by `getSlotTotalRange()` (slot values override offer
values), never stored. Rendered as one block with red delimiters marking
the booking start/end inside it.

### Planning Status (État du planning)
The single most important piece of information on a slot, displayed on the
weekly view. Mutually exclusive states computed by
`getSlotPlanningStatus()` in priority order:
- **Unassigned** (❌, hatched red): no mediator on the slot
- **Dispo issue** (🚫, red): no assigned mediator is available (absence
  or overlap) — availability is evaluated BEFORE competence
- **Incompetent** (⚠️, amber): available mediators hold no competence for
  the offer
- **Learning** (📚, pale yellow): no confirmed mediator, but a learning one
- **OK** (✔️, green): at least one mediator available AND confirmed

The weekly view shows a per-status count badge (toolbar), a legend below
the grid, and slot details in a native tooltip.

### Slot (Créneau)
An instance of an offer assigned to a date, time, and one or more
mediators. This is the atomic unit of the planning. Time granularity is
10-minute increments (e.g. 14:00, 14:10, 14:20). Sub-10-minute precision
is not needed. Tracks:
- `mediatorIds`: array of assigned mediator IDs (multiple for training
  or parallel assignment). Replaces the singular `mediatorId` field.
- `origin`: "manual" or "imported"
- `importSource`: e.g. "Secutix"
- `importedAt`: timestamp of import
- `modifiedAfterImport`: boolean, true if edited after import
- `contractNumber`: unique identifier from Secutix (reserved slots only)

### Absence
A mediator's unavailability. Has: type (leave, mission, training, sick,
other), date range, and period (full-day, morning, afternoon).
Absences are non-interactive on the calendar (display only).

### Work Cycle (Cycle de travail)
A mediator's recurring weekly schedule pattern. A mediator has one
active cycle at a time. A cycle consists of 1 to N named weeks
(e.g. S1, S2, S3), each specifying precise working days and hours
(e.g. S1 = Monday 9:00-18:00, Tuesday 9:00-18:00, Wednesday off).
Cycles rotate in sequence (S1 → S2 → S3 → S1 → ...) but can be
manually overridden for specific weeks to accommodate planning changes.

Cycle management (creation, editing) is done in the mediator's own
settings/view. A cycle week defines the mediator's base availability.
Absences further reduce availability on top of the cycle.

### Schedule (Planning)
A planning period containing all slots and absences. Has a `locked`
boolean — locked by default, unlocking requires confirmation.

### Reservation
A booking made by a visitor group for a specific offer, imported from
Secutix via Excel. One reservation = one imported slot.

## Roles

### Visitor Group (Groupe visiteur)
A school, association, or public group that reserves an offer. Not
managed directly in MediaPlan — their data comes via Secutix import.

### Coordination Service (Service coordination)
The museum team that manages the Excel tool for planning. Their file
format may differ from Secutix and may include VBA macros.

### Coordinator (Coordinateur/Coordonnatrice)
The primary user of MediaPlan. Builds and maintains the planning,
assigns mediators to offers, manages absences. Shares the planning at
the daily briefing with mediators via Excel export or paper printout.

## External Systems

### Secutix
The museum's reservation/ticketing system. Exports planning data as
Excel files that MediaPlan imports to create reserved slots.

## Concepts

### Overlap (Chevauchement)
Two slots assigned to the same mediator with overlapping time ranges.
Forbidden by business rule (`hasMediatorOverlap()`).

### Lock (Verrouillage)
Planning state preventing modifications to slots. Mediator assignment
remains allowed in locked mode (mediator-only modal). Locking is
instant, unlocking requires a confirmation warning.

### Day Planning View (Vue planning du jour)
A calendar view focused on a single day. Layout:
- Rows: two non-mediator lanes at the top, then mediators:
  - **Unassigned lane** (top): imported offers not yet allocated to a mediator,
    shown only for the selected day, positioned on their time slot
  - **Mediator rows**: active mediators (with cycle week label as a pill/badge
    to the right of their name, e.g. "S1", "S2")
    **Competence highlighting**: When a slot is selected (click or drag),
    mediators are highlighted by competence for the slot's offer:
    - Blue background: confirmed competence
    - Yellow background: learning competence
    - Hatched background: no competence
  - **Standard offers lane** (bottom): catalog of all standard offers (no time
    positioning — these are not reservations). Draggable onto a mediator
    row + time position to create a manual slot (virtual reservation)
    using the offer's default duration. The offer stays in the lane for
    reuse. Filters will be added later.
- Columns: time axis with thin lines every 10 minutes, thick lines every
  hour
- Display: mediator availability/unavailability (from work cycle + absences)
  as background, assigned offers as blocks
- Slot block: visually divided into setup / offer / teardown zones with
  dashed separators, reflecting the offer's setupTime and teardownTime
- Slot overlap on the same mediator row: overlapping slots shown on top
  of each other with red hatching and/or red highlight to indicate conflict
- Interactions:
  - Drag-and-drop offers from unassigned lane to a mediator row to assign
  - Drag standard offer onto a mediator row + time position to create a
    manual slot (origin: manual, duration: offer default)
  - Drag a slot body to move it within the same day (no day change)
  - Duplicate a slot onto one or more other mediators — adds mediator to
    the same slot (multi-mediator assignment), not an independent copy
  - Slots (imported or manual) are always draggable for mediator assignment
- Conflict on overlap: warning shown, user must confirm to proceed.
  Conflict is visually highlighted (red hatching and/or red overlay).
- Navigation: day tabs with prev/next/today buttons
- **Lock toggle** ("Mode modification"): same switch as Weekly View
  - Locked (default): imported slots open in mediator-only mode (assign only);
    manual slots remain fully editable; standard offers remain draggable
    to create manual slots
  - Unlocked: all slots (imported and manual) fully editable (offer, date,
    time, deletion); imported slots marked "modified after import" on save
- Mediator selector in slot modal: sorted by competence (confirmed → learning
  → none), then alphabetical within each group

### Competence (Compétence)
The set of offers a mediator is qualified to lead. Each mediator-offer
pair has a status:
- **Confirmed** (confirmé) — can lead the offer alone
- **Learning** (en acquisition/formation) — cannot lead alone, but can
  be assigned as a supplemental mediator to learn the offer. May
  exceptionally lead the offer if no confirmed mediator is available.

Used to filter assignment suggestions. The coordinator manages
competence statuses.

### Training Assignment (Affectation de formation)
Assigning multiple mediators to a single slot beyond the required
number, for training purposes. Allowed by the system.

## Naming Conventions

- The project name is **MediaPlan** (not Mediaplan, not Mediplan)
- Dates in the data model are ISO 8601 (e.g. `2026-09-15`)
- Human-friendly dates use French format (e.g. "14 sept. 2026 à 19:30")
- Data versioning: localStorage key `mediaplan_data_v1` (suffix increments
  on schema changes)
