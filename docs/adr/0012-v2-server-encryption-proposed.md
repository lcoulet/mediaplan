# ADR-0012: V2 server with client-side encryption (proposed)

## Status
Proposed (2026-09-17)

## Context
V1 manual file sharing does not scale for multiple coordinators with
intermittent connections. A server is needed to store and synchronize
data, but the server is hosted outside the museum's SI and must not
see data in clear text (RGPD, security). Mediator names should not be
stored server-side — only IDs.

## Decision (proposed, subject to revision)
Use envelope encryption:
- Data encrypted with a symmetric content key (AES-GCM)
- Content key encrypted with each coordinator's public key (RSA-OAEP)
- Server stores N encrypted copies of the content key (one per
  coordinator) plus the encrypted data blob
- Each coordinator has a key pair (generated via WebCrypto API, stored
  in browser/local keystore)
- Coordinator identification via digital signatures

Conflict resolution: versioning with metadata in clear text (entity ID,
version, timestamp). On sync, if server has a newer version, alert the
coordinator with timestamps and let them choose (V2). Visual diff in V3.

## Consequences
- Server is a dumb encrypted blob store — no business logic server-side
- Adding a coordinator: encrypt content key with their public key
- Removing a coordinator: delete their key copy + rotate content key
- Key management is the main complexity — generation, storage,
  distribution of public keys
- This ADR is proposed, not final. More information may lead to a
  different approach (e.g. shared secret, CRDT, or other). Will be
  superseded if a better approach is identified.
