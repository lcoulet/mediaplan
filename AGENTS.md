# AGENTS.md — Guide for AI Coding Agents

This file provides context, conventions, and rules for any AI coding agent
(Claude Code, Codex, Mistral VIBE, etc.) working on the MediaPlan project.

## Project Overview

MediaPlan is a web application for managing mediation schedules at the
Museum of Toulouse. It is **frontend-only** (no backend), with data in
`localStorage`. The UI is in **French**. All documentation is in **English**.

## Tech Stack

- **Vite** — build tool and dev server
- **React 18** — UI framework (function components, hooks)
- **TypeScript** — strict mode, type safety on all domain models
- **Vitest** — test runner (replaces node --test)
- HTML5 / CSS3 (global stylesheets: style.css, calendar.css)
- SheetJS (planned, not yet integrated — build dependency, not committed)
- Caddy for serving static files in production

## Project Structure

```
mediaplan/
├── index.html              # Vite entry point (<div id="root">)
├── vite.config.ts          # Vite + Vitest configuration
├── tsconfig.json           # TypeScript configuration (strict)
├── package.json            # Dependencies and scripts
├── src/
│   ├── main.tsx            # React entry point (mounts <App />)
│   ├── App.tsx             # Root component (view router + provider)
│   ├── style.css           # Main styles
│   ├── calendar.css        # Calendar-specific styles
│   ├── domain/             # Pure logic, no browser APIs (TESTED)
│   │   ├── types.ts         # Entity interfaces
│   │   ├── models.ts        # Factory functions + business logic
│   │   ├── history.ts       # Undo/redo state manager
│   │   └── export-utils.ts  # Export filename/metadata helpers
│   ├── infrastructure/      # Browser APIs, side effects
│   │   ├── store.ts         # localStorage persistence + gzip export/import
│   │   └── excel.ts         # Excel import/export (STUB)
│   └── presentation/        # React components (UI glue)
│       ├── DataContext.tsx  # Global state (Context API + useReducer)
│       ├── Header.tsx
│       ├── CalendarView.tsx
│       ├── MediatorsView.tsx
│       ├── OffersView.tsx
│       ├── AbsencesView.tsx
│       ├── ImportExportView.tsx
│       ├── Modal.tsx
│       ├── MediatorModal.tsx
│       ├── OfferModal.tsx
│       ├── SlotModal.tsx
│       ├── SlotDetailModal.tsx
│       ├── AbsenceModal.tsx
│       ├── DemoData.ts
│       └── types.ts
├── test/                   # Vitest tests (domain + infrastructure)
├── js/                     # Old vanilla JS (reference only — DO NOT MODIFY)
├── docs/
│   ├── business-specs.md
│   ├── architecture.md
│   ├── LEXICON.md
│   ├── OPEN-QUESTIONS.md
│   └── adr/                # Architecture Decision Records
├── TODO.md
├── AGENTS.md               # This file
├── LICENSE                 # MIT
└── README.md
```

## Development Rules

### Testing (TDD)

- **NO production code without a failing test first.**
- Write test → watch it fail (RED) → implement minimal code (GREEN) → refactor.
- Test command: `npm test` (= `vitest run`)
- All domain logic must be in `src/domain/` (testable in Node/jsdom without DOM).
- Presentation components (`src/presentation/`) are UI glue — not unit tested.
  Logic should be extracted from components into domain modules when testable.
- Tests use Vitest (`describe`, `it`, `expect`, `beforeEach`, `vi`).
- `localStorage` is mocked in test files via `vi.stubGlobal` (see `test/store.test.ts`).

### Commits

- **One functional change = one commit.** Never group multiple unrelated
  changes in a single commit.
- Commit messages in English, imperative mood: `"Add mediator color field"`.
- Always run tests before committing: `npm test`

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
  `src/domain/models.ts` (e.g. "14 sept. 2026 à 19:30").
- Respect web standards: semantic HTML, accessible forms, no inline styles
  (use CSS classes).

## Key Domain Concepts

### Entities

- **Mediator**: staff member, has a color, skills (offers), active status
- **Mediation Offer**: activity (tour, workshop, etc.) with duration, capacity,
  location, optional setup/teardown time
- **Schedule**: planning period, has a `locked` boolean
- **Slot (Reservation)**: assignment of one or more mediators to an offer at a
  date/time. Tracks `origin` (manual/imported), `importSource`, `importedAt`,
  `modifiedAfterImport`. Uses `mediatorIds: string[]` (array).
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
- 20 mediators, 70 offers, ~7 slots per weekday (weekdays only).
- Majority of slots are origin `imported` from "Secutix".
- 20 absences spread across the timeline.
- Some slots are unassigned, some are modified after import.
- Reset button (🔄) in the header clears localStorage and regenerates demo data.

## Known Issues & Pitfalls

- `src/infrastructure/store.ts` has `exportJSON()` and `importJSON()` that use
  browser APIs (`CompressionStream`, `Blob`, `FileReader`, `document`) — not
  tested in Node. When modifying, keep them browser-only or mock them.
- Excel import/export (`src/infrastructure/excel.ts`) is a stub — not implemented.
- The old `js/` directory is kept as reference for the vanilla→React migration.
  Do NOT modify it. New code goes in `src/`.
- Caddy config not yet updated to serve `dist/` (still references old setup).

## Environment

- VPS: Linux (RHEL/Rocky), public IP `31.70.143.152`
- Caddy installed (v2.6.4) — to serve `dist/` as static files
- GitHub: `lcoulet/mediaplan`, branch `main`, MIT license
- Local dev: `npm run dev` (Vite dev server on http://localhost:5173)
- Production build: `npm run build` → `dist/` served by Caddy

## Workflow

Development is orchestrated by a dedicated Hermes profile (`dev`) that
coordinates subagents through phases: specs → design → design review →
implementation → code review → quality gate. Individual agents receive
tasks via delegate_task and should focus only on their assigned phase.
The orchestrator handles context passing and phase sequencing.

The quality gate (`quality-gate` skill) runs six gates after every
implementation phase: build, tests, type-check, coverage, code audit,
and no regressions. All gates must pass before a phase is declared done.

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
