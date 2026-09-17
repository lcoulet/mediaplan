# TODO — MediaPlan

## Build System & Release

- [ ] Set up a build system (esbuild or Rollup) to bundle the app
- [ ] Download SheetJS (xlsx) as a build dependency (not committed to git)
- [ ] Generate a `dist/` folder with bundled assets for production
- [ ] Add app versioning (semantic version, displayed in UI footer)
- [ ] Create a release script (tag + build + GitHub release via `gh`)
- [ ] Add version number to `package.json` and inject into the app at build time

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

- [ ] Add WorkCycle and CycleWeek entities to models.js (TDD)
- [ ] Add cycle rotation logic (S1 → S2 → S3 → S1)
- [ ] Add per-week override mechanism
- [ ] Add Cycle Override entity
- [ ] Create Cycles view: grid (mediator per row, weeks as columns)
- [ ] Integrate cycle availability into assignment suggestions
- [ ] Cycle management UI in mediator view/settings

## Competence Status

- [ ] Migrate mediator skills from string[] to [{ offerId, status }] (TDD)
- [ ] Update assignment UI to show competence status (confirmed/learning)
- [ ] Allow learning mediator as supplemental assignment with visible indicator
- [ ] Allow learning mediator as sole assignment (exception, with warning)

## Setup/Teardown Time

- [ ] Add setupTime and teardownTime to offer entity (TDD)
- [ ] Update overlap detection to use extended range (start - setup, end + teardown)
- [ ] Display setup/teardown on calendar for assigned mediators

## Testing

- [ ] Extract logic from `app.js` into testable modules (calendar logic, CRUD, filters)
- [ ] Write tests for extracted modules (TDD)
- [ ] Add DOM/UI tests (jsdom or similar)
- [ ] Set up CI to run tests on push (GitHub Actions)

## Deployment

- [ ] Configure Caddy to serve static files directly (no Python dev server)
- [ ] Or: add systemd service for the Python server
- [ ] Open ports 80/443 on firewall if needed

## V2 — Server & Sync (future)

- [ ] Design server API for encrypted blob storage
- [ ] Implement client-side encryption (envelope encryption — proposed)
- [ ] Implement coordinator key pair generation (WebCrypto API)
- [ ] Implement versioning + conflict detection (metadata in clear)
- [ ] Implement conflict alert UI (timestamps + manual choice)
- [ ] V3: visual diff comparison for conflicts

## Features (Future)

- [ ] Calendar views: day / week / month toggle in the planning view
  - Day view: mediators as rows, time as columns, 10min grid lines
  - Unassigned zone for offers awaiting assignment
  - Drag-and-drop assignment, slot resize, slot duplication
  - Day navigation tabs (prev/next/today)
- [ ] Drag & drop on calendar to move slots
- [ ] Schedule entity management (create/edit/delete schedules as distinct objects)
- [ ] Statistics and dashboards
- [ ] Read-only mediator view
- [ ] Authentication
