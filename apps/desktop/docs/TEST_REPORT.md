# Verification report

Updated 2026-10-30. This is a working macOS development build, **not a claim that every MVP acceptance criterion or public-distribution requirement is complete**.

## Environment

Apple Silicon Mac, macOS 27.0, Xcode 27.1 / Swift 6.4, Rust 1.99.1. Bun dependencies and Rust crates were installed manually by the user after this execution environment blocked registry connections. Exact dependency resolutions are in the committed lockfiles.

## Executed automated checks

| Check | Actual result |
| --- | --- |
| TypeScript strict check | Passed |
| ESLint | Passed |
| Vitest analytics | 5 tests passed |
| Rust engine/storage/service | 21 tests passed |
| Production Vite build | Passed |
| Native Swift collector compilation/link | Passed |
| WidgetKit Xcode Release build | Passed, unsigned |
| Tauri macOS Release `.app` | Passed |
| Widget extension embedded in `.app` | Confirmed under Contents/PlugIns |
| Local ad-hoc host/extension signature verification | Passed `codesign --verify --deep --strict` |
| Rustfmt | Blocked: component absent from active toolchain at last attempt |
| Clippy | Blocked: component absent from active toolchain at last attempt |
| DMG | Attempted; failed because `hdiutil create` returned Device not configured |

The Rust tests cover transitions, duplicates, title metadata changes/unavailability, idle backdating across application changes, pause/resume, startup while idle, lock transitions, long observation gaps, forward/backward wall-clock changes, UTC range clipping, midnight crossing, no-overlap event sequences, migrations/rejected future schemas, transaction rollback, checkpoint recovery, competing writer locks, history deletion, title preference enforcement, exclusion privacy, and competing/stopped focus sessions. Frontend tests cover clipping, calendar boundaries, declared-vs-observed focus, application switch semantics and continuous active stretches. Synthetic activity exists only in tests.

The release toolchain emitted warnings because rust-objcopy could not locate libLLVM while stripping debug information. Compilation and packaging nevertheless finished successfully. The toolchain-local library fallback in `scripts/env.sh` fixes the missing-library lookup; `rust-objcopy --version` was verified with that fallback. Rustfmt/Clippy must still be installed and executed; the CI workflow is configured but was not run remotely.

## Native evidence actually obtained

- The user confirmed the corrected packaged app opens in Finder.
- The user completed the requested browser/Finder/editor switching workflow, closed the dashboard, used another app, and reopened the dashboard from the menu bar.
- Read-only SQLite inspection on October 30 found real application records for 20 distinct applications, 188 active intervals, 18 idle intervals and 7 locked intervals at that observation. Counts naturally increase while tracking runs. No window titles were read during inspection.
- Database `PRAGMA integrity_check` returned `ok`; a pairwise interval query found **zero overlaps**.
- Persisted history survived the user's quit/relaunch between development builds.
- The application remained in app-level operation while Accessibility was denied; recorded metadata correctly says `permission_denied`.
- The earlier first development binary used an incorrect CoreGraphics event-type constant for idle detection. This was corrected to `kCGAnyInputEventType` (`UInt32.max`) using Apple's installed SDK header. Subsequent real active intervals were observed. Early development idle records were preserved, not silently deleted; those early totals should not be treated as validated activity history.

These are user-assisted native checks and database observations, not automated UI end-to-end tests. The computer-use native connection repeatedly failed to start. Launch requests from the restricted tool later returned a LaunchServices error, while the user confirmed the same packaged app opens normally in Finder. Process enumeration was also unavailable.

## Implemented but still unverified on the installed app

- Window title/AX window change collection after Accessibility is granted; permission revocation/regrant behavior across signing changes.
- Exact real-time lock boundaries and a controlled sleep/wake test. Locked intervals exist, but no independent ground-truth sleep timing was captured.
- Native export Save dialog, exported file contents, and cancelled-save behavior after the latest update.
- Focus start/stop controls and timing through a complete user-driven session; underlying model and overlap calculations are tested.
- Launch at Login after actual logout/login; multiple-monitor positioning and mixed DPI.
- UI deletion of existing user history. The SQL path was tested only with disposable temporary databases; real history was not deleted.
- Performance under realistic release use. CPU/RSS were not measured; no numeric efficiency claim is made.
- Visual and keyboard-accessibility acceptance across all screens. TypeScript/lint success is not a visual review.

## Widget status

Both Today and Focus are real native WidgetKit layouts in an Xcode extension target. The extension compiles and is embedded. It uses read-only App Group snapshots, snapshot timestamps, empty/paused states, and deep links. It does not open SQLite or promise second-by-second live refresh.

No valid Apple signing identity was available. Consequently, **signed App Group access, widget-picker discovery, placement, refresh, deep-link interaction and persistence after relaunch remain unverified**. Ad-hoc signature verification does not establish these capabilities. See MACOS_INTEGRATION.md for the team/App Group signing steps.

## Public release gates / known limitations

1. Install and run Rustfmt and Clippy; address any findings; execute CI.
2. Complete the native acceptance checklist, including controlled sleep/wake, permissions, export, focus and login startup.
3. Configure the actual Apple Developer team, App Group and signing/provisioning; test installed widgets.
4. Profile release CPU/RSS and verify multi-display behavior.
5. Produce a signed/notarized artifact and DMG on a machine where disk-image creation is supported.
6. App list currently uses initials as badges rather than extracted native app icons. Focus pause/resume and optional tray text timers are not implemented. Browser URLs and Windows support are intentionally not claimed.
7. Declared focus uses wall-clock session boundaries; its label does not assert attention, and wall-clock changes can affect declared duration. Active-computer overlap is the evidence-based metric.

## Reproduction

Commands and artifact paths are in README.md. Logs from this execution are in `.build/rust-test.log`, `.build/app-build.log`, `.build/widget-build.log`, and `.build/release-build.log` (ignored build artifacts). Run `sh scripts/check.sh` once the full toolchain components are available.
