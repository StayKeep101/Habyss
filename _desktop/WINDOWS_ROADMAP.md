# Windows adapter roadmap

Windows is not implemented or advertised as supported in this release.

Keep `engine.rs`, schema/migrations, repository logic, settings, privacy filtering, focus overlap analytics and the frontend shared. Replace the platform collector with a Windows module behind `cfg(target_os = "windows")`, implementing ActivityCollector and emitting equivalent typed samples.

Use SetWinEventHook for foreground/window changes, GetForegroundWindow plus process/package identity APIs, GetLastInputInfo with wrap-safe arithmetic, and supported session/power notifications for lock, logout, suspend and resume. Use a monotonic clock and preserve the conservative unknown-gap rules. Never poll or observe system activity from JavaScript. Handle elevated processes, protected windows and unavailable titles as explicit metadata limitations.

Replace macOS App Group/WidgetKit publication with a separately designed Windows surface if requested; do not fake WidgetKit parity. Configure Windows tray positioning, startup, single-instance transport, installer signing and permissions. Use stable application identity rather than PID as the canonical app key.

Add Windows native integration tests for rapid switches, UAC/elevation, session lock, sleep, multiple monitors, DPI changes and startup. Re-run the shared deterministic engine/database tests unchanged. Remove the current unsupported-platform compile error only when a real adapter exists.
