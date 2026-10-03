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

## Legacy Spec Reconciliation (old project brief, reviewed 2026-09-29)

**Established (decided 2026-09-29, from the old project brief audit):**
- [x] AUTOMATIC ASSIGNMENT: OUT OF SCOPE — assignment stays MANUAL,
      assisted (competence highlighting, statuses, warnings) + statistics.
      An optimizer is deemed risky at this stage. Possible future
      ASSISTANCE improvements (noted, not specced): list potential
      problems in the day view and jump to the next one
- [x] LOAD BALANCING / ROTATION: a per-mediator LOAD INDICATOR is wanted
      (weeks/quarter — the hourly quota machinery from slice 2 provides
      the data); no auto-rotation. To spec as its own feature
- [x] CHRONOTIME: dead — no HR-system cross-reference, considered moot
- [x] ACTIVITY TYPES (from the old brief: animations hors les murs,
      réunions, travail hors face public, maraudage/accompagnement
      libre): modeled as "AUTRES ACTIVITÉS" — NOT catalog offers.
      Freely draggable onto the planning, mediators assignable. To
      model and spec
- [x] SPACE (ESPACE) COLORS: CONFIRMED real need, not yet specced —
      a MANAGEABLE LIST OF SPACES (list of espaces) each with a color
      code, used in the day view and accueil view. Offers already
      carry a default space, but the space must be OVERRIDABLE per slot;
      autres activités also carry a space. To spec

**Open questions (from the old brief, to resolve before the next spec phase):**
- [ ] AUTRES ACTIVITÉS modeling: how do they differ from a manual slot
      on a generic offer? Proposed: a distinct entity (name, color,
      default duration?) with its own draggable lane, distinct from the
      offer catalog; reusable like offers. Which activities does the
      team need at start (réunions, travail hors face public, hors les
      murs, marauding)? Free-created or predefined?
- [ ] SPACES: is the space an entity on offers AND slots (offer default +
      per-slot override — slot.location already exists, needs a
      manageable list + colors)? Where is the space list managed?
      Does the offer color stay, or is the space color the primary
      display signal in the day view?
- [ ] LOAD INDICATOR: display form (per-mediator counter in day view?
      stats view?) and granularity (day/week/quarter — quarter reuses
      the quota balance)

**Legacy terminology mapping (for the record):**
- "maîtrise des animations" → Competence (confirmed/learning)
- "cheffes d'équipes" → Coordinator
- "présentes non disponibles" → computed availability (absence/overlap/
  cycle), not a stored state
- "maraudage/accompagnement libre" ≈ Accueil Libre (welcomeType)

## Spaces (Espaces) — colored spaces + short offer label + day-view print

**Established (decided 2026-09-29):**
- [x] SPACE ENTITY: manageable list of spaces (list of espaces), each
      with a NAME and a COLOR. Existing `location` free-text values
      (offers + slots) are AUTO-MIGRATED into the list (one space per
      distinct value)
- [x] SPACE LIST MANAGEMENT: in the CONFIGURATION view — the view must
      be BUILT TOGETHER with this feature (it does not exist yet)
- [x] DAY VIEW: space color is the PRIMARY signal — it colors the
      block BACKGROUND. Offer keeps a color signal as a small colored
      dot (dot) next to the short label — NOT a pill (to confirm)
- [x] ACCUEIL VIEW: space color on the offer's BAND background; the
      mediator column stays untouched
- [x] SHORT OFFER LABEL (shortLabel field on Offer, to spec): editable
      in OfferModal, displayed in the day view; falls back to the
      offer's full name when empty
- [x] PRINT (day view): readable A4 LANDSCAPE — time axis stops at
      19:00 (a slot exceeding 19:00 extends the axis to its end);
      short offer label used for readability. Start-time behavior TBD

**Open questions (spaces/print):**
- [x] Offer signal in the space-colored block: colored DOT next to the
      short label (decided 2026-09-29)
- [x] Secutix import ESPACE values: AUTO-CREATE spaces from unseen
      values, default color WHITE (blanc) (decided 2026-09-29)
