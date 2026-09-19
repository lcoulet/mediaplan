# Open Questions

This file tracks unresolved questions and established facts about the
MediaPlan project. Updated inline during grilling sessions.

---

## Data volume

**Established so far:**
- localStorage limit is ~5-10 MB per browser
- ADR-0002 documents the decision to use localStorage with migration path to IndexedDB
- No IndexedDB needed — no long-term history, no far-future planning
- Data volume stays small; localStorage is sufficient for the foreseeable scope
- ~20 mediators
- A few reserved offers per day (imported from Secutix)
- A few dozen offers in the catalog (standard offers)
- Annual slot count: a few per day × ~250 working days ≈ low hundreds to low thousands — well within localStorage limits

**Open questions:**
- [x] How many mediators will be managed? (estimated: dozens) → Not needed to resolve; localStorage sufficient regardless
- [x] How many offers per year? (estimated: 200+) → Not needed to resolve; localStorage sufficient
- [x] How many slots per year? (could approach localStorage limit) → Not needed to resolve; short planning window keeps volume low
- [x] Should we proactively switch to IndexedDB before saturation, or wait? → No. localStorage is sufficient.

## Excel import formats

**Established so far:**
- Two Excel sources: Secutix export + coordination tool
- The coordination tool has a VBA macro for import
- ADR pending until formats are analyzed
- Secutix import flow: coordinators import the Secutix Excel export into
  the planning tool, which stacks all reserved offers above the planning view
- Each import may contain reservations already imported previously → must
  deduplicate
- Reservations no longer in the Secutix file must be deallocated (cancelled)
- Reservations may have been modified (headcount, time changes) since last
  import → must update existing slots
- A contract number or order number identifies a reservation uniquely

**Open questions:**
- [ ] What is the exact structure of the Secutix Excel export? (awaiting sample file)
- [ ] What is the exact structure of the coordination tool Excel? (awaiting sample file)
- [ ] What does the VBA macro do? Can it be replaced by TypeScript parsing?
- [ ] Are the two formats compatible or do they need separate parsers?
- [ ] What is the exact field name for the contract/order number in the Secutix export?
- [ ] When a reservation is deallocated (no longer in Secutix), should the slot be deleted or kept with a "cancelled" status?
- [ ] When a reservation is modified (headcount, time), should the slot be updated and marked `modifiedAfterImport`?
- [ ] What happens to mediator assignments on a modified or deallocated slot?

## Offer recurrence

**Established so far:**
- Slots are in 10-minute increments (e.g. 14:00, 14:10, 14:20)
- Offers can be reserved (Secutix) or ad hoc (manual entry)
- No recurring offers exist — all offers are unique instances
- Offers have setup time and teardown time (part of the offer definition)
- Setup/teardown extend the mediator's occupied time range for overlap detection
- No mandatory breaks between assignments — managed manually by the mediator

**Open questions:**
- [x] Are there recurring offers (e.g. "every Tuesday at 14:00") or only unique slots? → No recurring offers. All ad hoc.
- [x] If recurring, how are exceptions handled? → N/A (no recurrence)

## Mediator constraints

**Established so far:**
- Mediators have competences (list of offers they can lead)
- Multiple mediators can be assigned to one slot (multi-mediator, not
  independent copies — same slot, multiple mediatorIds)
- Overlapping assignments are forbidden (with warning + confirmation)
- No mandatory breaks — managed manually
- Offers have setup/teardown times that extend the mediator's occupied range
- No max assignments per day — managed by coordinator

**Open questions:**
- [x] Is there a maximum number of assignments per day per mediator? → No limit. Managed by the coordinator.
- [x] Can a mediator be assigned to an offer they don't have competence for? (exception process?) → No, unless in "learning" status. A learning mediator can be assigned as supplemental (to acquire the offer) or exceptionally lead it.
- [x] Are setup/teardown times the same for all mediators, or per-mediator per-offer? → Fixed per offer, same for all mediators.

## Deployment

