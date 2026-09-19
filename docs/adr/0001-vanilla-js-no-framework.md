# ADR-0001: Vanilla JavaScript (no framework)

## Status
Accepted (2026-09-13)

## Context
MediaPlan is a frontend-only app for managing museum mediation schedules.
The initial requirement was to build a working prototype quickly, with no
backend, data in localStorage, and Excel import/export.

Alternatives considered:
- React/Vue/Svelte + Vite: more structure, but heavier setup and learning curve
  for a prototype phase
- jQuery: outdated, no ES modules

## Decision
Use vanilla JavaScript with ES modules. No framework, no build tool for now.
The project can migrate to Vite + React + TypeScript later if complexity grows.

## Consequences
- No build step needed — files served directly
- Full control over the code, no framework abstraction
- Manual state management (no React hooks/Vue reactivity)
- Migration to a framework later will require refactoring app.js
- All logic kept in testable modules (models.js, store.js, history.js) to
  ease future migration
