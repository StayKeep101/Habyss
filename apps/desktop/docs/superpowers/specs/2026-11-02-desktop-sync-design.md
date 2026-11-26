# Habyss Desktop: shared account, local-first sync, and the six tabs

Date: 2026-11-02
Inputs: the owner's "Habyss Mobile → Habyss Desktop" brief (pasted 2026-11-02), the mobile repo at `~/Coding/Habyss`, and this repo's `ARCHITECTURE.md` and `SYNC_ARCHITECTURE.md`.

## Intent

Habyss Desktop is the same Habyss as the phone, signed in to the same account. Its layout is built for the desktop, and it adds detailed, Mac-native tracking of which apps you use. Sync should feel like Notion: change your timeline, a habit, a goal or a task on one device, and the other shows it within seconds without anyone pressing anything. Edits work both ways.

**Supabase is the source of truth.** The phone and the Mac are both clients of it. The Mac never talks to the phone directly, and nothing in the product or the code should frame the data as "from the phone".

**The desktop is local first.** Everything is read from and written to the Mac's own SQLite database, so the app opens instantly and works fully offline. Sync reconciles that database with Supabase in the background.

## Goals

1. Sign in to the same Supabase account as the phone.
2. Keep a full local mirror of the user's habits (including goals), habit_completions, tasks and goal_milestones, editable on the desktop and synced both ways.
3. Remote changes appear within a few seconds while online (Realtime nudge, then a cursor pass).
4. Desktop edits go up within a few seconds while online (a short debounce), to keep the last-writer-wins window small.
5. Everything above works offline. Edits queue and upload on reconnect.
6. Server-computed data (Marks, Shards, wallet, streak freezes, Community, bets) is fetched through the existing RPCs and cached locally. Offline, it shows the last values with a "last updated" time. Actions on it (stake, join a challenge, use a freeze) need a connection and say so.
7. Six tabs: Dashboard, Calendar, Progress, Friends, Profile, Settings (see "Screens").

## Non-goals (version one)

- **No paywall or lock.** The 14-day challenge and the lifetime purchase are not enforced on the desktop. The app stays fully open (owner decision).
- **No changes to Supabase or the mobile app.** Version one uses only what the server already has (owner: "whatever is most efficient"). These come later as a second phase, proposed as SQL in the mobile repo and shipped together with the phone:
  - `revision` columns and conditional writes, so conflicting edits get merged;
  - a `focus_blocks` table for focus time across devices;
  - `user_settings` rows for live shared settings and Echo;
  - an entitlement row from a RevenueCat webhook.
- No writes to `personal_backups`. The desktop may read it once at sign-in, for example for wake time, and must not upload it.
- Sign in with Apple and Google are left for later. Both need a desktop deep-link scheme and a redirect URL added in Supabase.

## Anti-goals (a failure even if it "works")

- Mac activity (app names, bundle IDs, window titles, intervals) reaching Supabase, `personal_backups` or friends in any form.
- Desktop activity completing a habit or task, or earning Marks or Shards, without an explicit user link. Version one adds no such link.
- Numbers that differ from the phone's for the same data (due days, streaks, goal pace, timeline order). The mobile rule functions are reused, not re-derived.
- The app failing to open, or losing an edit, because it is offline.
- A service-role key in the bundle, or tokens in logs.
- Reading or writing friends' data in any way the phone does not. The desktop uses exactly the phone's access paths (owner decision, 2026-11-02): the RPCs, plus the tables the phone reads and writes directly. Supabase's row-level security decides what each account can see.
- Mixing two accounts in one local database.

## Constraints

- Stack: Tauri 2, a Rust backend that owns SQLite (single writer and file lock, as today), React 19 + TypeScript. macOS 14+.
- Supabase project `wlbjhtlznzdumqxetilx`, publishable (anon) key only, with RLS deciding access. The owner provides the URL and key (EAS env `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_KEY`). They are build-time config, not committed secrets.
- The refresh token lives in the macOS Keychain.
- Server conventions must be honoured exactly: client-generated UUID v4 ids kept forever; `updated_at` stamped by the server; local calendar `date` columns and `HH:MM` local times with no timezone; soft deletes via `deleted_at`; `habit_completions` unique on `(user_id, habit_id, date)` with a server-assigned id; goals uploaded before the habits and milestones that point at them.
- Shared tasks: `status`, `completed_at` and `amount` are personal and are never uploaded onto a friend's row.
- One account per local database. Signing in as a different account clears the synced local data first. Account deletion uses the `delete_my_account` RPC, then wipes the local synced store. Mac activity history is not wiped by an account switch.
- The existing activity tracker must keep working unchanged, offline and without an account.

## Decided

**By the owner:**
- The six tabs and what each holds (see "Screens").
- Two-way editing on the desktop.
- Supabase as the truth, the desktop as local first.
- No lock.
- The most efficient path: version one uses no server or mobile changes.

