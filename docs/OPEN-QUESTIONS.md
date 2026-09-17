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
- Offers can be reserved (Secutix), fixed, or occasional

**Open questions:**
- [ ] Are there recurring offers (e.g. "every Tuesday at 14:00") or only unique slots?
- [ ] If recurring, how are exceptions handled (cancellation, time change)?

## Mediator constraints

**Established so far:**
- Mediators have competences (list of offers they can lead)
- Multiple mediators can be assigned to one slot (for training)
- Overlapping assignments are forbidden

**Open questions:**
- [ ] Are there mandatory breaks between assignments?
- [ ] Is there a maximum number of assignments per day per mediator?
- [ ] Can a mediator be assigned to an offer they don't have competence for? (exception process?)

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
- The app is for museum staff (mediators and/or coordination)
- No authentication in the current prototype

**Open questions:**
- [ ] Who exactly uses the app? Only the planning manager, or do mediators consult it too?
- [ ] If multiple users, do they need separate views or permissions?
- [ ] Is authentication needed in the first version, or only when backend is added?

## Stack migration

**Established so far:**
- ADR-0001: vanilla JS for prototype, migration to Vite+React+TS planned
- TDD with Node test runner works well for pure modules
- AGENTS.md, LEXICON.md, ADRs are in place for any agent to pick up

**Open questions:**
- [ ] When should the migration to Vite+React+TS happen? Now, or after core features are stable?
- [ ] Should BDD (Cucumber.js) be added before or after the migration?
- [ ] Does the stakeholder (Loic's wife) need to validate the vanilla JS prototype first?
