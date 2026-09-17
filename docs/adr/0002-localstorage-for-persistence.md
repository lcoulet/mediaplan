# ADR-0002: localStorage for data persistence

## Status
Accepted (2026-09-13)

## Context
The app must work without a backend. All data stays in the browser.
Two browser storage options: localStorage (~5-10 MB, synchronous, string only)
and IndexedDB (near-unlimited, async, structured objects, complex API).

Alternatives considered:
- IndexedDB: handles larger datasets, async, queryable
- Cookies: too small (4 KB), sent with every request
- File System API: limited browser support

## Decision
Use localStorage for the first version. Key: `mediaplan_data_v1`.
Wrap all storage access behind a store.js module (load/save interface)
so the persistence layer can be swapped without touching business logic.

## Consequences
- Risk of saturation if data exceeds ~5-10 MB (estimated: 200+ offers/year
  with dozens of mediators could approach this)
- Synchronous reads block the main thread (negligible at current scale)
- No indexing or querying — all data loaded at once
- Migration path to IndexedDB or a backend API is preserved via store.js
  abstraction
- Data versioning (`_v1` suffix) allows schema migration if the model evolves