**My calls (the owner can override):**
- **Sync runs in Rust, next to the database**, not in the React screens. It keeps running while the window is hidden in the menu bar, and SQLite keeps its single owner. The webview never talks to the network; React calls typed Tauri commands, as it does today. Server RPCs for the Friends and Profile tabs also go through Rust commands, which cache the results.
- **The sync algorithm is a port of `lib/cloudSync.ts`, including its upload ordering, and `lib/cloudMapping.ts` ported function by function to Rust.** That means:
  - upload rows marked unsynced in batches of 200, retrying a rejected batch row by row;
  - mark a row synced only if it didn't change during the upload;
  - download with one cursor per table, in pages of 1,000 ordered by `(updated_at, id)` with keyset paging (`lib/cloudPullPage.ts`);
  - a row that fails to write locally holds its table's cursor back;
  - an incoming row never overwrites a local row with unsent edits;
  - drop a column the server lacks and retry later.
- **Triggers:** at sign-in, at launch, on network regained, about 2.5 s after a local edit, when the window comes to the front (throttled), when a Realtime `postgres_changes` event arrives on the four tables filtered by `user_id=eq.<uid>`, and a slow periodic pass as a safety net. Realtime is only a nudge; the cursor pass is the truth.
- **Shared goals:** after the download, refresh the rows friends share with you (`refreshShared` in `lib/cloudSync.ts`), with the same personal-field rule as mobile.
- **The mobile rule files are reused as TypeScript in the React layer**, copied into a shared folder with their mobile-only imports (AsyncStorage, `require` of stores) replaced by explicit inputs. The files are `recurrence`, `habitSchedule`, `dayFlow` and `dayPlan`, `habitStatus`, `goalInsights`, `dayComplete` (`streakFrom`), `marks`, `sharedGate`, `tasks` helpers, and `voicePlan` and `voiceClean` if needed. Each copy records the mobile commit it came from, and a test checks it against the same fixtures as mobile.
- **Marks and Shards are read, not written.** Following the brief, the desktop shows `profiles.marks`, `profiles.shards_earned` and `my_wallet` / `my_ledger`, and never writes `profiles`. The phone computes and publishes them, so a tick made on the desktop shows up in Marks only after the phone's next sync. The UI says "updated <time>". `marks.ts` is ported only to explain the numbers, not to publish them.
- **Ticks do what the phone does for friends.** When you tick a habit that belongs to a shared goal, the desktop writes `shared_completions` the same way `friendsService.ts` does, so friends see ticks made on the desktop.
- **Items friends own:** goals and habits a friend owns are read-only on the desktop. Shared tasks can have their plan edited, and your own status, completion time and amount stay local (per the brief). An upload the server refuses because of access rules is marked as refused and shown in sync health. It does not stay pending forever.
- **No full push or backup upload.** The phone's `requeue` / `FULL_PUSH_VERSION` and `syncPersonal` upload are not ported. The desktop keeps its own local schema version.
- **Sign-in:** the email 6-digit code (`signInWithOtp` / `verifyOtp`) and email + password. Neither needs a redirect.
- **Desktop focus sessions stay local** (the existing `focus_sessions` table) until `focus_blocks` exists.
- **Local schema:** a new migration adds mirror tables for the four synced tables, plus per-row `synced` and `deleted_at` (as on mobile), a per-table cursor table, an account table (user id, email, last sync, sync health) and a cache table for RPC results. Existing activity tables are untouched.
- **Sync health is visible:** Settings shows the account, last sync, pending changes, any error, and a "Sync now" button. A small status dot sits in the sidebar.
- The CSP stays closed to the network, because only Rust talks to Supabase.

## Screens

Every tab reads the local database first. Server-only parts show cached values offline.

- **Dashboard.** Today's summary: time per app and category (local only), habits done today and streak, goal progress, Marks and Shards, and what's next on the timeline.
- **Calendar.** The day's plan from the synced tasks and habits, laid out by the ported timeline rules. Next to it is what you actually did on the Mac, from the activity tracker. Wake time comes from `personal_backups` if available, otherwise from a desktop setting.
- **Progress.** Goals with their linked habits, tasks and milestones, plus pace and forecast from `goalInsights`. Goals, habits, tasks and milestones can be created, edited, ticked and deleted here.
- **Friends.** Friends list and requests, challenges, the feed with reactions and comments, King of the Week, missions and bets. Each reads and writes the way the phone's `friendsService.ts` does: the RPCs plus direct table access. Online-only actions are marked as such.
- **Profile.** Marks, Shards, wallet, current streak and streak freezes, best streak and goals completed, all from the server (`profiles` and the RPCs). There is no Achievements section, because no such data exists (owner, 2026-11-02).
- **Settings.** Account and sign-in, sync health, and the existing tracking and privacy controls.

The owner will refine the visual design later. A builder should use plain, consistent layouts and not invest in polish beyond the existing app's style.

## Suggested order

1. Account, keys and Keychain; email sign-in.
2. Local mirror schema; port of the mapping and sync; triggers and Realtime; sync health.
3. Shared rule files in TypeScript, with parity tests.
4. Tabs: Progress and Calendar first (they prove two-way sync), then Dashboard, Profile, Friends, Settings.

## Left to the builder

- Rust crates: an HTTP client, a WebSocket client for Realtime, Keychain access, and whether to use a PostgREST client crate or plain REST.
- Exact local table layouts and indexes.
- Debounce and throttle tuning within the stated targets.
- Component structure and chart choices within the existing UI conventions.
- How the rule-file parity fixtures are produced.
