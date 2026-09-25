# Learnings

Project-specific insights and corrections. Never store private user data here.

## [LRN-20260922-001] user_preference

**Logged**: 2026-09-22
**Priority**: high
**Status**: resolved
**Area**: frontend

### Summary
For external dashboard setup that the user can quickly do, tell them the exact change instead of navigating the dashboard. Concentrate agent work on implementation and automated verification.

### Details
The user explicitly requested this workflow while enabling Supabase Apple and Google providers. Read-only provider checks via the project's public auth settings endpoint are still useful; never print keys or claim that a mocked sign-in proves a live account flow.

### Metadata
- Source: user_feedback
- Related Files: lib/socialSignIn.ts

## [LRN-20260922-002] best_practice

**Logged**: 2026-09-22
**Priority**: high
**Status**: resolved
**Area**: frontend

### Summary
Defer Supabase account listeners until the auth callback releases its lock; Community listeners call getSession and otherwise can stall sign-in.

### Metadata
- Source: code_review
- Related Files: lib/account.ts, lib/__tests__/account.test.ts

## [LRN-20260922-003] best_practice

**Logged**: 2026-09-22
**Priority**: medium
**Area**: frontend

### Summary
Creation sheets derive their fields from the parse and keep only the user's overrides in state, rather than copying each reading into state from an effect.

### Details
HabitSheet and GoalSheet compute `draft = { ...readingOf(text), ...edits }` during render. This keeps a later word in the sentence able to move the days while a day the user tapped stays tapped, and it satisfies react-hooks/set-state-in-effect, which the project treats as an error. Resetting when a sheet opens is a render-phase state update keyed on the thing being edited (`session !== lastSession`), not an effect, so the first frame is already blank.

### Metadata
- Source: implementation
- Related Files: components/Create/HabitSheet.tsx, components/Create/GoalSheet.tsx, components/Create/DetailRow.tsx

## [LRN-20260922-004] best_practice

**Logged**: 2026-09-22
**Priority**: high
**Area**: ios

### Summary
The widget cannot work out a habit's schedule, so the app writes the day it means (`dayKey`) and the widget refuses to show a list once that day has passed.

### Details
`lib/widgetSync.ts` is the only thing that decides what the widget shows: habits scheduled today plus tasks due today, skipped ones left out, ids prefixed `habit:`/`task:`. Before this the widget was sent every non-archived habit, so a Monday-only habit sat there all Sunday and the counts never matched the app. The widget's timeline also refreshes at midnight, and the toggle intent records the state the user chose (`id|1`), not a toggle, so a tick on the widget and a tick in the app cannot cancel each other out.

Also: `npx expo prebuild --clean` deletes the widget and watch targets — there is no config plugin that recreates them (see docs/WIDGETS.md).

### Metadata
- Source: implementation
- Related Files: lib/widgetSync.ts, lib/widgetService.ts, ios/Widget/HabyssWidget.swift, docs/WIDGETS.md

## [LRN-20260922-005] best_practice

**Logged**: 2026-09-22
**Priority**: medium
**Area**: ai

### Summary
Echo's model-written reminders are generated into a pool in the background, never while notifications are being scheduled.

### Details
Up to 64 reminders are booked in one refresh; a 1B model answering that many times would take minutes. `lib/echoWriter.ts` keeps four lines per habit in AsyncStorage, scheduling only reads from the pool, and a few more lines are written afterwards without anything waiting on them. A generated line containing a digit is thrown away: the model is given no history, so a number could only be invented.

### Metadata
- Source: implementation
- Related Files: lib/echoWriter.ts, lib/notificationService.ts

## [LRN-20260923-001] best_practice

**Logged**: 2026-09-23
**Priority**: high
**Area**: backend

### Summary
A Supabase migration can be proven before it is run on production by replaying the repo's migration history into a local Postgres and applying the new one with ON_ERROR_STOP.

### Details
`brew`'s postgresql@17 is installed. Scaffold the Supabase shape first (roles anon/authenticated/service_role, schema auth, auth.users, auth.uid()), then apply `supabase/migrations/20241227_init_schema.sql`, then `supabase_schema.sql` (which is what creates profiles/friendships/friend_requests/shared_habits), then the rest in order. `notifications` exists on the live database but is created by no file in the repo, so it has to be created by hand for the replay.

This found a real defect in 20260918_align_app_and_secure.sql: it granted on `profiles.push_token` unconditionally, so any database without that column aborted the whole migration. The grants are now made column by column against information_schema.

