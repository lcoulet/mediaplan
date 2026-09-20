# ADR-0013: Migrate to Vite + React + TypeScript

## Status
Accepted (2026-09-18)

## Context
ADR-0001 chose vanilla JS for the prototype to validate the domain model
and core features. The prototype has proven the model works: models.js,
store.js, history.js, and export-utils.js are tested and stable.

However, app.js has grown to 1329 lines of imperative DOM manipulation
with string interpolation (innerHTML += template strings), manual event
binding, and a global mutable state with renderAll(). Every new feature
added in vanilla JS increases the migration cost.

The most complex features (day planning view with drag-and-drop, work
cycles, Excel import) are not yet implemented. Building them in vanilla
JS would be significantly harder than in React, and would need to be
rewritten during a future migration anyway.

## Decision
Migrate the stack to Vite + React + TypeScript.

- **Vite** as build tool (dev server + production build → dist/)
- **React 18** for declarative UI components
- **TypeScript** for type safety on domain models
- **Vitest** for tests (migrated from node --test)
- **Context API + useReducer** for state management (no external store)
- **CSS kept as-is** (global style.css + calendar.css imported directly)

### Migration scope
- Rewrite app.js as React components (same features, same UI)
- Migrate models.js, store.js, history.js, export-utils.js to TypeScript
- Migrate tests from node --test to vitest
- Add vite.config.ts, tsconfig.json, package.json deps
- Caddy serves dist/ as static files (ADR-0005 updated)

### What does NOT change
- Domain model and business logic (models.js → models.ts)
- localStorage persistence (store.js → store.ts)
- Undo/redo history (history.js → history.ts)
- Export utilities (export-utils.js → export-utils.ts)
- All features and UI behavior — identical to vanilla JS version
- CSS files

### Deployment
- Build runs locally on the server (npm run build → dist/)
- Caddy serves dist/ as static files (server details kept private)
- Preview builds: feature branches get a separate route
- GitHub Actions CI: added to TODO (not blocking local build)

## Consequences
- Supersedes ADR-0001 (vanilla JS) for new development
- TypeScript catches domain model errors at compile time
- React declarative rendering replaces imperative DOM manipulation
- Vitest integrates naturally with Vite
- No external state management library (Context + useReducer sufficient)
- Build step required (no more direct file serving in production)
- Caddy points to dist/ instead of project root (ADR-0005 updated)
