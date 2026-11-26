# macOS integration

## Collector and permissions

The Swift bridge links AppKit, ApplicationServices, CoreGraphics, Foundation and WidgetKit into the Tauri binary. It observes NSWorkspace app activation, sleep/wake, display sleep/wake and session activation. Lock-state reconciliation also consults the CoreGraphics session dictionary. Distributed lock notifications are supplementary; delivery is OS-dependent and requires installed-app testing.

Accessibility is requested only after the user's action through AXIsProcessTrustedWithOptions. App-level observation does not require that permission. Granting permission is rechecked during reconciliation. Window titles remain opt-in even when permission is available. No Screen Recording permission is requested. The Settings link opens Privacy & Security → Accessibility.

## Background and menu bar

Closing the dashboard hides it. The process, collector and tray remain running. The tray panel closes on focus loss. Its controls use the same service as the main window. Positioning uses the tray rectangle and monitor bounds; mixed-DPI/multiple-display behavior remains a native acceptance item. Right-click provides dashboard, settings and explicit quit.

Login startup uses tauri-plugin-autostart's LaunchAgent mechanism and an `--autostart` argument. The launch setting is read back from the actual plugin state, not shown as successful before the OS operation returns.

## Widget build and signing

`native/widgets/HabyssWidgets.xcodeproj` builds two real WidgetKit configurations: small Today and medium Focus. `scripts/build-widgets.sh` compiles the unsigned `.appex`. Tauri's macOS files mapping embeds it at `Contents/PlugIns/HabyssWidgets.appex` before app bundling.

For a signed build, create a team-owned macOS App Group, conventionally `TEAMID.com.habyss.shared`, and enable it for the host and extension identifiers. Provision these identifiers through the Apple Developer account as required for your distribution method. Set:

```sh
export HABYSS_TEAM_ID=YOURTEAMID
export HABYSS_SIGN_IDENTITY='Developer ID Application: Your Name (YOURTEAMID)'
export HABYSS_APP_GROUP=YOURTEAMID.com.habyss.shared
sh scripts/sign-release.sh
```

The script writes matching App Group identifiers into host/extension Info.plists, generates matching entitlements, signs the extension first and host second, then verifies signatures. Widget sandbox entitlement is enabled; the host remains unsandboxed for native tracking. Real provisioning, installed container access and widget discovery still require verification with your team. The script is not evidence of successful signing or notarization.

The publisher uses FileManager's App Group container lookup, writes JSON atomically and requests budgeted WidgetKit reloads. Without a configured entitled group it returns unavailable; it never substitutes an insecure shared path. Widgets show snapshot times, empty states and paused states. Prior-day snapshots become empty rather than mislabeled today totals. Deep links use the `habyss` scheme.

## Release and notarization

The development `.app` can be built without a paid identity. Widget access cannot be certified by that fact. Before public distribution: sign with hardened runtime, submit the signed artifact with `xcrun notarytool`, wait for acceptance, staple the ticket, verify with `spctl`, and test a freshly installed copy. Rebuild a DMG after signing; an earlier DMG contains the pre-signing app.

If the environment cannot create disk images, distribute a development `.app` locally for testing and create the DMG later from an unrestricted developer terminal. Do not label unsigned development packages as notarized.

## Native acceptance checklist

Launch the packaged app, complete onboarding, switch Safari → Finder → editor → Safari, verify bundle names and durations, optionally allow titles, switch windows within one app, wait for idle then resume, lock/unlock, sleep/wake, close/reopen the dashboard, pause/resume, quit/relaunch, export data and verify persistence. Confirm all inactive periods are not credited as active. Test denied/revoked Accessibility and exclusions separately.

Install the signed app and test both widgets in the system picker. Verify empty, paused, active snapshot and relaunched-app states; deep links; multiple displays; login startup; and release CPU/RSS during a realistic session. These steps are not replaced by compilation.