### Metadata
- Source: implementation
- Related Files: supabase/migrations/20260918_align_app_and_secure.sql

## [LRN-20260923-002] project

**Logged**: 2026-09-23
**Priority**: high
**Area**: backend

### Summary
As of 2026-09-23 the live Supabase project has Apple, Google and email providers enabled, but the 20260918 migration is still not applied.

### Details
Probed read-only with the publishable key: `auth/v1/settings` lists apple, email and google as enabled. The database still has no `tasks` table, no `habits.goal_spec`, no `friend_stats` RPC, and `profiles.email` is readable by anyone holding the key that ships in the app (three real addresses came back). Until the migration is applied, tasks never reach the cloud; `lib/cloudSync.ts` now skips a missing table instead of failing the whole backup, and reports it as `waiting`.

### Metadata
- Source: verification
- Related Files: supabase/migrations/20260918_align_app_and_secure.sql, lib/cloudSync.ts

## [LRN-20260923-003] best_practice

**Logged**: 2026-09-23
**Priority**: high
**Area**: frontend

### Summary
UI work on this project can be verified for real: the simulator is booted with the app installed, and `habyss://habit-detail?habitId=<id>` deep links straight to a screen.

### Details
`xcrun simctl io <device> screenshot` plus a crop in Python shows what actually rendered. Habit ids come from the simulator's own database at `$(xcrun simctl get_app_container <device> com.habyss.app data)/Documents/SQLite/habyss.db`. Metro is usually already running from the user's `expo run ios`, so a launch picks up the current JS.

This found two layout bugs the same day that tests and type-checking both passed over. Simulator.app itself is not installed (Xcode CLI only), so there is no way to tap — only deep-linkable screens can be reached.

### Metadata
- Source: implementation
- Related Files: components/Common/ViewSwitcher.tsx, app/(root)/habit-detail.tsx

## [LRN-20260923-004] best_practice

**Logged**: 2026-09-23
**Priority**: high
**Area**: frontend

### Summary
Inside a React Native `Modal`, position a composer against the keyboard with Reanimated's `useAnimatedKeyboard`, not `KeyboardAvoidingView`.

### Details
`KeyboardAvoidingView` measures the screen rather than the modal's own window, so a card inside a modal ends up sitting below the keyboard instead of on it. Reading the keyboard frame directly (`keyboard.height.value` as the container's `paddingBottom`) puts the card exactly on the keyboard and makes it track the keyboard's motion frame for frame, including when a chip tap dismisses it. The home indicator's room lives *inside* the card as `max(8, insets.bottom - min(keyboardHeight, insets.bottom))`, so the inset and the keyboard never add up to a gap. `jest.setup.js` needs `useAnimatedKeyboard` in the Reanimated mock.

Springs are wrong for anything that resizes under a thumb: `LinearTransition.springify()` overshoots by design, which is the bounce. The creation bar instead gives every panel one fixed height (`PANEL_HEIGHT`) and slides between two positions on a timing curve, so choosing something inside a panel — which changes the chip's own text and can reveal a picker — cannot move the bar at all.

### Metadata
- Source: implementation
- Related Files: components/Create/ComposerModal.tsx, components/Create/DetailBar.tsx

## [LRN-20260923-005] project

**Logged**: 2026-09-23
**Priority**: high
**Area**: frontend

### Summary
The daily promise ("today's 3" or 5) is a count of tasks finished today, not a fixed set of chosen tasks.

### Details
`lib/dailyFocus.ts` defines it: `done` is anything completed today whatever its due date, so finishing three things that were not the three shown still keeps the day. The rows on the Home card are only a suggestion of where to start, ranked the way the roadmap already ranks work (late, then due today, then undated). The target lives in AsyncStorage rather than AppSettingsContext because `lib/notificationService.ts` reads it too and cannot use React context; `TARGET_CHANGED` on DeviceEventEmitter keeps open screens current.

Today never counts as a broken streak while it is unfinished — there is still time to keep it.

### Metadata
- Source: implementation
- Related Files: lib/dailyFocus.ts, components/Home/DailyFocusCard.tsx, app/(root)/task-stats.tsx

## [LRN-20260923-006] project

**Logged**: 2026-09-23
**Priority**: high
**Area**: frontend

### Summary
Onboarding asks about the person, not about the goal they have failed at, and the answers choose Echo's starting voice.