**Established so far:**
- Domain: mediaplan.coulet.me
- Caddy configured with reverse proxy to localhost:8000
- Python http.server is a dev server, not production-grade
- App cannot be deployed on the museum's internal IT system (SI)
- Must be hosted externally (Loic's VPS)
- Server must not see data in clear text — client-side encryption
- Mediator names should not be stored server-side, only IDs (RGPD)
- Multiple coordinators on different workstations, intermittent connections
- V1: manual sharing via export/import of database file on a shared filesystem
  - Export file format: JSON compressed (.json.gz)
  - File name includes date/time of last modification (e.g. mediaplan_2026-09-17_1430.json.gz)
  - No server-side sync in V1
- V2: server with client-side encryption + versioning + conflict resolution
  - Server stores encrypted blobs only
  - Conflict resolution: versioning + conflict alert with timestamps, manual choice
  - V3: visual diff comparison
- V2 encryption: envelope encryption (content key + per-coordinator public key)
  - V2 identification: per-coordinator key pair, signatures for attribution
  - Replaces V1 shared secret approach

**Open questions:**
- [x] Should Caddy serve static files directly (no Python) in production? → Yes. Caddy serves static files directly (root directive). No Python http.server in production. ADR-0005 updated.
- [x] Is a systemd service needed for the Python server, or do we migrate to static serving? → No systemd service needed. Caddy's own systemd service handles restarts.
- [ ] Who are the end users? How many concurrent users expected?
- [ ] V1: what shared filesystem? (USB key, network share, cloud drive?)
- [ ] V1: how does the coordinator know if the imported file is older or newer than their local data? (check timestamps in filename vs localStorage?)
- [ ] V2: what encryption scheme details? (AES-GCM for content, RSA-OAEP for envelope?)
- [ ] V2: how is the coordinator's key pair generated and stored? (browser WebCrypto API, local keystore?)
- [ ] V2: what granularity for versioning? (Entire data model per push, or per-entity?)
- [ ] V2: how does the server know which entity to compare versions for if data is encrypted? (Metadata in clear: entity ID + version + timestamp)

## User access

**Established so far:**
- The app is used by coordinators (coordinateurs/coordinatrices)
- Coordinators share the planning at the daily briefing with mediators
- Sharing is done via Excel export or paper printout
- No authentication in V1
- Mediators may get a read-only view in a future version, not V1

**Open questions:**
- [x] Who exactly uses the app? Only the planning manager, or do mediators consult it too? → Coordinators only in V1. Mediators see exported planning.
- [x] If multiple users, do they need separate views or permissions? → Not in V1. Future: read-only mediator view.
- [x] Is authentication needed in the first version, or only when backend is added? → Not in V1. Only when backend is added.

## Stack migration

**Established so far:**
- ADR-0001: vanilla JS for prototype, migration to Vite+React+TS planned
- TDD with Node test runner works well for pure modules
- AGENTS.md, LEXICON.md, ADRs are in place for any agent to pick up
- ADR-0013: migration to Vite + React + TypeScript decided
- Tests migrated from node --test to vitest
- State management: Context API + useReducer (no external store)
- CSS kept as-is (style.css + calendar.css, no CSS Modules/Tailwind)
- Same features and UI as vanilla JS — stack change only
- Build runs locally on VPS → /home/loic/mediaplan/dist/
- Caddy serves dist/ as static files
- Preview builds: feat/* branches → /home/loic/mediaplan/preview/
- GitHub Actions CI: added to TODO (not blocking)

**Open questions:**
- [x] When should the migration to Vite+React+TS happen? Now, or after core features are stable? → Now. Before complex features (day planning view, work cycles, Excel import).
- [x] Should BDD (Cucumber.js) be added before or after the migration? → Resolved by ADR-0013. Vitest replaces node --test. BDD still a separate question.
- [ ] Does the stakeholder (Loic's wife) need to validate the vanilla JS prototype first? → No — migration proceeds now, Loic will validate the React version.

## Work cycles

**Established so far:**
- Mediators have work cycles defining their base availability (days + hours)
- Cycles are named weeks (e.g. S1, S2, S3) with precise working hours per day
- One active cycle per mediator at a time
- Cycle length is variable (1 to N weeks) per mediator
- Cycles rotate in sequence but can be manually overridden per week
- Cycle management (create, edit) is done in the mediator's own view/settings
- Cycle defines base availability; absences reduce availability on top
- New view needed: "Cycles view" — grid with one mediator per row, columns
  showing week numbers and date ranges, allowing visualization and editing
  of cycle assignments

**Open questions:**
- [ ] What day does a cycle week start on? (Monday? Sunday?)
- [ ] When a cycle is overridden for a specific week, does it revert to the rotation afterward or stay manual?
- [ ] Are cycle definitions (S1, S2, etc.) shared across mediators or unique per mediator?

## Day planning view

**Established so far:**
- View focused on a single day: mediators as rows, time as columns
- Time grid: thin lines every 10 minutes, thick lines every hour
- Background shows mediator availability (work cycle) + unavailability (absences)
- Two non-mediator lanes:
  - Unassigned lane: imported offers not yet allocated to a mediator
  - Standard offers lane: catalog of offers, draggable onto mediator+time
    to create a manual slot. Offer stays in lane for reuse.
- Drag-and-drop: assign offers, resize slots (drag edge), move slots
  (drag body, same day only)
- Slot duplication: adds mediator to same slot (multi-mediator, not copy)
- Overlap on same mediator: red hatching/highlight + warning confirmation
- Navigation: day tabs with prev/next/today
- Toggle: day / week / month views
- Slot model migrating from `mediatorId` to `mediatorIds` (array)

**Open questions:**
- [x] In the unassigned lane, are all imported-but-unassigned slots shown, or only those for the selected day? → Only those for the selected day, positioned on their time slot.
- [x] Should the standard offers lane show all 70 offers, or only those the selected mediator has competence for? → All offers (filters added later). No time positioning — these are not reservations.
- [x] When dragging a standard offer to create a manual slot, what duration does it get? (default offer duration? user-specified?) → Default offer duration.
- [x] How is the cycle week label (S1, S2) displayed next to the mediator name? (badge? column?) → Pill/badge to the right of the name.
- [x] Should the day view show setup/teardown time visually within the slot block, or just the offer time? → Yes, with a visual separator (dashed line or similar) between setup / offer / teardown zones within the slot block.
