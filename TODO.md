# TODO — MediaPlan

## OneDrive Sync (current — phase 1: coordinator collaboration)

Specs done (ADR-0014/0015, 86 Gherkin scenarios in test/features/sync/,
mockups in docs/mockups/sync/ reviewed GO-WITH-FIXES and fixed).

- [ ] Implementation slice 1 — sync domain foundations (TDD, pure logic):
  - [ ] Types: SyncConfig, SyncState, version metadata (base/local/remote)
  - [ ] Config store (localStorage) with bounds validation:
        poll 10 s–15 min (default 30 s), conflict timeout 30 s–60 min
        (default 20 min), retention 1–365 days (default 30)
  - [ ] Conflict detection: divergence = local AND remote both changed
        since last synced base (whole-version comparison, no merge)
  - [ ] History filename: ISO 8601 UTC, `:` → `-`
        (e.g. `2026-09-24T14-30-05Z_loic.json`)
- [ ] Implementation slice 2 — auth + transport (infrastructure):
  - [ ] PKCE OAuth module (authorize, code exchange, silent refresh
        60 s before expiry, 2 consecutive 401 → sync disabled)
  - [ ] Share-link resolution via Graph `shares` API (driveId/itemId)
  - [ ] Diagnostics: sync journal, token status, raw Graph errors
- [ ] Implementation slice 3 — push/pull engine:
  - [ ] Debounced push (5 s) + "Sauvegarder maintenant" (disabled while
        conflict dialog open)
  - [ ] Poll with ETag/If-None-Match at configured frequency
  - [ ] History file per effective push + 30-day purge on each push
  - [ ] Offline: pause + backoff resume; local editing never blocked
- [ ] Implementation slice 4 — UI:
  - [ ] Configuration view (ex-Import/Export): Secutix, OneDrive sync
        section (all fields), Données (JSON.gz + delete), demi-journées
  - [ ] Header restructure: 7 view buttons, gear = Configuration,
        Secutix import icon, help (?) last, sync pill bar below header
  - [ ] Conflict dialog (both versions + authors/dates, live
        "N nouvelles versions" banner, non-resetting 20-min countdown,
        ✕ = explicit pause-without-choosing)
  - [ ] History Panel: "Historique partagé" group (on-demand load,
        50 cap, restore = undoable + push)
- [ ] De-risk remaining: museum M365 tenant checklist (app registration,
      admin consent) — with the coordinator
- [ ] De-risk optional: shared-folder link resolution test (extend
      public/sync-test.html with a 6th test resolving an edit share link)

## Mediator Annual Planning View

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

- [x] Update exportJSON to produce `.json.gz` (compressed)
- [x] Include last-modified timestamp in filename (e.g. `mediaplan_2026-09-17_1430.json.gz`)
- [x] Import: compare timestamps (filename + local data) to warn if importing older data

## Excel Import/Export

- [ ] Implement Excel export (.xlsx) using SheetJS
  - Export schedule (one tab per week or per entity)
  - Export mediator list and their assignments
- [x] Implement Secutix import using SheetJS (`src/infrastructure/secutix-reader.ts`
  + `src/domain/secutix-import.ts` + Secutix panel in the Import/Export view)
- [ ] Implement Excel import for coordination files (configurable column mapping)
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

## User Documentation (user-docs skill)

- [ ] Generate the user guide with screenshots (headless browser captures)
- [ ] Wire the in-app help (?) to the generated guide

## Testing

- [ ] Set up CI to run tests on push (GitHub Actions)

## V2 — Server & Sync (future — superseded by OneDrive sync for V1.x)

- [ ] Design server API for encrypted blob storage
- [ ] Implement client-side encryption (envelope encryption — proposed)
- [ ] Implement coordinator key pair generation (WebCrypto API)
- [ ] Implement versioning + conflict detection (metadata in clear)
- [ ] V3: visual diff comparison for conflicts

## Features (Future)

- [ ] Schedule entity management (create/edit/delete schedules as distinct objects)
- [x] Statistics and dashboards
- [ ] Read-only mediator view (phase 2 of OneDrive sync: separate published
      folder with filtered content — no other people's absences)
- [ ] Authentication
