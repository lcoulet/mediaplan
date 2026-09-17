# AGENTS.md — Guide for AI Coding Agents

This file provides context, conventions, and rules for any AI coding agent
(Claude Code, Codex, Mistral VIBE, etc.) working on the MediaPlan project.

## Project Overview

MediaPlan is a web application for managing mediation schedules at the
Museum of Toulouse. It is **frontend-only** (no backend), with data in
`localStorage`. The UI is in **French**. All documentation is in **English**.

## Tech Stack

- Vanilla JavaScript (ES modules) — no framework, no build tool (yet)
- HTML5 / CSS3
- Node.js built-in test runner (`node --test test/`)
- SheetJS (planned, not yet integrated — build dependency, not committed)
- Caddy for serving (planned)

## Project Structure

```
mediaplan/
├── index.html              # Entry point
├── css/
│   ├── style.css           # Main styles
│   └── calendar.css        # Calendar-specific styles
├── js/
│   ├── app.js              # Main application logic (UI glue — needs refactoring)
│   ├── models.js           # Data models (TESTED, TDD)
│   ├── store.js            # localStorage persistence (TESTED, TDD)
│   └── excel.js            # Excel import/export (STUB — not implemented)
├── test/                   # Node.js built-in test runner
│   ├── models.test.js
│   ├── store.test.js
│   ├── absence.test.js
│   ├── slot-origin.test.js
│   ├── mediator-color.test.js
│   └── overlap.test.js
├── docs/
│   ├── business-specs.md   # Domain model, entities, features
│   └── architecture.md     # Deployment, tech stack, environment
├── TODO.md                 # Roadmap
├── AGENTS.md               # This file
├── package.json            # npm scripts (test only for now)
├── LICENSE                 # MIT
└── README.md
```

## Development Rules

### Testing (TDD)

- **NO production code without a failing test first.**
- Write test → watch it fail (RED) → implement minimal code (GREEN) → refactor.
- Test command: `node --test test/`
- All model logic must be in `models.js` (testable in Node without DOM).
- `app.js` is UI glue — it imports from tested modules but contains DOM code.
  Logic should be extracted from `app.js` into testable modules over time.
- Tests use Node's built-in `node:test` and `node:assert/strict`.
- `localStorage` is mocked in test files (see `test/store.test.js`).

### Commits

- **One functional change = one commit.** Never group multiple unrelated
  changes in a single commit.
- Commit messages in English, imperative mood: `"Add mediator color field"`.
- Always run tests before committing: `node --test test/`

### Documentation

- All documentation on GitHub (README, specs, comments, issues, PRs) is in
  **English**.
- The application UI is in **French** (labels, alerts, confirmations).
- Domain specs provided in French by the stakeholder stay in French in
  discussion, but the repo docs are English.

### Dates and Standards

- All dates in the data model are **ISO 8601** (e.g. `2026-09-15`,
  `2026-09-14T19:30:00.000Z`).
- Human-friendly display is French format via `formatImportDate()` in
  `models.js` (e.g. "14 sept. 2026 à 19:30").
- Respect web standards: semantic HTML, accessible forms, no inline styles
  (use CSS classes).

## Key Domain Concepts

### Entities

- **Mediator**: staff member, has a color, skills (offers), active status
- **Mediation Offer**: activity (tour, workshop, etc.) with duration, capacity, location
- **Schedule**: planning period, has a `locked` boolean
- **Slot (Reservation)**: assignment of a mediator to an offer at a date/time,
  tracks `origin` (manual/imported), `importSource`, `importedAt`,
  `modifiedAfterImport`
- **Absence**: mediator unavailability (leave, mission, training, sick, other),
  full-day or half-day (morning/afternoon)

### Business Rules

- A mediator **cannot** be assigned to two overlapping slots on the same date
  (`hasMediatorOverlap()` enforces this).
- Absences are **non-interactive** on the calendar (visual only,
  `pointer-events: none`).
- Mediator assignment is always allowed (even when planning is locked) —
  opens a mediator-only modal in locked mode.
- Modifying an imported slot marks it `modifiedAfterImport: true`.
- The planning is **locked by default**. Unlocking requires a confirmation
  warning. Locking is instant.
- Overlapping slots are displayed **side-by-side** in parallel lanes within
  day columns.

### Demo Data

- Generated relative to the current date: from start of previous month to end
  of next month (~3 months).
- 5 mediators, 4 offers, ~64 slots (weekdays only).
- Majority of slots are origin `imported` from "Secutix".
- 9 absences spread across the timeline.
- Some slots are unassigned, some are modified after import.
- Reset button (🔄) in the header clears localStorage and regenerates demo data.

## Known Issues & Pitfalls

- `app.js` contains both UI logic and some business logic — needs extraction
  into tested modules.
- `store.js` has `exportJSON()` and `importJSON()` that use browser APIs
  (`Blob`, `FileReader`, `document`) — not tested in Node. When modifying,
  keep them browser-only or mock them.
- Excel import/export (`excel.js`) is a stub — not implemented.
- No build system yet — files are served directly. When adding a build step,
  SheetJS should be a build dependency (not committed to git).

## Environment

- VPS: Linux (RHEL/Rocky), public IP `31.70.143.152`
- Caddy installed but not configured/running (no sudo access for the agent)
- GitHub: `lcoulet/mediaplan`, branch `main`, MIT license
- Local dev: `python3 -m http.server 8000` in the project root

## Workflow

Development is orchestrated by a dedicated Hermes profile (`dev`) that
coordinates subagents through phases: specs → design → design review →
implementation → code review → quality gate. Individual agents receive
tasks via delegate_task and should focus only on their assigned phase.
The orchestrator handles context passing and phase sequencing.

Architectural decisions are documented in `docs/adr/`. Any change that
reverses or supersedes an existing decision must update or add an ADR.

Domain vocabulary is defined in `docs/LEXICON.md`. All agents must use
these terms consistently in code, documentation, and discussion.

Open questions and established facts are tracked in
`docs/OPEN-QUESTIONS.md`. Never start work on a topic that has open
questions — resolve them first.

## User Preferences

- Communication: direct and concise, French or English
- Challenge the user's requests when needed
- Explain actions briefly at each step (not too laconic)
- Test before claiming something is done — a pushed commit is not proof it works