### Details
The flow is welcome → name → how they found us → what they hope for → sleep (chronotype, hours, amount) → when work actually happens → what stops them → meeting Echo → choosing its voice → backup → friends. The goal, the history of failing at it, the cost of giving up, the time budget, the measurable restatement and the plan builder are all gone: onboarding no longer creates a goal or a habit, because the creation sheets in the app do it better.

`lib/onboardingProfile.ts` holds the questions and `suggestEcho`, whose order matters more than its rules: exhaustion and overwhelm win over lateness, because pushing someone who is already drowning is harm rather than motivation. The harshest voice is never suggested to anyone — there is a test for it — and it stays an explicit choice.

`lib/roadmapPlan.ts` and `lib/onboardingPlan.ts` are now unused by the app but kept: `buildRoadmap` is the engine for building a roadmap to a goal, which belongs in the goal sheet rather than in setup.

### Metadata
- Source: implementation
- Related Files: app/(auth)/onboarding.tsx, lib/onboardingProfile.ts, lib/onboarding.ts

## [LRN-20260924-001] best_practice

**Logged**: 2026-09-24
**Priority**: high
**Area**: frontend

### Summary
A day is kept when both promises are: the habits scheduled that day are logged, and the day's task target is met. One streak, two conditions — never a blended percentage.

### Details
`tallyDay` used to count every task carrying today's date, while the Home card counted any 3 (or 5) finished. Those were two definitions of a finished day and they disagreed. `tallyDay` now takes the daily target: the task half asks for `min(target, finished + stillOpen)`, so nobody is asked for work that does not exist, and a day with no tasks at all is judged on its habits alone. The streak, the celebration, the widget and the ring around the avatar all read from that one tally.

The separation still holds below it: Consistency is habits only, because a streak of one-off tasks is meaningless, and the task dashboard keeps its own days-kept rate. What is blended is one day's workload, which is a progress reading; what is never blended is a quality score.

### Metadata
- Source: implementation
- Related Files: lib/dayComplete.ts, components/Home/ProgressAvatar.tsx, lib/dailyFocus.ts

## [LRN-20260924-002] project

**Logged**: 2026-09-24
**Priority**: high
**Area**: backend
**Status**: resolved 2026-09-24 — the migration is applied and all providers are configured.

### Summary
As of 2026-09-24, Google sign-in is blocked on Supabase having no OAuth client secret; Apple is configured and accepting id tokens.

### Details
`GET /auth/v1/authorize?provider=google` returns `{"error_code":"validation_failed","msg":"Unsupported provider: missing OAuth secret"}` — the provider is toggled on but has no Client ID/Secret. `POST /auth/v1/token?grant_type=id_token` with provider apple returns "Unable to detect issuer in ID token", meaning it got past provider config and was parsing the (fake) token, so Apple is set up; what cannot be checked remotely is whether `com.habyss.app` is in its allowed Client IDs.

These probes need only the publishable key and are the fastest way to tell a provider problem from an app problem.

### Metadata
- Source: verification
- Related Files: lib/socialSignIn.ts

## [LRN-20260924-003] project

**Logged**: 2026-09-24
**Priority**: high
**Area**: frontend

### Summary
Email sign-in has two ways in again: a password as well as the emailed code.

### Details
The app used to sign in with `signInWithPassword` from `app/(auth)/sign-in.tsx` (present at 9db4388), which was deleted when the account and backup system landed at 8872341, leaving the 6-digit code as the only way in. That made sign-in depend on an email actually arriving, and the Magic Link template carries a code only when it contains `{{ .Token }}` — without it the email holds a link to the Site URL, which is `http://localhost:3000` by default.

A probe of the live project (`POST /auth/v1/token?grant_type=password` with a fake user) returns "Invalid login credentials", so password auth is enabled and working server-side. `signInWithPassword` and `signUpWithPassword` in lib/account.ts both end in `finishSignIn`, so every route merges the phone and the account identically.

Note `mailer_autoconfirm: false` on this project: creating a new account by password still waits on a confirmation email, which is why `signUpWithPassword` returns `{ ok: true, value: null }` rather than pretending it signed in.

### Metadata
- Source: implementation
- Related Files: lib/account.ts, app/(root)/account.tsx

## [LRN-20260924-004] reference

**Logged**: 2026-09-24
**Priority**: high
**Area**: backend

