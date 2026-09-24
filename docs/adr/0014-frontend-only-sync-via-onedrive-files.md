# ADR-0014: Frontend-only collaborative sync via OneDrive files

## Status
Accepted (2026-09-24)

## Context
MediaPlan is frontend-only (ADR-0001's spirit persists through the
Vite+React migration, ADR-0013) with localStorage persistence (ADR-0002).
The coordinator team (multiple people, same M365 tenant) needs to work on
the same planning concurrently. The museum already has OneDrive/M365, so
adding a backend and database for sync would add operational cost the
team cannot maintain.

Alternatives considered:
- **Backend + database (ADR-0012's v2 vision)**: real-time sync, but
  requires hosting, auth, backups — exactly what frontend-only avoids
- **Manual file sharing (current v1, ADR-0011)**: no concurrency — one
  person edits at a time, risk of overwriting, no conflict detection
- **CRDT libraries (Yjs, Automerge)**: robust concurrent merging, but
  heavy for the data volume (~20 mediators, few dozen slots/day), and
  the storage layer is the cloud file anyway — CRDT solves a problem
  (per-entity merge) the team prefers to solve with explicit user choice
- **OneDrive native versioning**: exists (driveItem/versions API) but
  version creation and retention are tenant-config dependent and
  uncontrollable by the app

## Decision
Implement collaborative sync as a frontend-only module using the
Microsoft Graph API with OAuth 2.0 PKCE (public SPA client, no secret):

- A `/MediaPlan/` folder at the OneDrive root of the hosting account,
  created by the app, shared as an edit link to team members
- Each client resolves the share link once via the Graph `shares` API,
  then addresses the folder by driveId/itemId
- State stored as files:
  - `current.json` — the reference state (whole-version snapshot with
    author + timestamp metadata)
  - `history/<ISO-timestamp>_<user>.json` — one file per effective push,
    purged after 30 days. The app manages its own history rather than
  relying on OneDrive native versioning
- Push: debounced (5 s after last local mutation) + manual "save now"
- Pull: polling with ETag/If-None-Match, configurable 10 s – 15 min
  (default 30 s)
- Team members connect their own M365 accounts (author names come from
  the signed-in token); the app is registered as multitenant to support
  both personal and work accounts
- LocalStorage remains the source of truth: offline editing always
  works; sync pauses on network loss and resumes with backoff

## Consequences
- No backend to operate; the app stays deployable as static files
- Near-real-time collaboration (poll granularity), not instant
- OneDrive API rate limits apply (~10k req/10min/app): fine for a
  small team, polling frequency must stay configurable
- Tokens live in localStorage — a compromised browser profile exposes
  the sync session (accepted: same threat model as the planning data
  itself)
- Tenant policies (app registration restrictions, admin consent for
  Files.ReadWrite) can block setup — mitigated by multitenant
  registration fallback and a diagnostics panel in the Configuration
  view (sync journal, token status, raw Graph errors)
- Phase 2 (separate decision): read-only publication folder for
  mediators with filtered content (no other people's absences)
