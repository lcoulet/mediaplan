# ADR-0003: TDD with Node.js built-in test runner

## Status
Accepted (2026-09-13)

## Context
The project needs automated tests with strict TDD discipline (RED-GREEN-REFACTOR).
No test framework was installed. Options: Jest, Vitest, Mocha, Node built-in.

Alternatives considered:
- Jest: industry standard but requires dependency and config
- Vitest: modern, fast, but tied to Vite ecosystem (no build tool yet)
- Mocha: mature but needs assertion library separately

## Decision
Use Node.js built-in test runner (`node --test test/`) with `node:test` and
`node:assert/strict`. No dependencies, no config, works with vanilla ES modules.

## Consequences
- Zero install — works with Node.js >= 18
- Tests run in Node (no DOM) — business logic must be in pure modules
  (models.js, store.js, history.js), not in app.js
- DOM-dependent code (app.js) is not directly testable without a browser
  environment (jsdom or Playwright) — future work
- 61 tests pass as of this ADR
