# TODO — MediaPlan

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
  - Deduplicate by contract number
  - Update modified reservations (headcount, time)
  - Deallocate cancelled reservations (not in Secutix file)
  - Preserve mediator assignments where possible
- [ ] Obtain sample files (Secutix + coordination) to define column mappings

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