### Summary
`npm run check:supabase` audits the live project against what the app needs, using only the publishable key; `npm run apply:migration` applies a migration through the Management API once a personal access token is in .env.local.

### Details
The check asks exactly what a phone in someone's pocket can ask: every column `lib/cloudMapping.ts` writes, the RPCs live code calls, whether `profiles.email` is readable while signed out, and which sign-in providers are configured. It is the fastest way to answer "if someone signs in on a new phone right now, does everything come back?".

Note that `create_friendship` and `search_profiles_by_code` are called only from `lib/_premium/friendsService.ts`, which nothing imports — the live path is `lib/friendsService.ts`, and the only RPCs that matter are `friend_stats` and `delete_my_account`, both of which the 20260918 migration creates.

The apply script needs `SUPABASE_ACCESS_TOKEN` (sbp_...), which is not the key the app ships with and can change anything in the account; it is read from .env.local and never printed. The migration is one transaction, so a refusal applies nothing.

### Metadata
- Source: implementation
- Related Files: scripts/check-supabase.mjs, scripts/apply-migration.mjs

## [LRN-20260924-005] project

**Logged**: 2026-09-24
**Priority**: high
**Area**: frontend

### Summary
The user's phone is 375×667 points (iPhone SE/8). Verify layout on the "Habyss SE" simulator, not on a Pro.

### Details
Their screenshots are 750×1334 at @2x. The Pro simulator used for most checks is 402×874 — 207 points taller — so any claim that a screen "fits without scrolling" proved nothing about their device. A matching simulator exists as "Habyss SE" (iPhone SE 3rd gen); install the app bundle from the Pro device's container and copy `Library/Preferences/com.habyss.app.plist` plus `Library/Application Support` across so the dev client reconnects to Metro without needing a tap on the "Open in Habyss?" alert, which cannot be dismissed from the command line.

Differences between their phone and a simulator come from settings, not code: the accent lives in AsyncStorage under `habyss_accent_gradient` (theirs is `gold`), and a fresh simulator has none, so it falls back to the default blue.

### Metadata
- Source: implementation
- Related Files: components/Layout/VoidShell.tsx

## [LRN-20260924-006] project

**Logged**: 2026-09-24
**Priority**: high
**Area**: backend

### Summary
The GitHub repo is public, so build configuration belongs in EAS environment variables, never in eas.json.

### Details
`StayKeep101/Habyss` is public. `eas.json` is committed, so anything in its `env` block is published — and bots scrape GitHub for Supabase credentials. The publishable key ships inside the binary anyway, but publishing it while `profiles.email` is still readable without signing in would hand over every user's email address, so the migration matters more than the key's classification.

Supabase URL and key are set as EAS project environment variables (plaintext visibility) for development, preview and production. Nothing Supabase-related is in eas.json. Checked: no real key has ever been committed — the repo's docs only contain the project ref and placeholder strings.

A placeholder is not the same as absent. `EXPO_PUBLIC_SPOTIFY_CLIENT_ID="PLACEHOLDER_..."` is truthy, so `isSpotifyConfigured()` reported Spotify as ready in preview builds and the connect flow then failed with a developer message. Both placeholder entries were removed from the preview profile.

### Metadata
- Source: implementation
- Related Files: eas.json, lib/integrationAvailability.ts

## [LRN-20260924-007] project

**Logged**: 2026-09-24
**Priority**: high
**Area**: backend

### Summary
The 20260918 migration is applied. The live database now matches the app, and the app key can no longer read anything while signed out.

### Details
Applied through the Management API using the Supabase CLI's own keychain login, so no token was stored anywhere new. Row counts before and after are identical — 3 profiles, 27 habits, 38 completions, 2 friendships — and `tasks` was created empty. `friend_stats` and `delete_my_account` exist, and every table the app writes carries four policies for `authenticated`, so signing in still reads and writes normally.

The meaning of a refusal changed with it: before the migration a 401 from PostgREST meant something was wrong, and now it is the correct answer to the app key asking for another user's rows. `scripts/check-supabase.mjs` reads the catalog directly when a token is available and only falls back to probing, where 404 means missing, 401 means protected, and 400 means the column really is not there.

One thing PostgREST does not do by itself: after a migration its schema cache still answers 404 for a table that now exists. `NOTIFY pgrst, 'reload schema';` fixes it.

### Metadata
- Source: implementation
- Related Files: scripts/check-supabase.mjs, supabase/migrations/20260918_align_app_and_secure.sql
