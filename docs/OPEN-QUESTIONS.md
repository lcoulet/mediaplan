# Open Questions — MediaPlan

## Secutix Import

**Established so far (from the confidential export `sem39sem51.xlsx`,
weeks 39–51, analyzed locally, never committed):**
- [x] Export layout: single sheet `visitPlanning`, header row 2, one
  booking per row, trailing "Total" row (skipped)
- [x] Rows with theme `G/ Droit d'accès` (entry fees) are NOT imported
- [x] The dossier d'achat is the reservation contract and can cover
  several slots → dedup key is composite (contract + offer + date +
  time + group name), not the contract alone
- [x] Booking times from the Secutix file take priority over the offer's
  default duration (duration varies within a product)
- [x] THÈME is the offer label → offers carry a `secutixLabel` for
  reconciliation
- [x] Slot gains booking-detail fields: group name, guide, espace,
  group nature, contact (name/phone/email), contract number; Secutix
  "REMARQUE" lands in slot notes
- [x] Offers get a default espace (`location`), overridable per slot,
  set by the import on imported slots

**Resolved:**
- [x] Import UX: FULL SYNC (decided 2026-09-21, removal semantics
      2026-09-22) — add new bookings, update modified ones (headcount,
      times), REMOVE the ones that left the file (cancelled in Secutix;
      recoverable via the import's undo), preserving mediator
      assignments. Offer reconciliation (map, create or ignore) blocks
      the import until every THÈME label has a decision. The summary
      popup reports added/updated/removed counts and the covered date
      range, with a one-click undo. Some rows carry an empty THÈME
      (private ANNIVERSAIRE products): they surface as
      "(sans libellé Secutix)" and must be mapped to an existing offer
      or ignored.
- [x] "G/ Pause Repas" rows ARE imported — the rooms are used by groups
      for lunch; the corresponding offer is `Accueil Libre` (no mediator)
- [x] welcomeType mapping lives in the OFFER database (each offer carries
      its type d'accueil), not in the import. Demo data now reflects the
      real Secutix catalog with per-offer welcome types:
      Visites Encadrées/Labos/Ateliers/PSH/HLM → mediator required;
      Visite Libre / Pause Repas / Mallette / Mise à disposition /
      ANNIVERSAIRE → `Accueil Libre` (ANNIVERSAIRE confirmed by Loic)

## Mediator Annual Planning View (vue planning médiateurs)

**Established so far:**
- [x] View is an annual grid: rows = days of the year, columns = mediators,
  one cell per half-day (morning / afternoon) — matches the Excel reference
  file (`MHN_Fonctionnement_ Mediateurs.xlsx`, sheet "MHN 2026")
- [x] Week numbers are ISO 8601, displayed on Monday rows (like "S 37")
- [x] Year is switchable (Excel covers 2023, 2025, 2026, 2027)
- [x] A mediator's cycle (S1, S2, S3...) is displayed once per week (on the
  Monday cell of the third sub-column), valid for the whole ISO week
- [x] Cycle LENGTH is variable per mediator (1 to N weeks), rotating +1 per
  ISO week (observed: S3 → S4 → S1 → S2 for a 4-week cycle)
- [x] Cell colors carry meaning (from the Excel file):
  - orange empty cell = standard presence (worked per cycle)
  - yellow + code (CA, RHS, RTT, AM, CET, Cex, congé parental/maternité/
    naissance, dispo) = paid leave / absence
  - gray + TELE = remote work (télétravail)
  - orange + text (Réf. WE, offre anniv, Stop Motion, Montréal, RDV aux
    Jardins, "amgt JJ/MM", durations like 7:45) = missions / events /
    special arrangements
  - red + code (grève, syndicat, formation) = work-related absence
  - green cells exist (267) — meaning TBD
- [x] Excel also has count columns (ratio, Médiateurs: per-day presence
  counts morning/afternoon) — may or may not be needed in the app
- [x] Excel reference file is CONFIDENTIAL: analyzed locally, never
  committed; only structural findings are documented
- [x] The view is EDITABLE: absences AND cycles are managed in the grid
- [x] Absence types: reuse the existing AbsenceType list, extended with
  the full list of codes from the Excel file (Loic to provide meanings)
- [x] Weekends ARE shown (all days, like the Excel file)
- [x] ISO week numbers are now displayed in the daily and weekly view
  labels (commit 45a3475)
- [x] Unassigned count is shown in the daily view lane label (commit 5c7ac6d)

**Open questions:**
- [ ] Exact meaning of the main codes: TP (1696×, 2nd most common), CA,
      RHS, AM, "Réf. WE", "amgt JJ/MM", and the numeric cells (1-19) —
      Loic to provide the legend (needed to extend AbsenceType)
- [ ] Which absence/mission types should the app model natively vs. free
      text? (current AbsenceType: leave, mission, training, sick, other,
      leave_request)
- [ ] Do cycle weeks carry working-hour patterns (LEXICON says each cycle
      week defines precise working days and hours), or is a cycle week
      just a label with presence on fixed weekdays?
- [ ] Where does cycle data live: new WorkCycle/CycleWeek entities (TODO
      section "Work Cycles") — how do they interact with the existing
      Absence entity for display?
- [ ] Should the count columns (per-day presence totals) be reproduced?

## OneDrive Synchronization (synchro cloud collaborative)

Frontend-only collaboration via Microsoft Graph API (PKCE OAuth, no backend).
Users: the coordinator team (Loic does not need access himself).

**Established so far (decided 2026-09-24):**
- [x] Storage: a `/MediaPlan/` folder at the OneDrive root, created by the app
      on first setup: `current.json` (reference state) + `history/` with one
      timestamped file per effective push (`<ISO-timestamp>_<user>.json`),
      purged automatically after 30 days
- [x] OneDrive native versioning is NOT relied upon (retention/config is
      tenant-dependent and uncontrollable) — the app writes its own history
      files instead
- [x] Push: automatic, debounced (5 s after the last local mutation) + manual
      "Save now" button
- [x] Pull: polling `current.json` (ETag/If-None-Match), frequency configurable
      10 s – 15 min, default 30 s, entered in seconds or minutes
- [x] Conflict model: whole-version comparison (no per-entity merge).
      Divergence = local state and remote state both changed since the last
      synced common state
- [x] Conflict dialog shows both versions with their last-modified
      date/time and author: "Garder ma version" vs "Garder la version
      partagée". Either choice is undoable in both directions (the history
      files keep both versions, undo/redo navigates between them)
