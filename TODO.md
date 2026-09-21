# TODO — MediaPlan

## Mediator Annual Planning View (next)

- [ ] New view "Planning médiateurs": annual grid (year switchable)
  - Rows: days of the year (with standard ISO week numbers, e.g. "S38")
  - Columns: mediators, one cell per half-day (morning / afternoon)
  - Cells show presences (work cycle) and absences (type + half-day)
- [ ] Define work cycles in this view (e.g. S1, S2, S3... rotating weekly
  patterns) — editable grid, cycle assignment per mediator
- [ ] Reference: stakeholder's Excel example (to be provided) defines the
  target layout
- [ ] TDD: week numbering (ISO 8601), cycle rotation, half-day cell state
  computation (cycle + absence overlay)

## Competence Visibility (next)

- [ ] Offers view: add a column showing how many mediators know the offer,
  e.g. `5 (3✅ + 2📚)` (confirmed count + learning count)
- [ ] Offer modal: list the mediators in question (confirmed and learning,
  with their names/colors)
- [ ] Mediators view: show the count of mastered offers FIRST, then the
  offers in parentheses, then the count of learning offers (and those
  offers in parentheses), e.g. `3✅ (Visite, Atelier, Parcours) · 2📚 (Conférence, Spectacle)`

## Build System & Release

- [x] Set up a build system (Vite)
- [x] Generate a `dist/` folder with bundled assets for production
- [x] Add version number to `package.json`, injected into the app at build
  time and shown in the status bar
- [ ] Create a release script (tag + build + GitHub release via `gh`)
- [ ] GitHub Actions CI: run tests on push (vitest) and build preview
- [ ] GitHub Actions: deploy preview builds to the server (details kept private)

## Export Format (V1 sharing)

- [ ] Update exportJSON to produce `.json.gz` (compressed)
- [ ] Include last-modified timestamp in filename (e.g. `mediaplan_2026-09-17_1430.json.gz`)
- [ ] Include last-modified timestamp in file metadata
- [ ] Import: compare timestamps (filename + local data) to warn if importing older data

## Excel Import/Export

- [ ] Implement Excel export (.xlsx) using SheetJS
  - Export schedule (one tab per week or per entity)
  - Export mediator list and their assignments
- [ ] Implement Excel import using SheetJS
  - Configurable column mapping
  - Support Secutix export format
  - Support internal coordination files format
- [ ] Implement Secutix synchronization logic:
  - Skip rows with theme "G/ Droit d'accès" (entry fees — not mediation)
  - Deduplicate with the composite key (contract + offer + date + time +
    group name) — the dossier d'achat alone covers several slots
  - Booking times from the file take priority over the offer's default
    duration
  - Update modified reservations (headcount, time)
  - Deallocate cancelled reservations (not in Secutix file)
  - Preserve mediator assignments where possible
  - **Offer reconciliation UX**: when an imported THÈME matches no offer
    (by `offer.secutixLabel`), guide the user to fix it: offer to create
    the missing offer from the Secutix label, or to re-link to an
    existing offer — import cannot complete until every label is mapped
- [x] Obtain sample files (Secutix done — analyzed locally; coordination
  format still to be provided) to define column mappings

## Work Cycles

- [ ] Add WorkCycle and CycleWeek entities to models.ts (TDD)
- [ ] Add cycle rotation logic (S1 → S2 → S3 → S1)
- [ ] Add per-week override mechanism
- [ ] Add Cycle Override entity
- [ ] Create Cycles view: grid (mediator per row, weeks as columns)
- [ ] Integrate cycle availability into assignment suggestions
- [ ] Cycle management UI in mediator view/settings

## Assignment UX

- [ ] Allow learning mediator as supplemental assignment with visible indicator
- [ ] Allow learning mediator as sole assignment (exception, with warning)
- [ ] Slot resize by dragging block edges (daily view)

## Testing

- [ ] Set up CI to run tests on push (GitHub Actions)

## V2 — Server & Sync (future)

- [ ] Design server API for encrypted blob storage
- [ ] Implement client-side encryption (envelope encryption — proposed)
- [ ] Implement coordinator key pair generation (WebCrypto API)
- [ ] Implement versioning + conflict detection (metadata in clear)
- [ ] Implement conflict alert UI (timestamps + manual choice)
- [ ] V3: visual diff comparison for conflicts

## Features (Future)

- [ ] Schedule entity management (create/edit/delete schedules as distinct objects)
- [ ] Statistics and dashboards
- [ ] Read-only mediator view
- [ ] Authentication
