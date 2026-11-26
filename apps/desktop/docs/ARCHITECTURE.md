# Architecture

## Ownership

The persistent Tauri process owns a single native collector and a single SQLite writer. React never observes foreground apps or maintains the canonical activity clock. The dashboard and tray panel query the same service. Their one-second display timers only render declared focus elapsed time; activity updates come from native observations.

`apps/desktop/src-tauri/src/engine.rs` is a dependency-free portable state machine. It consumes UTC/monotonic samples and emits completed spans plus optional retroactive idle trimming. `storage.rs` owns SQL and migration execution. `service.rs` coordinates engine proposals, storage commits, settings, privacy filtering, recovery and widget publication. Failed transactions do not commit the proposed state-machine transition.

`platform.rs` defines `ActivityCollector`; its only implementation is macOS. `native/Collector.swift` owns NSWorkspace and AX observation on the main run loop. A C callback copies JSON into a Rust channel; one worker processes samples. The future Windows adapter must provide the same event semantics. Unsupported platforms fail explicitly at compile time.

`commands.rs` exposes bounded, typed commands to the local WebViews. The UI uses React state and pure analytics functions; no duplicate database exists in JavaScript. Dates are converted to UTC range boundaries using the user's local calendar, rather than assuming every day lasts 24 hours. Focus overlaps are intersections with recorded active intervals.

## Storage

Migration: `apps/desktop/src-tauri/migrations/001_initial.sql`.

SQLite enables foreign keys, WAL, FULL synchronous durability, a busy timeout and secure deletion. Intervals carry UUIDs, UTC millisecond boundaries, source and metadata availability. Applications have stable UUIDs and unique bundle identifiers. Categories support manual overrides. Focus and settings use separate tables. The checkpoint identifies the current persisted interval and last observed time. Newer unknown schema versions are rejected.

A heartbeat rewrites one open interval every 15 seconds, while meaningful transitions commit immediately. No row-per-second event stream is stored. On restart, the last committed endpoint is final; unknown downtime remains a gap. Running focus sessions recover as interrupted at the last checkpoint. An OS file lock rejects a competing writer even before UI startup is complete.

## Native surfaces

The tray uses Tauri 2's template icon and opens a separate compact WebView. Dashboard close is intercepted as hide. Explicit Quit flushes the observed interval and ends the process. The official autostart plugin manages opt-in login startup.

WidgetKit is a real Xcode app-extension target, not a web card. Its provider reads an atomic JSON snapshot from an entitled App Group. It never opens SQLite. Widgets label the snapshot timestamp and do not pretend to offer unrestricted live updates. Deep links select Dashboard or Focus.

## Security boundary

CSP confines content to the bundled application. Capabilities grant core window/event and autostart operations, with no arbitrary shell or network plugin. Native commands expose specific application operations. Window-title collection is off by default. Exclusions are applied before activity reaches the database or UI. Sensitive metadata is never intentionally included in diagnostic logging.

## Dependency versions

Exact resolved dependencies are committed in `bun.lock` and `apps/desktop/src-tauri/Cargo.lock`. This build resolved Tauri 2.12.5, Vite 7.3.7, Vitest 3.2.7, rusqlite 0.38, and the Tauri 2 official plugin families. macOS deployment target is 14.0. Official Tauri v2 tray, single-instance, autostart and bundle configuration documentation, and Apple WidgetKit documentation informed the integrations.

## Current limitations

The Swift adapter uses a narrow FFI boundary with one process-lifetime callback registration. UI screens, shared controls and charts are separated under `src/screens` and `src/components`. Built-in charts use accessible DOM/SVG rather than a large chart runtime. Application badges use initials, not extracted system application icons. No browser URL tracking is claimed.
