# ADR-0005: Caddy for HTTPS deployment

## Status
Accepted (2026-09-14)

## Context
The app needs to be served over HTTPS on a VPS (Rocky Linux 9).
Domain: mediaplan.coulet.me. The browser restricts localStorage/IndexedDB
on non-HTTPS origins (except localhost).

Alternatives considered:
- Nginx: standard, well-documented, but manual HTTPS cert management
  (certbot + renewal cron)
- Apache: heavier config, same HTTPS overhead
- Cloudflare Tunnel: no open ports, but external dependency

## Decision
Use Caddy v2.6.4 to serve static files directly from the project root
(`root` directive). No Python http.server in production — Caddy handles
both HTTPS and static file serving. Let's Encrypt is automatic.

In dev, Caddy can also be used (same config, or `caddy file-server`).

## Consequences
- Zero-config HTTPS — Caddy provisions and renews certificates
- Caddyfile.d snippet at /etc/caddy/Caddyfile.d/hermes-dashboards.caddyfile
- No Python http.server in production — eliminates the need for a systemd
  service to keep it running
- Caddy's own systemd service handles restarts automatically
- Once a build system (Vite) is added, point Caddy's root to dist/
