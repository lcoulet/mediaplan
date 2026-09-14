# MediPlan — Mediation Scheduling for the Museum of Toulouse

## Overview

MediPlan is a web application for managing mediation schedules at the Museum of
Toulouse. It allows coordinators to plan mediators, manage reservations, and
import/export data in Excel format.

The application is **frontend-only** (no backend). Data is stored in the
browser's `localStorage`. A future evolution to a server-based architecture is
planned.

## Features

- Manage mediators (add, edit, delete)
- Create and edit schedules
- Manage reservations
- Import/export data in Excel format (.xlsx)
- Data persistence via `localStorage`

## Tech Stack

- HTML5 / CSS3 / JavaScript (ES modules)
- [SheetJS](https://sheetjs.com/) for Excel import/export
- No framework, no build tool — vanilla application
- Data in `localStorage`

## Project Structure

```
mediaplan/
├── index.html              # Entry point
├── css/
│   └── style.css           # Styles
├── js/
│   ├── app.js              # Main logic
│   ├── store.js            # localStorage management
│   ├── models.js           # Data models
│   └── excel.js            # Excel import/export
├── docs/
│   └── specs.md            # Detailed specifications
├── LICENSE                 # MIT License
└── README.md               # This file
```

## Getting Started

Open `index.html` in a browser. No installation required.

To serve locally (optional):

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## License

[MIT](LICENSE) — © 2026 Loic Coulet
