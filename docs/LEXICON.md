# Lexicon — MediaPlan Domain Vocabulary

This file defines the precise meaning of domain terms used across the
MediaPlan project. All agents, documentation, code, and discussions must
use these terms consistently. When a French term and English term are
listed, the English term is used in code, the French term in the UI.

## Entities

### Mediator (Médiateur)
A staff member who leads mediation activities at the museum.
Has: name, color (for calendar display), skills (list of offers they
can lead), active status (can be deactivated without deletion).

### Mediation Offer (Offre de médiation)
An activity proposed by the museum to visitors (guided tour, workshop,
show, etc.). Has: name, duration, capacity, location, **setup time**
(temps de mise en place), **teardown time** (temps de démontage). Can be:
- **Reserved** (réservée) — booked by a visitor group via Secutix import
- **Ad hoc** (ponctuelle) — entered manually, scheduled once without reservation

No recurring offers exist in the current scope. All offers are unique
instances.

### Setup Time (Temps de mise en place)
The time needed before an offer to prepare the activity (room, equipment).
Part of the offer definition. When a mediator is assigned to a slot, the
setup time extends the mediator's occupied time range before the offer
start. Used for overlap detection.

### Teardown Time (Temps de démontage)
The time needed after an offer to clean up and store equipment.
Part of the offer definition. When a mediator is assigned to a slot, the
teardown time extends the mediator's occupied time range after the offer
end. Used for overlap detection.

### Slot (Créneau)
An instance of an offer assigned to a date, time, and one or more
mediators. This is the atomic unit of the planning. Time granularity is
10-minute increments (e.g. 14:00, 14:10, 14:20). Sub-10-minute precision
is not needed. Tracks:
- `origin`: "manual" or "imported"
- `importSource`: e.g. "Secutix"
- `importedAt`: timestamp of import
- `modifiedAfterImport`: boolean, true if edited after import

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