- [x] Conflict dialog behavior:
  - Configurable no-response timeout (e.g. 5 min). Timer does NOT reset
    when the remote changes
  - Polling CONTINUES while the dialog is open: if new remote versions
    arrive, the dialog updates live ("N nouvelles versions sur le drive",
    details of the latest proposed version) — same UX as reconnecting after
    offline changes
  - On timeout: sync pauses with a notification ("Synchro en pause —
    divergence non résolue"), re-prompted only when the user re-enables
  - If the connection drops while the dialog is open, the dialog CLOSES
    cleanly and sync pauses
- [x] Reconnection: silent token refresh from the refresh token (localStorage);
      on repeated 401 a yellow banner "Session cloud expirée" with a
      reconnect button (local editing never blocked); full OAuth popup only
      on first setup or manual reconnect; NO automatic retry loops
- [x] Offline: localStorage stays the source of truth; sync pauses on network
      loss and auto-resumes with backoff on reconnect; local editing is
      never blocked
- [x] UI: the Import/Export view becomes a **Configuration** view with
      sub-sections: Secutix import, OneDrive sync (connect/disconnect, poll
      frequency, status, last sync time), half-day configuration (moved from
      its current location). The header gets a sync toggle + status button,
      disabled when sync is not configured or in error
- [x] Accounts: support both OneDrive Personal and M365 Business (work/school)

**Open questions:**
- [ ] App registration location: if the museum M365 tenant blocks user app
      registrations, fallback is registering a multi-tenant app from a
      personal Microsoft account — to confirm with the tenant admin (procedure
      sent to Loic 2026-09-24)
- [ ] Which Microsoft account hosts the `/MediaPlan/` folder and how the team
      members get access (shared folder vs same-tenant accounts)
- [ ] Does M365 Business require admin consent for `Files.ReadWrite`
      delegated scope on this tenant?
