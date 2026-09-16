# Habyss implementation handoff

Updated: 2026-09-16 (second pass). The review checklist in `IMPROVEMENTS.md` is
now fully implemented and statically verified. What remains is device
verification and the unrelated build blocker noted below.

## Goal and source of truth

Implement the user's hands-on app review across Home, Roadmap, habit
creation/detail, profile, and AI preferences. Full checklist: `IMPROVEMENTS.md`.
Preserve the dark/glass/cyan aesthetic. Do not publish, send invitations, or
modify production services.

## Repository

- Expo Router / React Native / TypeScript, SQLite-first. cwd: `/Users/erwan/Coding/Habyss`.
- Commands: `npm run type-check`, `npm run test:ci`, `npx expo export --platform ios`.
- Work is committed on `main` in reviewable commits rather than left in the tree.

## State after this pass

All checklist items are implemented. Highlights from the second pass:

- Completed the incomplete expo-router edit that left `useGlobalSearchParams`
  called but never imported, which did not compile.
- Removed routines end to end: screen, provider, card, player and builder. The
  provider was already unwired, so the remaining UI would have thrown if
  rendered. Stored routine records are intact.
- Profile: `ScrollPickerModal` no longer nests a `FlatList` inside
  `SettingsModal`'s `ScrollView` (the VirtualizedList warning the user hit); the
  background photo is gone; age is derived from a birthday date picker, stored
  as a local date key, with legacy age-only profiles preserved.
- One `ShareParticipantsSheet` now backs both goal and habit sharing. It awaits
  the work before reporting success, keeps the sheet open on failure, and treats
  a `false` return from `FriendsService` as a failure. Copy no longer implies an
  invitation is delivered, because `FriendsService` is local state.
- Focus: `lib/focusHistory.ts` reads the already-persisted `focus_session_*`
  records into per-day history and models the active day (default 08:30–22:00).
  The card now shows time left, sessions today and best session today, and opens
  a per-day history sheet where the day window is editable.
- Roadmap drag: the hovered goal is published to React state only when it
  changes. It previously called `setHoveredGoalId` on every pointer move, which
  re-rendered every goal and habit row for each frame of a drag.
- AI configuration: personality modes are compact single rows with the
  description shown only for the selected mode, so the screen fits at a glance.
  Their emoji icons render as text instead of being passed to `Ionicons`.
- Deleted the orphaned `GoalProgressGraph`, the source of the "Not enough real
  data yet" text behind average progress.

## Pending

1. **Device verification.** Nothing here has been exercised on hardware. The JS
   changes reach the installed dev build through Metro without a native rebuild.
   Worth walking: editing a habit (freeze fix), dragging a habit between goals,
   the streak sheet's goal swiping and activity map, the focus history sheet,
   and the profile birthday and gender pickers.
2. **Local native builds are blocked, unrelated to this work.** The Habyss
   scheme embeds the Watch app, and Xcode 26.5 refuses to plan the scheme
   without the watchOS 26.5 simulator runtime; the newest installed is 26.2.
   Install it via Xcode → Settings → Components, or
   `xcodebuild -downloadPlatform watchOS`. This affects device builds too,
   because the check is at scheme level.
3. **Pre-existing lint debt.** `react-hooks/*` rules from the newer
   `eslint-config-expo` report errors across the app, including a
   `loadHabitDetails` used-before-declared in habit detail. These predate this
   work and do not crash at runtime; worth a separate pass.
4. Item 6.2 of the user's list left two of the three focus metrics unspecified.
   Sessions today and best session today were chosen; confirm or replace.

## User screenshots (readable absolute paths)

1. Home full scroll: `/Users/erwan/Library/Application Support/CleanShot/media/media_cmLJFp4RXO/CleanShot 2026-09-16 at 10.48.53 AM@2x.png`
2. Roadmap filter: `/Users/erwan/Library/Application Support/CleanShot/media/media_XAyiQXCVWz/CleanShot 2026-09-16 at 10.49.26 AM@2x.png`
3. Goal dashboard: `/Users/erwan/Library/Application Support/CleanShot/media/media_MEflD0Cggk/CleanShot 2026-09-16 at 10.50.04 AM@2x.png`
4. Streak celebration: `/Users/erwan/Library/Application Support/CleanShot/media/media_e8SP5N8S46/CleanShot 2026-09-16 at 10.50.41 AM@2x.png`
5. Streak hero: `/Users/erwan/Library/Application Support/CleanShot/media/media_PFzGehyHKa/CleanShot 2026-09-16 at 10.51.45 AM@2x.png`
6. Streak full detail: `/Users/erwan/Library/Application Support/CleanShot/media/media_NuqqRuNelS/CleanShot 2026-09-16 at 10.51.39 AM@2x.png`
