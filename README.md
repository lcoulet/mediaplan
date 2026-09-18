# MediaPlan — Mediation Scheduling for the Museum

## Overview

MediaPlan is a web application for managing mediation schedules at the museum.
It allows coordinators to plan mediators, manage reservations, and import/export
data in Excel format.

The application is **frontend-only** (no backend). Data is stored in the
browser's `localStorage`. A future evolution to a server-based architecture is
planned. The UI is in **French** by default.

## Features

- Manage mediators (add, edit, delete)
- Create and edit schedules
- Manage reservations (slots) with multi-mediator assignment
- Import/export data in Excel format (.xlsx) — SheetJS (planned)
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
│   ├── App.tsx             # Root component
│   ├── style.css           # Main styles
│   ├── calendar.css        # Calendar-specific styles
│   ├── domain/
│   │   ├── types.ts         # Entity interfaces (Mediator, Offer, Slot, etc.)
│   │   ├── models.ts        # Factory functions + business logic (TESTED)
│   │   ├── history.ts       # Undo/redo state manager (TESTED)
│   │   └── export-utils.ts  # Export filename/metadata helpers (TESTED)
│   ├── infrastructure/
│   │   ├── store.ts         # localStorage persistence + gzip export/import
│   │   └── excel.ts         # Excel import/export (STUB — not implemented)
│   └── presentation/
│       ├── DataContext.tsx  # Global state (Context API + useReducer)
│       ├── Header.tsx       # Nav + undo/redo/reset
│       ├── CalendarView.tsx # Weekly calendar grid
│       ├── MediatorsView.tsx
│       ├── OffersView.tsx
│       ├── AbsencesView.tsx
│       ├── ImportExportView.tsx
│       ├── Modal.tsx        # Generic modal wrapper
│       ├── MediatorModal.tsx
│       ├── OfferModal.tsx
│       ├── SlotModal.tsx
│       ├── SlotDetailModal.tsx
│       ├── AbsenceModal.tsx
│       ├── DemoData.ts      # Demo data seeding
│       └── types.ts         # Presentation-layer types
├── test/                   # Vitest tests
│   ├── models.test.ts
│   ├── store.test.ts
│   ├── history.test.ts
│   ├── export.test.ts
│   ├── overlap.test.ts
│   ├── absence.test.ts
│   ├── slot-origin.test.ts
│   ├── mediator-color.test.ts
│   └── multi-mediator.test.ts
├── js/                     # Old vanilla JS (reference only — not used)
├── docs/
│   ├── business-specs.md
│   ├── architecture.md
│   ├── LEXICON.md
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
