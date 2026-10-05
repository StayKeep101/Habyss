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

## [ERR-20260918-001] UI verification tooling

**Logged**: 2026-09-18
**Priority**: low
**Status**: pending
**Area**: frontend

### Summary
The booted iOS simulator appears as Device Hub, but Computer Use timed out twice
when selecting com.apple.dt.Devices. Native visual verification is unavailable.
Use type-checks, source consistency checks and a native bundle export; do not
claim device screenshots or interaction checks passed.

### Metadata
- Reproducible: yes

## [ERR-20260918-002] UI migration variants

**Logged**: 2026-09-18
**Priority**: low
**Status**: resolved
**Area**: frontend

### Summary
A header migration stopped at the legacy AI screen's plain View wrapper; handled
that wrapper explicitly and type-checked the complete migration. The patch tool
also rejects delete/add operations on the same file in one patch; use update.

## [ERR-20260922-001] validation during habit and auth work

**Logged**: 2026-09-22
**Priority**: low
**Status**: resolved
**Area**: tests

### Summary
Used Node's built-in --env-file after discovering dotenv is not installed. Split a multi-file patch after exact-context verification rejected it; no partial patch was applied. Updated the old profile-failure test to require an actionable failure instead of falsely reporting Community ready. Source checks caught raw font names and React hook lint issues; corrected the font tokens, derived date readiness, and used Reanimated shared-value setters.

### Metadata
- Related Files: lib/socialSignIn.ts, lib/__tests__/account.test.ts, components/Habit/HabitProgressCard.tsx

## [ERR-20260923-001] Pressable with a function style loses its layout

**Logged**: 2026-09-23
**Severity**: high
**Area**: frontend
**Status**: resolved

### What happened
On the habit detail page the three quick-add chips (`+1 +2 +3`) rendered as bare text bunched against the left edge of the card, and the floating view switcher's three segments overlapped into "TodayStatsMusic". Both had `flex: 1` (later `flexGrow: 1, flexBasis: 0`) on a `Pressable` whose `style` was the function form: `style={({ pressed }) => [styles.chip, { opacity: pressed ? 0.7 : 1 }]}`.

### Why it was hard to see
A render test showed the resolved style as correct — `{flex: 1, minHeight: 44, ...}` — so the style object is right; only the device layout disagrees. It cannot be caught by Jest, only on a simulator or device.

### The tell
In the same screen, a `Pressable` with a *static array* style (`[styles.day, {...}]`, the week strip) and a plain `View` with `flex: 1` (the stats row) both distributed correctly. Changing only the function to a static style fixed the switcher, which confirmed it.

### Fix
Never give a `Pressable` a function style when the style carries layout (flex, flexDirection, alignSelf). Use a static array and express the pressed state elsewhere: the haptic, the state change itself, or `TouchableOpacity`, which animates opacity with a static style. Fixed in ViewSwitcher, HabitProgressCard, DetailRow, DetailBar, CreationModal and StreakSuccessModal — the last of which explains an earlier report that the streak card's "Keep going" button looked cut off.

### Related Files
components/Common/ViewSwitcher.tsx, components/Habit/HabitProgressCard.tsx, components/Create/DetailBar.tsx, components/Home/StreakSuccessModal.tsx

## [ERR-20260924-001] A placeholder Apple Pay merchant id can block every other capability

**Logged**: 2026-09-24
**Severity**: high
**Area**: ios
**Status**: resolved

### What happened
Sign in with Apple would not work on device even though the entitlement was present, signing was Automatic and the team was real. Both entitlements files also requested `com.apple.developer.in-app-payments` with `merchant.com.yourcompany.habyss` — a template placeholder, and Apple Pay is not used anywhere in the app.

### Why it matters
Automatic signing builds one provisioning profile covering every entitlement in the file. Xcode can enable most capabilities on an App ID by itself, but it cannot invent a merchant id that does not exist in the team, so profile generation fails — and the run that would have registered Sign in with Apple never gets that far. Simulator builds skip most of this, which is why the app still ran.

### Fix
Removed the unused in-app-payments entitlement from both files. Also corrected `aps-environment` in HabyssRelease.entitlements, which still said `development` while app.json declared `production`: TestFlight and App Store builds would have had no working push.

### Related Files
ios/Habyss/Habyss.entitlements, ios/Habyss/HabyssRelease.entitlements

## [ERR-20260924-002] EAS pod install fails on objectVersion 70

**Logged**: 2026-09-24
**Severity**: high
**Area**: ios
**Status**: resolved

### What happened
Every EAS iOS build died at `pod install` with
`ArgumentError - [Xcodeproj] Unable to find compatibility version string for object version 70`.

