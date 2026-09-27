# Widgets, Echo, Live Activities and Apple sign-in

Verified on September 26, 2026.

## Apple sign-in

The native Expo sheet exchanges its identity token with Supabase. Apple receives the SHA-256 nonce and Supabase receives the original nonce. The live project answered HTTP 200: Apple is enabled, `com.habyss.app` is accepted, and nonce verification is enabled. No provider settings were changed.

First-authorization names now reach Supabase through `auth.updateUser`. Null names on later sign-ins do not overwrite metadata. A failed exchange or metadata upload keeps the name in SecureStore for the same Apple user, ready for a subsequent sign-in. Successful upload or account cleanup removes it. That record contains no tokens.

Local greetings change only after successful token validation; existing nicknames are preserved. Verified metadata can restore a greeting on another device. Cancellation is quiet and duplicate taps share one request. Debug/release entitlements, the Expo plugin, `usesAppleSignIn`, and mixed-localization configuration are present. Native sign-in does not depend on a web client secret.

Physical Apple Account authorization, Face ID and signed-device provisioning were **not exercised**. Simulator compilation and mocked exchanges cannot prove that end-to-end result.

## Widgets

The gallery offers Daily Tasks, Habit Heatmap and Goals Progress in small and medium sizes.

- Tasks follow the app's due/overdue/undated rules. Full totals remain accurate when only twelve rows are cached. Completing a row reveals unfinished work; completed overdue tasks disappear from future days.
- Heatmaps account for schedules, skips and archived habits, showing 49 or 91 days.
- Goal progress uses the app's calculation and selected colors. Task check-ins immediately update linked goal contributions.
- One versioned snapshot keeps related data together. Eight days of task timelines are prepared and replenished by the app. iOS controls refresh timing.
- Separate durable tap records preserve dates, retries and undo. SQLite commits precede acknowledgement. The shared completion intent is compiled into both native targets and can cancel notifications/end its matching card without opening the foreground UI.
- Sign-out/deletion clears snapshots, queued actions, reminders, Live Activities and pending Apple profile data. Background mirrors pause during cleanup.

## Echo Alive

Enable Echo Alive in notification settings for timed habits and tasks. It sends personality-specific encouragement ten minutes before the start, plus an optional single follow-up fifteen minutes after the planned session ends if still unchecked. An unspecified duration defaults to thirty minutes.

The wording refers to missing check-ins, not assumed real-world behavior. Actions offer Mark done and In 15 minutes. Completing, skipping, deleting or rescheduling updates the pending plan. Master settings, habit reminder preferences and Echo's awake window are respected. Echo replaces ordinary reminders for covered timed items and uses curated personality wording without requiring a model download.

The shared notification budget is 56, reserving capacity for other notifications. Echo plans seven days ahead and replenishes when the app opens or data changes; it is not an unlimited background scheduler.

## Scheduled Live Activities

iOS 26+ uses native scheduled starts. Older supported iOS versions start cards while Habyss is in the foreground. Up to four upcoming cards are reconciled, replenishing on activation, edits and each foreground minute. iOS can impose additional limits.

Cards use scheduled times/durations and the app or habit accent. Completion removes matching cards. At the planned end, a card becomes stale and invites a check-in; iOS controls eventual removal when the app is closed. Explicit focus timers continue through the existing focus service.

## Validation

- Full Jest suite: 55 suites and 606 tests passed, including ten years, 730,600 check-ins and 50,000 tasks.
- Apple sign-in/older-build compatibility: 23 tests passed.
- Production Swift snapshot checks use an isolated UserDefaults suite and cover completion, counts, goal contributions, rollover, undo, duplicates, corruption, versioning and revealing the next task.
- TypeScript and UI consistency checks passed.
- The iOS app and WidgetExtension compile using Xcode 27. This is an unsigned simulator build.

Run:

    TZ=America/Toronto npx jest --runInBand --watch=false --silent
    npx tsc --noEmit
    npm run check:ui
    node scripts/check-widget-snapshot.mjs

A native rebuild is required for the new widgets, bridge, scheduled ActivityKit API and Info.plist setting. Remaining signed-device checks: Apple authorization, delivered notifications with the app closed, Home Screen widget taps, and scheduled Lock Screen/Dynamic Island cards. Desktop UI automation was unavailable for Simulator, so visual/device interaction was not verified here.
