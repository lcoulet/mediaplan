# TODO — MediaPlan

## Build System & Release

- [ ] Set up a build system (esbuild or Rollup) to bundle the app
- [ ] Download SheetJS (xlsx) as a build dependency (not committed to git)
- [ ] Generate a `dist/` folder with bundled assets for production
- [ ] Add app versioning (semantic version, displayed in UI footer)
- [ ] Create a release script (tag + build + GitHub release via `gh`)
- [ ] Add version number to `package.json` and inject into the app at build time

## Excel Import/Export

- [ ] Implement Excel export (.xlsx) using SheetJS
  - Export schedule (one tab per week or per entity)
  - Export mediator list and their assignments
- [ ] Implement Excel import using SheetJS
  - Configurable column mapping
  - Support Secutix export format
  - Support internal coordination files format
- [ ] Obtain sample files (Secutix + coordination) to define column mappings

## Testing

- [ ] Extract logic from `app.js` into testable modules (calendar logic, CRUD, filters)
- [ ] Write tests for extracted modules (TDD)
- [ ] Add DOM/UI tests (jsdom or similar)
- [ ] Set up CI to run tests on push (GitHub Actions)

## Deployment

- [ ] Prepare Caddyfile for `museum.31.70.143.152.nip.io` (HTTPS auto)
- [ ] User runs: enable Caddy service, open ports 80/443
- [ ] Serve `dist/` folder via Caddy static file server

## Features (Future)

- [ ] Calendar views: day / week / month toggle in the planning view
- [ ] Drag & drop on calendar to move slots
- [ ] Schedule entity management (create/edit/delete schedules as distinct objects)
- [ ] Conflict detection: warn when assigning a mediator to overlapping slots
- [ ] Statistics and dashboards (v2+)