### Cause
CocoaPods creates the Pods project using the *app* project's `objectVersion`. `ios/Habyss.xcodeproj/project.pbxproj` had `objectVersion = 70`, and xcodeproj 1.27.0 (bundled with CocoaPods 1.16.2 on the build image) has no entry for 70 in `COMPATIBILITY_VERSION_BY_OBJECT_VERSION` — its Xcode 16 entry is **77**. Any value missing from that table throws, whether or not it is lower than the newest known.

### Why the obvious fix is wrong
The project uses four `PBXFileSystemSynchronizedRootGroup`s (Xcode 16 synchronized folders), which require objectVersion 70 or above, so lowering it to 56 would corrupt the project.

### Fix
`objectVersion = 77` — the value xcodeproj maps to Xcode 16.0, which still supports synchronized folders. Reproduced and verified locally:

```ruby
Xcodeproj::Project.new(path, false, 70)  # ArgumentError, exactly as EAS
Xcodeproj::Project.new(path, false, 77)  # creates fine
```

All three targets and all four synchronized folder refs survive. Note Xcode may rewrite this to 70 when it saves the project, so if EAS starts failing this way again, check this line first.

### Related Files
ios/Habyss.xcodeproj/project.pbxproj

## [ERR-20260925-001] Reachability scan blind to side-effect imports

**Logged**: 2026-09-25
**Priority**: high
**Status**: resolved
**Area**: tooling, dead-code removal

### Summary
An import-graph scan used to find unreachable modules missed bare side-effect
imports, and listed `lib/polyfills.ts` as dead. It is loaded first in
`app/_layout.tsx` and deleting it would have broken startup with no compile
error — `tsc` and the test suite would both have stayed green.

### Error
The scan matched only `from '...'`, `require('...')` and `import('...')`:

    import '@/lib/polyfills';   // Must be first   <- invisible to the scan
    import '@/lib/LocationService';                 <- same

### Resolution
The pattern must also match a bare `^\s*import\s+['"]`. Three rules for any
scan that drives a deletion:

1. Match every import form, side-effect imports included.
2. Resolve by import **path**, never by exported name. `focusHistory` is both a
   module and an unrelated function in `dailyFocus`; `Roadmap` is a type in
   `roadmapPlan` and also the name of a tab; `healthService` shares a prefix
   with the live `HealthKitService`. All three read as "in use" to a name grep
   and as dead to a path scan — the path scan was right each time.
3. Delete a **closed set**. Removing a leaf while leaving a dead file importing
   it breaks the build; every file referencing the set must be inside it.

Recompute the set and delete in one pass. Writing candidates to a temp file and
deleting from it in a second step went wrong twice here: once the file was
stale because a guard had skipped rewriting it, and once `while read` dropped
the last entry for want of a trailing newline.

### Metadata
- Related Files: lib/polyfills.ts, lib/LocationService.ts
- Reproducible: yes

## [ERR-20260929-AUTH] Supabase configuration access

**Logged**: 2026-09-29
**Priority**: medium
**Status**: resolved
**Area**: config

### Summary
The existing Supabase CLI credential cannot read auth configuration (HTTP 403, missing auth_config_read).

### Resolution
Used a public OAuth cancellation round trip to validate the return destination without personal data or account authorization. The owner made the exact dashboard correction; the repeat probe passed. Do not assume a credential used for database work has auth configuration permissions.

## [ERR-20260929-PATCH] Patch generation registry wait

**Logged**: 2026-09-29
**Priority**: low
**Status**: resolved
**Area**: infra

### Summary
patch-package generation stalled while fetching a clean Expo package. Generated focused unified diffs from the inspected original source and verified all patches using patch-package --error-on-fail.

## [ERR-20260929-WIDGET-BUILD] Native validation under workspace sandbox

**Logged**: 2026-09-29
**Priority**: medium
**Status**: pending
**Area**: infra

### Summary
A full Xcode WidgetExtension scheme build also builds the app/watch targets.
The workspace sandbox denied Swift macro plugin sandbox creation
(`sandbox-exec: sandbox_apply: Operation not permitted`), and device access
was unavailable. Do not report this as a successful device build or install.

### Validation available
Passed iOS SDK Swift type-checking for WidgetShared, HabyssWidget and
DashboardWidgets without DEBUG previews; passed the production Swift snapshot
reducer harness using a writable temporary module cache; passed TypeScript
checks and 87 relevant Jest tests. Native installation and visual/tap checks
still require running Habyss from the checked-in Xcode workspace.

### Additional test lesson
A minimal whole-module react-native mock broke Expo/NativeWind setup at
Appearance.getColorScheme. Keep the preset's native mock and mock only the
SharedDefaults bridge for widget service tests.

### Metadata
- Related Files: docs/WIDGETS.md, scripts/check-widget-snapshot.mjs, lib/__tests__/widgetService.test.ts
- Reproducible: yes
