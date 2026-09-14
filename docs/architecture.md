# Architecture & Deployment — MediaPlan

## Current Architecture (v1)

### Type

Frontend-only web application. No backend, no database server.

### Runtime

- Runs entirely in the browser
- Vanilla JavaScript (ES modules)
- No framework, no build tool
- Data persisted in `localStorage` (~5-10 MB limit per origin)
- Application works offline once loaded

### Browser Compatibility

Modern browsers only: Chrome, Firefox, Edge, Safari.

### Serving

- Served by Caddy (reverse proxy / static file server)
- HTTPS via Let's Encrypt (automatic)
- Domain: `museum.31.70.143.152.nip.io` (nip.io wildcard DNS)

### Dependencies

- [SheetJS](https://sheetjs.com/) — Excel import/export (loaded via CDN or
  bundled locally)

## Future Architecture (v2+)

### Server-Based Evolution

- Migration to a server-based architecture (REST API)
- Persistent database (PostgreSQL or similar)
- User authentication (roles: admin, coordinator, mediator)
- Real-time multi-device synchronization

### Additional Features (Server-Dependent)

- Notifications (email, push) for assignments
- Leave and availability management for mediators
- Statistics and dashboards

## Deployment Environment

### VPS

- Host: Linux (RHEL / Rocky Linux)
- Public IP: `31.70.143.152`
- Caddy installed (`/usr/bin/caddy`, v2.6.4)
- Service: systemd (currently inactive — to be enabled)

### GitHub

- Repository: https://github.com/lcoulet/mediaplan
- Branch: `main`
- License: MIT
