# Open Questions

This file tracks unresolved questions and established facts about the
MediaPlan project. Updated inline during grilling sessions.

---

## Data volume

**Established so far:**
- localStorage limit is ~5-10 MB per browser
- ADR-0002 documents the decision to use localStorage with migration path to IndexedDB

**Open questions:**
- [ ] How many mediators will be managed? (estimated: dozens)
- [ ] How many offers per year? (estimated: 200+)
- [ ] How many slots per year? (could approach localStorage limit)
- [ ] Should we proactively switch to IndexedDB before saturation, or wait?

## Excel import formats

**Established so far:**
- Two Excel sources: Secutix export + coordination tool
- The coordination tool has a VBA macro for import
- ADR pending until formats are analyzed

**Open questions:**
- [ ] What is the exact structure of the Secutix Excel export? (awaiting sample file)
- [ ] What is the exact structure of the coordination tool Excel? (awaiting sample file)
- [ ] What does the VBA macro do? Can it be replaced by TypeScript parsing?
- [ ] Are the two formats compatible or do they need separate parsers?

## Offer recurrence

**Established so far:**
- Slots are in multiples of 30 minutes
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
- Multiple mediators can be assigned to one slot (for training)
- Overlapping assignments are forbidden
- No mandatory breaks — managed manually
- Offers have setup/teardown times that extend the mediator's occupied range

**Open questions:**
- [x] Is there a maximum number of assignments per day per mediator? → No limit. Managed by the coordinator.
- [x] Can a mediator be assigned to an offer they don't have competence for? (exception process?) → No, unless in "learning" status. A learning mediator can be assigned as supplemental (to acquire the offer) or exceptionally lead it.
- [x] Are setup/teardown times the same for all mediators, or per-mediator per-offer? → Fixed per offer, same for all mediators.

## Deployment

**Established so far:**
- Domain: mediaplan.coulet.me
- Caddy configured with reverse proxy to localhost:8000
- Python http.server is a dev server, not production-grade

**Open questions:**
- [ ] Should Caddy serve static files directly (no Python) in production?
- [ ] Is a systemd service needed for the Python server, or do we migrate to static serving?
- [ ] Who are the end users? How many concurrent users expected?

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

**Open questions:**
- [ ] When should the migration to Vite+React+TS happen? Now, or after core features are stable?
- [ ] Should BDD (Cucumber.js) be added before or after the migration?
- [ ] Does the stakeholder (Loic's wife) need to validate the vanilla JS prototype first?
