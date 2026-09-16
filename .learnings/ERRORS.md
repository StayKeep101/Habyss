# Errors

## [ERR-20260916-001] Jest dynamic imports

**Logged**: 2026-09-16
**Priority**: low
**Status**: resolved
**Area**: tests

### Summary
The Expo Jest preset leaves dynamic imports untransformed in this project.

### Error
`A dynamic import callback was invoked without --experimental-vm-modules`

### Resolution
The notification/location services use typed, deferred `require` for SQLite,
consistent with the existing geofence refresh. This preserves the lazy load
needed to avoid the persistence/service dependency cycle and allows native
integration mocks to work without changing the global Babel configuration.

### Metadata
- Related Files: lib/notificationService.ts, lib/LocationService.ts
- Reproducible: yes

## [ERR-20260916-002] Process inventory sandbox restriction

**Logged**: 2026-09-16
**Priority**: low
**Status**: resolved
**Area**: infra

### Summary
`ps` is unavailable inside this restricted workspace. Retain test session IDs
and poll those directly; after a lost transcript, rerun bounded verification.

### Error
`zsh: operation not permitted: ps`

### Resolution
No process access was needed; reran the verification commands with retained
session IDs. Do not request broader permissions for this optional diagnostic.
