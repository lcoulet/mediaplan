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
Use Caddy v2.6.4. Reverse proxy from mediaplan.coulet.me to localhost:8000
(Python http.server). Caddy handles Let's Encrypt automatically.

## Consequences
- Zero-config HTTPS — Caddy provisions and renews certificates
- Caddyfile.d snippet at /etc/caddy/Caddyfile.d/hermes-dashboards.caddyfile
- Python http.server is a dev server — not production-grade. Should be
  replaced by Caddy serving static files directly (root directive) or
  a proper build output (dist/) once a build system is added
- If the VPS restarts, Python server must be restarted manually
  (no systemd service yet)
