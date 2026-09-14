# Business Specifications — MediaPlan

## Background

The Museum of Toulouse offers mediation programs (guided tours, workshops,
special events, etc.) that require scheduling the mediators who lead them.
MediaPlan is the tool used to manage these schedules.

## Entities

### Mediator

- `id`: unique identifier
- `lastName`: last name
- `firstName`: first name
- `email`: email address (optional)
- `phone`: phone number (optional)
- `skills`: list of mediation offers the mediator is qualified to lead
- `active`: boolean (active mediator or not)
- `notes`: free-form notes (optional)

### Mediation Offer

- `id`: unique identifier
- `name`: offer name (e.g. "Dinosauria guided tour")
- `description`: description (optional)
- `duration`: duration in minutes
- `capacity`: maximum number of participants
- `location`: intervention location (optional)

### Schedule (Planning)

- `id`: unique identifier
- `title`: schedule title (e.g. "September 2026 schedule")
- `startDate`: period start date
- `endDate`: period end date
- `status`: `draft` | `published` | `archived`

### Reservation (Slot)

- `id`: unique identifier
- `scheduleId`: reference to the schedule
- `offerId`: reference to the mediation offer
- `mediatorId`: reference to the assigned mediator
- `date`: slot date
- `startTime`: start time
- `endTime`: end time
- `participantCount`: number of participants (optional)
- `status`: `planned` | `confirmed` | `cancelled` | `completed`
- `notes`: free-form notes (optional)

### Mediator Unavailability (Absence)

- `id`: unique identifier
- `mediatorId`: reference to the mediator
- `startDate`: absence start date
- `endDate`: absence end date (inclusive)
- `halfDay`: `none` (full day) | `morning` | `afternoon` (applies to start and end dates for single-day absences; for multi-day, applies to start date only)
- `type`: `leave` (congés CP/RTT) | `mission` (déplacement professionnel) | `training` (formation) | `sick` (maladie) | `other`
- `notes`: free-form notes (optional)

## Features

### Mediator Management
- List, add, edit, delete a mediator
- Filter by skill / active status
- Search by name

### Mediation Offer Management
- List, add, edit, delete an offer
- Associate offers with mediators (skills)

### Mediator Unavailability Management
- List, add, edit, delete an absence for a mediator
- Absence types: leave (CP/RTT), mission, training, sick, other
- Granularity: full day or half-day (morning/afternoon)
- Detect conflicts: warn when assigning a mediator to a slot during an absence
- Calendar: colored banner on affected days
- Slot display: badge/icon next to mediator name when absent
- Dedicated view: list absences per mediator with filters

### Schedule Management
- Create a schedule for a given period
- Visualize the schedule as a calendar/grid
- Edit slots (drag & drop or selection)
- Assign a mediator to each slot
- Change schedule status

### Excel Import/Export
- Export the schedule in .xlsx format (one tab per entity or per week)
- Export the mediator list and their assignments
- Import data from existing files (Secutix, coordination files)
- Configurable import format (column mapping)

### Data Persistence
- All data in `localStorage`
- Full JSON export/import (backup/restore)

## User Interface

- **Default language: French** — the application UI is in French
- Responsive design (desktop-first, tablet-secondary)
- Main calendar view (week / month)
- Secondary views: mediator list, offer list
- Navigation bar / main menu
- Filters: by mediator, by offer, by date

## External Data Sources

- **Secutix**: the Museum's ticketing/reservation system — Excel file exported
  from Secutix, imported into MediaPlan to retrieve existing reservations.
- **Coordination files**: internal Excel files from the mediation team,
  imported to initialize schedules and mediators.

## Glossary

- **Mediator**: staff member leading mediation offers (tours, workshops, etc.)
- **Mediation offer**: activity offered by the Museum (guided tour, educational
  workshop, special event, etc.)
- **Schedule**: a set of slots over a given period
- **Slot / Reservation**: assignment of a mediator to an offer at a given date
  and time