- [x] Configuration view scope NOW (decided 2026-09-29): replaces the
      "Import / Export" nav entry; contains: Espaces section, JSON.gz
      export/import, data delete, demo data, half-day settings. The
      SECUTIX IMPORT IS **NOT** IN IT — it is a daily foreground
      function and stays a HEADER button (per the earlier header
      decision). OneDrive sync section comes with sync slice 4
- [x] Print time axis: fixed START at 08:30, extends left if a slot
      starts earlier; fixed END at 19:00, extends right if a slot ends
      later (decided 2026-09-29)
- [ ] Space color conflicts with mediator lane hatching/cycle colors —
      readability check needed during design review

## Header Import/Export buttons (decided 2026-10-03 — M365 tenant unavailable)

**Context:** the museum M365 tenant blocks app registrations for the
coordinator (no Azure permissions). The team will work in MANUAL
import/export mode (shared JSON.gz files) until tenant access is sorted.

**Established (decided 2026-10-03):**
- [x] TWO BUTTONS in the HEADER (top, alongside the other action
      buttons): Export (💾) and Import — foreground daily functions,
      like the Secutix import button. The Données section of the
      Configuration view keeps the full-featured import/export
- [x] EXPORT-HIGHLIGHT: when local data changed SINCE the last export
      (or since the last import/connection), the Export button must be
      VISUALLY HIGHLIGHTED (unsaved-changes indicator)
- [x] IMPORT OLD-FILE WARNING: importing a file whose data is OLDER
      (by lastModified metadata) than local data triggers a warning
      (« ce fichier est plus ancien que vos données ») — confirm to
      proceed anyway. NOTE: TODO.md claimed this was done; it is NOT
      in the code — the checkmark was premature

**Open questions (before spec):**
- [ ] Highlight detection basis: compare lastModified of the data
      against a new `lastExportedAt` stamp (persisted) — or track
      "dirty" via history entries? Proposed: persist `lastExportedAt`
      (+ lastImportedAt), highlight when data.lastModified > lastExportedAt
- [ ] Button placement: next to « ⇩ Import Secutix » in the header
      actions, or integrated INTO a single import button (file picker
      chooses)? Proposed: two separate buttons — Export is one-click
      (save JSON.gz with timestamp filename), Import opens the file
      picker directly
- [ ] Does the Import header button go through the same confirmation
      as the Configuration view import (⚠ replaces all data), plus
      the old-file warning?
- [ ] Highlight style: badge/dot on the Export button (like the
      unassigned count), or colored button? Proposed: amber dot badge
      + title, no color change (header already busy)

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

**Work cycles (decided 2026-09-25, refined 2026-09-26):**
- [x] A mediator = ONE TO SEVERAL cycle weeks (S1, S2... rotating)
- [x] Cycle copy/paste: a button copies a cycle definition as JSON to the
      clipboard; a paste button imports it into another mediator (or the
      same one) — reuse of cycle definitions across mediators
- [x] Each cycle week defines WORKED DAYS (or not) + a WORKING HOUR RANGE
      (amplitude horaire)
- [x] The working hour range is PER DAY (e.g. S1 = Mon 9:30-18:00,
      Tue 10:00-18:30) — not one range for the whole week
- [x] Weekends can be worked (Saturday/Sunday are possible worked days)
- [x] DEFAULT for a new mediator: a single cycle week, Monday–Friday,
      09:30–18:00
- [x] A slot assigned outside the working amplitude triggers a LIGHT
      WARNING (allowed, not forbidden)
