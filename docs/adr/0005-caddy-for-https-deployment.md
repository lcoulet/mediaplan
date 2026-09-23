# ADR-0005: Caddy for HTTPS deployment

## Status
Accepted (2026-09-14)

## Context
The app needs to be served over HTTPS on a private VPS (host details kept
outside this repository).
Domain: mediaplan.coulet.me. The browser restricts localStorage/IndexedDB
on non-HTTPS origins (except localhost).

Alternatives considered:
- Nginx: standard, well-documented, but manual HTTPS cert management
  (certbot + renewal cron)
- Apache: heavier config, same HTTPS overhead
- Cloudflare Tunnel: no open ports, but external dependency

## Decision
Use Caddy to serve static files directly from the project root
(`root` directive). No Python http.server in production — Caddy handles
both HTTPS and static file serving. Let's Encrypt is automatic.
(Deployment host details are kept private, outside this repository.)

In dev, Caddy can also be used (same config, or `caddy file-server`).

## Consequences
- Zero-config HTTPS — Caddy provisions and renews certificates
- No Python http.server in production — eliminates the need for a systemd
  service to keep it running
- Caddy's own systemd service handles restarts automatically
- Once a build system (Vite) is added, point Caddy's root to dist/
