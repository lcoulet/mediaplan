# Architecture & Deployment — MediaPlan

## Current Architecture (v1)

### Type

Frontend-only web application. No backend, no database server.

### Runtime

- Runs entirely in the browser
- Built with Vite + React 18 + TypeScript
- Data persisted in `localStorage` (~5-10 MB limit per origin)
- Application works offline once loaded
- State management via Context API + useReducer (no external store)

### Architecture Layers (DDD-inspired)

- **Domain** (`src/domain/`): Pure logic, no browser APIs. Entities, factory
  functions, business rules (overlap detection, availability, labels).
  Fully unit-tested.
- **Infrastructure** (`src/infrastructure/`): Side-effectful code. localStorage
  persistence, gzip export/import, Excel stub. Uses browser APIs.
- **Presentation** (`src/presentation/`): React components. UI glue. State
  managed via Context API + useReducer. Not unit-tested (logic extracted to
  domain when testable).

### Browser Compatibility

Modern browsers only: Chrome, Firefox, Edge, Safari.

### Serving

- Production: Caddy serves `dist/` as static files
- Dev: Vite dev server (`npm run dev` → http://localhost:5173)
- HTTPS via Let's Encrypt (automatic via Caddy)
- Domain: `mediaplan.coulet.me`

### Dependencies

- **Vite** — build tool and dev server
- **React 18** — UI framework
- **TypeScript** — type safety
- **Vitest** — test runner
- [SheetJS](https://sheetjs.com/) — Excel import/export (planned, not yet integrated)

### Build & Deploy

- Build: `npm run build` → `dist/`
- Deploy: Caddy serves `dist/` as static files (server details kept private)
- Preview builds: feature branches get a separate Caddy route (details kept private)
- GitHub Actions CI: planned (tests on push, preview builds) — see TODO.md

## Future Architecture (v2+)

### Server-Based Evolution

- Migration to a server-based architecture (REST API)
- Persistent database (PostgreSQL or similar)
- User authentication (roles: admin, coordinator, mediator)
- Real-time multi-device synchronization
- Client-side encryption (envelope encryption — see ADR-0012)

### Additional Features (Server-Dependent)

- Notifications (email, push) for assignments
- Leave and availability management for mediators
- Statistics and dashboards

## Deployment Environment

Deployment infrastructure details (VPS host, IP address, Caddy version and
paths) are kept private by the maintainer and are **not** stored in this
public repository.

### GitHub

- Repository: https://github.com/lcoulet/mediaplan
- Branch: `main`
- License: MIT