- [x] Cycle anchoring: by default the rotation starts at week 1 (S1) —
      but it must be adjustable: restart the rotation at an arbitrary
      week, and FORCE specific weeks manually per ISO week, for maximum
      flexibility (e.g. override "this ISO week shows S3 although the
      rotation would give S1")
- [x] Daily view display: the mediator's lane shows the working hour
      range, with HATCHING outside working hours; a pill (or column)
      displays the current cycle week (S1/S2/...) next to the mediator name
- [x] Mediators view: a modal to define the sequence of cycle weeks
      (the cycle chain of the mediator)
- [ ] CYCLE ARCHETYPES (noted 2026-09-29, to spec): cycles should have
      ARCHETYPES — reusable predefined cycle templates (e.g. full-time
      Mon-Fri, part-time patterns, weekend rotations) that a mediator's
      cycle can be created from, instead of always starting from the
      default or a blank. Details TBD: where archetypes are managed,
      whether the copy/paste JSON mechanism is the basis, built-in vs
      user-defined archetypes

**Contract type (decided 2026-09-25):**
- [x] Mediators have a CONTRACT TYPE: temps plein, mi-temps, stagiaire...
- [x] Visible visually as a pill or icon next to the mediator
- [x] Selector with predefined values + free text allowed

**Hourly management for part-time mediators (raised 2026-09-29):**
- [x] Contract types must distinguish the CONTRACT from the working-time
      ARRANGEMENT (aménagement du temps de travail): e.g. "mi-temps
      thérapeutique" and "temps partiel" are aménagements, alongside
      regular contracts
- [x] Part-time mediators need FINE HOURLY MANAGEMENT: a configurable
      QUARTERLY HOUR QUOTA (quota d'heures trimestriel, configurable
      per quarter)
- [x] Some days are MORE VALUED (jours valorisés): Sundays, Saturdays
      (starting from the 10th or 12th in the year — configurable
      quantity), and public holidays (jours fériés)
- [x] Fine hourly management must be specified and provided

**Open questions (hourly management):**
- [ ] Exact valorisation MULTIPLIERS for Sunday and valued Saturdays —
      open; will be CONFIGURABLE in the app. CONFIRMED: jours fériés
      count DOUBLE (×2)
- [ ] Quarterly quota config UI: per-quarter value on the mediator form?

**Established (hourly management, decided 2026-09-29):**
- [x] FORCED WEEKS ARE PUNCTUAL (decided 2026-09-29, option A): forcing an
      ISO week onto a cycle week does NOT shift the rotation of following
      weeks — pure anchor-difference rotation resumes immediately after
      (W41 forced to S3 with anchor W40=S1, cycle S1-S2-S3: W42 = S3,
      not S2). Spec text fixed accordingly.
- [x] VALORISED DAYS AND CLOSED DAYS (validated 2026-09-29): assigning a
      slot on a museum-closed day (25/12, 01/01, 01/05) is REFUSED;
      a férié falling on a weekend counts férié ×2 only (highest single
      multiplier, no stacking); adding an aménagement mid-quarter counts
      only slots AFTER configuration (removal stops tracking); quota
      config without aménagement is refused
- [x] Valorisation: jours fériés count DOUBLE (×2); Sunday/Saturday
      multipliers TBD but must be configurable in the app
- [x] VALUED SATURDAYS: Saturdays FROM the 10th/12th Saturday of the
      year onward are valued (first ones are normal) — the threshold
      (10 or 12) is a configurable quantity
- [x] Quota overrun/underrun: WARNING (non-blocking); the remaining
      balance (reliquat or déficit) is CARRIED OVER to the next quarter
- [x] Quota display: in the mediator form AND in the "tableau de
      fonctionnement" (annual presence-days view)
- [x] TWO separate fields: contractType (temps plein, stagiaire...) +
      aménagement (temps partiel, mi-temps thérapeutique...) — the
      quarterly quota applies to aménagements
- [x] Jours fériés: default French public-holiday list (auto-computed
      per year), modifiable in the tableau de fonctionnement
- [x] Museum CLOSED on 25/12, 01/01 and 01/05

**Open questions:**
- [ ] Exact meaning of remaining numeric cells (1-19) and "Réf. WE" —
      Loic to provide. Main codes DECODED (2026-09-26):
      - TP = Temps Partiel (1696×, 2nd most common)
      - CA = Congé Annuel
      - RHS = Récupération Heures Supplémentaires
      - AM = Arrêt Maladie
      - amgt = Aménagement (exceptional change of one or more worked days)
      - CEX = Congé Exceptionnel
      - TPT = Temps Partiel Thérapeutique
- [ ] Which absence/mission types should the app model natively vs. free
      text? (current AbsenceType: leave, mission, training, sick, other,
      leave_request — the decoded codes map onto these: CA/RHS/CEX → leave,
      AM/TPT → sick, TP → contract type or availability state, amgt →
      cycle override; to confirm during specs)
- [ ] Predefined contract-type list: TBD — the selector starts with
      temps plein / mi-temps / stagiaire + free text; TP (temps partiel)
      should be added to the predefined list; more values may be added
      later once the real list is known
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

**Resolved (2026-09-25 — spec-level ambiguities):**

**Resolved (2026-09-24):**
- [x] Folder hosting: the coordinator's M365 work account hosts `/MediaPlan/`;
      the app creates the folder and an edit share link ("specific people")
      that team members paste into their config. The app resolves the link
      once via the Graph `shares` API, stores driveId/itemId, then addresses
      the shared folder directly. Team members connect their own accounts
      from the same M365 tenant
- [x] Author attribution: each history file is stamped with the display name
      from the signed-in user's token
- [x] Read-only sharing for mediators (phase 2): a SEPARATE published folder
      (distinct from the collaboration folder) with different content —
      mediators must NOT see other people's absences (HR-sensitive data),
      nor necessarily the whole planning/stats. Publication = filtered
      extract (own assignments + public planning), shared read-only. Details
      (exact content, granularity, per-mediator files vs one file) to be
      defined in phase 2

**Resolved (2026-09-25 — spec-level ambiguities):**
- [x] History filename timestamp encoding: ISO 8601 UTC with `:` replaced
      by `-` (e.g. `2026-09-24T14-30-05Z_loic.json`) — sorts
      alphabetically = chronologically, no timezone ambiguity (users never
      pick the file by hand)
- [x] "Save now" during a pending conflict: the button is DISABLED while
      the conflict dialog is open (no queue, no dialog trigger)
- [x] Out-of-range poll frequency: rejected with an error message, value
      unchanged (no silent clamping)
- [x] Repeated-401 threshold: 2 consecutive 401s disable sync (the first
      may be a mid-refresh expiry)
- [x] Proactive token refresh margin: 60 s before expiry
- [x] Choosing "Garder la version partagée" does NOT write a new drive
      history file (the drive already holds that version); the losing local
      version stays in the local undo stack (50 entries)
- [x] Conflict timeout setting location: Sync section of the Configuration
      view, next to the poll frequency
- [x] Conflict timeout accepted range: 30 s – 60 min, default 20 min,
      configurable; out-of-range rejected with error, value unchanged
- [x] History purge: configurable retention (default 30 days, bounds
      1–365 days, field in the Configuration view), triggered on each
      effective push
- [x] Drive versions in the History Panel: the panel gains a second group
      "Historique partagé" listing drive history/ files (date/time +
      author), loaded on demand when the panel opens (one Graph call, no
      extra polling). Restoring a drive version = load file, apply as
      local state (undoable entry), then a normal push (append-only
      history, never in-place modification). Display capped at the N most
      recent files (50). Extends ADR-0004 (panel stays in-memory for the
      local group; undo/redo behavior unchanged)
- [x] Conflict dialog close (✕) button: explicit behavior — sets sync to
      PAUSED without choosing (same outcome as the no-response timeout),
      with a tooltip/label making it explicit ("Mettre la synchro en
      pause sans choisir"). Re-prompted only on manual re-enable, like
      the timeout path (decided 2026-09-24, design review)
- [x] Header restructure (design review decisions): the gear icon button
      navigates to the Configuration view (replacing the "Import / Export"
      nav item — the nav keeps 7 view entries); an "Import Secutix" icon
      button lives in the header and opens the Secutix import; the sync
      pill (toggle + status) sits on its own bar below the header,
      left-aligned; the help (?) link is the last header element. The
      half-day settings move out of the gear popup into the Configuration
      view
- [x] PKCE connection DE-RISKED (2026-09-25): the frontend-only flow
      validated end-to-end with a personal Microsoft account on the test
      page (public/sync-test.html, served at
      https://test-mediaplan.coulet.me/sync-test.html): authorize →
      code exchange (browser-direct POST, CORS OK) → token → 5 Graph
      tests passed (profile /me, drive root, read children, write test
      file, delete test file). ADR-0014 is proven feasible as specced.
      Remaining risk: the museum M365 tenant policies (app registration
      restrictions, admin consent) — checklist with the coordinator
      pending
