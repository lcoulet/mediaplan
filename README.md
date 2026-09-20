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
- Date pickers on both views (click the date / the period label)
- Manage mediators (add, edit, delete, colors, competences)
- Manage offers (catalog fully editable regardless of lock state)
- Manage reservations (slots) with multi-mediator assignment
- Per-slot setup/teardown durations (default from the offer, editable locked)
- Absences (leave, mission, training, sick, leave request) with configurable
  half-day boundaries
- Sorting and filtering in mediators, offers, and absences views
- URL routing: `?display=day|week&date=YYYY-MM-DD`
- Responsive planning grids (fill the screen width/height, clamped to readable
  scales)
- App-wide status bar (version, localStorage usage, last data update)
- JSON backup/restore with gzip compression
- Undo/redo (Ctrl+Z / Ctrl+Shift+Z)
- Data persistence via `localStorage`
- Planning locked by default (unlock with confirmation)

## Tech Stack

- **Vite** — build tool and dev server
- **React 18** — UI framework
- **TypeScript** — type safety
- **Vitest** — test runner
- HTML5 / CSS3 (global stylesheets, no CSS framework)
- [SheetJS](https://sheetjs.com/) for Excel import/export (planned)
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
│   │   ├── types.ts         # Entity interfaces (Mediator, Offer, Slot, etc.)
│   │   ├── models.ts        # Factories, business logic, date helpers
│   │   ├── history.ts       # Undo/redo state manager
│   │   └── export-utils.ts  # Export filename/metadata helpers
│   ├── infrastructure/
│   │   ├── store.ts         # localStorage persistence + gzip export/import
│   │   └── excel.ts         # Excel import/export (STUB — not implemented)
│   └── presentation/
│       ├── DataContext.tsx  # Global state (Context API + useReducer)
│       ├── Header.tsx       # Nav, undo/redo, half-day config
│       ├── DailyView.tsx    # Day planning (drag & drop)
│       ├── WeeklyView.tsx   # Weekly calendar grid
│       ├── MediatorsView.tsx / OffersView.tsx / AbsencesView.tsx
│       ├── ImportExportView.tsx
│       ├── Modal.tsx        # Generic modal wrapper
│       ├── MediatorModal.tsx / OfferModal.tsx / SlotModal.tsx
│       ├── AbsenceModal.tsx / SlotDetailModal.tsx / UserGuideModal.tsx
│       ├── MultiSelect.tsx  # Searchable multi-select with pills
│       ├── OfferPill.tsx    # Colored offer badge
│       ├── useElementWidth.ts  # Responsive grid scaling hooks
│       ├── DemoData.ts      # Demo data seeding
│       └── types.ts         # Presentation-layer types
├── test/                   # Vitest tests (domain + views)
├── js/                     # Old vanilla JS (reference only — not used)
├── docs/
│   ├── business-specs.md
│   ├── architecture.md
│   ├── LEXICON.md
│   ├── user-guide.md
│   ├── OPEN-QUESTIONS.md
│   └── adr/                # Architecture Decision Records
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
