# MediaPlan — Mediation Scheduling for the Museum

## Overview

MediaPlan is a web application for managing mediation schedules at the museum.
It allows coordinators to plan mediators, manage reservations, and import/export
data in Excel format.

The application is **frontend-only** (no backend). Data is stored in the
browser's `localStorage`. A future evolution to a server-based architecture is
planned. The UI is in **French** by default.

## Features

- **Weekly planning dashboard**: slot planning status (OK / to assign /
  availability issue / learning / incompetent) with severity colors, emojis,
  weekly stats badge and legend; native tooltip details
- Daily planning view: mediators as rows, time as columns, drag-and-drop of
  offers onto mediator tracks, booking vs. setup/teardown blocks, mediator
  filter (free/busy/all), offer search
- **Conflict badges on the day-view slot blocks**: « 🚫 Absent » (mediator
  unavailable for any cause — absence, non-worked day, outside hours) or
  « ⚠️ Conflit horaire » (overlap), with the cause in the tooltip
- **Annual view (« Tableau de fonctionnement »)**: one row per day, one
  column per mediator — cycle-derived presence, absences, leave wishes,
  paint mode, Saturday counters, quarterly quota balance, Excel export
- Work cycles (S1/S2… rotating weeks, per-day worked hours, JSON
  copy/paste), contract types and working-time arrangements with
  quarterly hour quotas
- Espaces (intervention locations) management
- Date pickers on both views (click the date / the period label)
- Manage mediators (add, edit, delete, colors, competences)
- Manage offers (catalog fully editable regardless of lock state)
- Offer welcome type ("Type d'accueil"): free-entry offers
  (Accueil Libre) need no mediator — their slots display as OK even when
  unassigned
- Manage reservations (slots) with multi-mediator assignment
- Per-slot setup/teardown durations (default from the offer, editable locked)
- Absences (leave, mission, training, sick, leave request) with configurable
  half-day boundaries
- Secutix import (synchronization with deduplication, label review,
  cancellation cleanup, one-click undo) — via SheetJS
- Sorting and filtering in mediators, offers, and absences views
- URL routing: `?display=day|week|tableau|…&date=YYYY-MM-DD`
- Responsive planning grids (fill the screen width/height, clamped to readable
  scales)
- App-wide status bar (version, localStorage usage, last data update)
- JSON backup/restore with gzip compression
- Undo/redo (Ctrl+Z / Ctrl+Shift+Z) + history panel (H)
- Data persistence via `localStorage`
- Planning locked by default (unlock with confirmation)

## Tech Stack

- **Vite** — build tool and dev server
- **React 18** — UI framework
- **TypeScript** — type safety
- **Vitest** — test runner
- HTML5 / CSS3 (global stylesheets, no CSS framework)
- [SheetJS](https://sheetjs.com/) for Excel import/export (Secutix reader,
  annual-table export)
- Data in `localStorage`

## Project Structure

```
mediaplan/
├── index.html              # Vite entry point
├── vite.config.ts          # Vite + Vitest configuration
├── tsconfig.json           # TypeScript configuration
├── package.json            # Dependencies and scripts
├── src/
│   ├── main.tsx            # React entry point
│   ├── App.tsx             # Root component (view router)
│   ├── style.css           # Main styles
│   ├── calendar.css        # Calendar-specific styles
│   ├── domain/             # Pure logic, no browser APIs (TESTED)
│   │   ├── types.ts         # Entity interfaces (Mediator, Offer, Slot, WorkCycle…)
│   │   ├── models.ts        # Factories, business logic, planning status, date helpers
│   │   ├── cycles.ts        # Work-cycle rotation, worked hours per date
│   │   ├── cycle-display.ts # Cycle pills, hatching, worked-period availability
│   │   ├── annual-view.ts   # Annual grid cell derivation
│   │   ├── annual-editing.ts# Annual grid entries (absence painting)
│   │   ├── annual-export.ts # Annual table Excel export model
│   │   ├── secutix-import.ts# Secutix synchronization (dedup, mapping rules)
│   │   ├── history.ts       # Undo/redo state manager
│   │   └── …                # stats, spaces, hours, parallel-lanes, sync-state, etc.
│   ├── infrastructure/
│   │   ├── store.ts         # localStorage persistence + gzip export/import
│   │   ├── secutix-reader.ts# Secutix Excel reading (SheetJS)
│   │   ├── annual-excel.ts  # Annual table .xlsx writing with styles (SheetJS)
│   │   └── excel.ts         # Excel import/export helpers
│   └── presentation/
│       ├── DataContext.tsx  # Global state (Context API + useReducer)
│       ├── Header.tsx       # Nav, Secutix import, export/import, undo/redo
│       ├── DailyView.tsx    # Day planning (drag & drop, conflict badges)
│       ├── WeeklyView.tsx   # Weekly calendar grid (planning status)
│       ├── ReservationView.tsx # Plan Accueil (day's booking list)
│       ├── AnnualView.tsx   # Annual grid (« Tableau de fonctionnement »)
│       ├── ConfigurationView.tsx # Espaces + data management
│       ├── MediatorsView.tsx / OffersView.tsx / AbsencesView.tsx / StatsView.tsx
│       ├── CycleChainModal.tsx # Work-cycle chain editor
│       ├── Modal.tsx        # Generic modal wrapper
│       ├── MediatorModal.tsx / OfferModal.tsx / SlotModal.tsx / AbsenceModal.tsx
│       ├── SlotDetailModal.tsx # Read-only slot detail (weekly view)
│       ├── MultiSelect.tsx / SingleSelect.tsx # Searchable selects with pills
│       ├── OfferPill.tsx    # Colored offer badge
│       ├── SpacesSection.tsx # Espaces management (Configuration view)
│       ├── HistoryPanel.tsx # Undo/redo history side panel
│       ├── SecutixImportPanel.tsx # Secutix import flow
│       ├── useElementWidth.ts  # Responsive grid scaling hooks
│       ├── useKeyboardShortcuts.ts # Global shortcuts (1-9, ←/→, T, N, H, ?)
│       ├── DemoData.ts      # Demo data seeding
│       └── types.ts         # Presentation-layer types
├── test/                   # Vitest tests (domain + views, ~64 files)
│   └── features/           # Gherkin/BDD scenarios (annual-view, cycles, sync…)
├── docs/                   # Specs, lexicon, user guide, ADRs, captures
├── public/mockups/         # Static HTML design mockups
├── js/                     # Old vanilla JS (reference only — not used)
├── TODO.md
├── AGENTS.md
├── LICENSE                 # MIT License
└── README.md               # This file
```

## Getting Started

```bash
npm install        # Install dependencies
npm run dev        # Start dev server (http://localhost:5173)
npm run build      # Production build → dist/
npm run preview    # Preview production build
npm test           # Run tests
```

## License

[MIT](LICENSE) — © 2026 Loic Coulet
