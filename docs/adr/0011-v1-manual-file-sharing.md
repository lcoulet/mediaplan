# ADR-0011: V1 manual sharing via file export/import

## Status
Accepted (2026-09-17)

## Context
Multiple coordinators on different workstations need to share planning
data. The app cannot be deployed on the museum's internal IT system (SI).
No server-side sync is feasible for V1. A simple, manual approach is
needed.

## Decision
V1 uses manual file-based sharing. The coordinator exports the full
database as a compressed JSON file (.json.gz) with the last modification
timestamp in the filename (e.g. `mediaplan_2026-09-17_1430.json.gz`).
The file is shared via a shared filesystem (USB, network share, cloud
drive). Another coordinator imports the file to replace or merge their
local data.

No server-side sync, no encryption, no conflict resolution in V1.
The coordinator manually checks file timestamps to determine which
version is newer.

## Consequences
- Simple, no infrastructure needed beyond the shared filesystem
- No real-time collaboration — coordinators must coordinate out-of-band
- Risk of data loss if two coordinators export simultaneously and
  someone imports the older file
- Export must include last-modified timestamp in the filename and in
  the file metadata
- V2 will replace this with a server using client-side encryption and
  versioning (see ADR-0012)
- Current export format (`mediaplan_backup_YYYY-MM-DD.json`) must be
  updated to `mediaplan_YYYY-MM-DD_HHMM.json.gz`
