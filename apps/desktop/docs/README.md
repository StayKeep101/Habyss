# Habyss Desktop

Local-first macOS activity tracking with a Tauri 2 shell, React/TypeScript UI, Rust accounting and SQLite storage, a Swift/AppKit/Accessibility collector, and a native WidgetKit extension.

**Development build, not a public release.** See [TEST_REPORT.md](TEST_REPORT.md) for executed checks and outstanding native verification. No mock activity is inserted in production. The separate Habyss Mobile repository is untouched.

## Requirements

- macOS 14+, Xcode with command-line tools, Rust stable, Bun (Node 22+ also supported by the frontend)
- Accessibility permission is optional; app-level tracking works without window metadata
- Apple Developer signing identity and a team-owned App Group for installed widgets

## Run

```sh
bun install --frozen-lockfile
# On this development machine, expose the existing Rust installation:
. scripts/env.sh
bun run tauri dev
```

Run from `apps/desktop` (or `npm run desktop` from the top of the Habyss repo). Complete onboarding to enable tracking. Closing the dashboard hides it; the menu-bar icon keeps the app accessible. Quit from the menu bar to end monitoring. Start at Login is opt-in.

## Build

```sh
. scripts/env.sh
bun run tauri build --bundles app
# Also build a DMG on a machine with disk-image creation available:
bun run tauri build --bundles app,dmg
# From the top of the repo: npm run desktop:build, npm run desktop:dmg
```

A local development copy is also available at `artifacts/release/Habyss.app` with a ZIP alongside it. Quit an earlier running Habyss before opening this copy.

The build compiles the native widget extension before packaging it in `Habyss.app/Contents/PlugIns`. Output: `apps/desktop/src-tauri/target/release/bundle/macos/Habyss.app`; DMG output, when supported, is in the sibling `dmg` directory. For offline builds after dependencies have been downloaded, set `CARGO_NET_OFFLINE=true`.

Unsigned/ad-hoc builds do **not** establish App Group access or prove widget-picker availability. See [MACOS_INTEGRATION.md](MACOS_INTEGRATION.md) and `scripts/sign-release.sh` for signing. Do not distribute this development artifact as notarized software.

## Checks

```sh
bun run check
bun run test
cargo test --manifest-path src-tauri/Cargo.toml
sh scripts/check.sh # also requires rustfmt and Clippy
```

Dependency-free accounting tests can also run with `rustc --edition=2021 --test src-tauri/src/engine.rs -o /tmp/habyss-engine-tests` followed by `/tmp/habyss-engine-tests`.

## Data and controls

SQLite lives under macOS Application Support in Tauri's app data directory for `com.habyss.desktop`, never in the app bundle. Settings displays the exact path. History is local, with WAL transactions and a single-writer file lock. Pause, title collection, bundle exclusions, regex title exclusions, retention, export and deletion are in Settings. There is no account, cloud client, telemetry SDK, screenshot capture, key logger, or browser URL inference.

## Documentation

- [Architecture](ARCHITECTURE.md)
- [Tracking engine](TRACKING_ENGINE.md)
- [macOS integration and signing](MACOS_INTEGRATION.md)
- [Windows roadmap](WINDOWS_ROADMAP.md)
- [Future synchronization](SYNC_ARCHITECTURE.md)
- [Verification report](TEST_REPORT.md)
