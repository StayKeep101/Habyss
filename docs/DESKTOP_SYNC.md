# Habyss Mobile → Habyss Desktop: features and sync brief

For the agent building Habyss Desktop (Tauri 2, Rust + SQLite, React 19). This describes the mobile app as it is on 2026-11-02, what is already in the cloud, and what is needed for the two apps to share one account.

**What Habyss is for.** Habyss saves people's time ("time is money"). Its world is the Abyss, Chronos (time) and Echo (the companion who speaks to you). The core promise is almost no friction between a thought, a plan and an action. Every desktop feature should save time or remove a step.

---

## 1. Mobile stack and backend

| Layer | Technology |
| --- | --- |
| App | Expo SDK 57, React Native 0.86, Expo Router, TypeScript, Reanimated 4 |
| Local data | SQLite (`expo-sqlite`, schema v20, `lib/database.ts`) for habits, completions, tasks, milestones and partial progress; AsyncStorage for settings, Echo, focus totals, check-ins, sleep, meals and brain dump |
| Backend | Supabase (Postgres + Auth + Realtime + Edge Functions), project `wlbjhtlznzdumqxetilx` |
| Purchases | RevenueCat + App Store: 14-day free challenge, then $9.99 once for life |
| On-device AI | Apple Foundation Models where available, plain rules otherwise |

**Local-first.** The phone works with no account. A local UUID (`habyss_local_user_id`) owns the rows. When someone signs in, the rows are adopted under their Supabase `auth.users.id`, and every synced row is then scoped by `user_id`.

**Authentication** (Supabase Auth, PKCE):
- email: a one-time 6-digit code (`signInWithOtp` + `verifyOtp`) or a magic link; email + password also works;
- Sign in with Apple: native identity token → `signInWithIdToken`;
- Google: the web OAuth flow through Supabase (native Google sign-in is coded but waits for a build).

Mobile return URL: `habyss://auth-callback`. **For desktop:**
- the email code needs no redirect, so it is the simplest first sign-in;
- for Apple or Google, register a desktop scheme (for example `habyss-desktop://auth-callback`) as a Tauri deep link and add it to Supabase → Authentication → URL Configuration → Redirect URLs. Do not add the custom scheme to Google's authorised redirect URIs: Google returns to `https://wlbjhtlznzdumqxetilx.supabase.co/auth/v1/callback` first.

**Keys.** Use the same project URL and the **publishable (anon) key** only. Ask the owner for them; they are in the EAS `preview` environment as `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_KEY`. Row-level security decides what each account can read or write. Never ship a service-role key in either app. Keep the desktop session's refresh token in the macOS Keychain.

**Who owns the schema.** All Supabase migrations live in the **mobile repo** (`supabase/migrations/`). The desktop app proposes SQL; the owner applies it. Never change the live database from the desktop project.

---

## 2. Data schema (server, Postgres)

### Conventions (all synced tables)

- **IDs:** UUID v4 strings, created on the client and kept forever. Never recreate a row with a new id on import.
- **Timestamps:** `timestamptz`, ISO 8601 UTC. **`updated_at` is set by the server** on every insert and update (triggers `set_updated_at` / `stamp_server_time`). Whatever the client sends is overwritten, so a device with a wrong clock cannot jump the sync cursor.
- **Calendar days:** `date` columns (`YYYY-MM-DD`) hold the **user's local day**, not a UTC day: a habit ticked at 23:30 in Paris counts for that Paris date. Times of day are `HH:MM` strings in local time (`start_time`, `due_time`). No timezone is stored; each device uses its own local time.
- **Deletions are soft:** `deleted_at timestamptz` is null while the row is alive and set when it is deleted. Rows are never hard-deleted by sync. On the phone this is `deleted = 1`.
- **Booleans/JSON:** real `boolean` and `jsonb` on the server; the phone stores 0/1 and JSON text. The exact conversions, and the value cleaning that keeps one bad row from failing a batch, are in `lib/cloudMapping.ts`: **port these functions one for one.**

### The four synced tables (what desktop should mirror)

**`habits`** (goals are habits too: `is_goal = true`)

| Column | Meaning |
| --- | --- |
| `id`, `user_id` | UUIDs |
| `name`, `description`, `icon`, `color`, `category` | Display (`color` is a hex string) |
| `is_goal`, `goal_id` | A goal is a habit row with `is_goal = true`; a habit or task points at its goal through `goal_id` (a self-reference, so upload goals first) |
| `target_date`, `goal_spec` (jsonb) | A goal's deadline and what "done" means (target amount, unit, …) |
| `start_date`, `end_date` | Local dates |
| `recurrence` (text, JSON) | The repeat rule, see below; `task_days` (jsonb weekday list) and `frequency` / `week_interval` are older fallbacks |
| `start_time`, `end_time`, `duration_minutes`, `time_of_day` | When and how long. No length means 30 minutes for a habit |
| `tracking_method` | `boolean` (done or not) or `numeric` (an amount); `goal_value`, `goal_period`, `unit` |
| `priority` (0–4 urgency), `difficulty` (1–3), `flexible` (false = exact time) | Used by the timeline |
| `reminders`, `reminder_offset`, `reminder_message`, `ringtone`, `location_reminders` | Phone reminders |
| `type` (`build`/`quit`), `is_archived`, `chart_type`, `graph_style`, `show_memo`, `health_kit_metric`, `health_kit_target` | Display and integrations |
| `created_at`, `updated_at`, `deleted_at` | |

`recurrence` grammar (`lib/recurrence.ts`):

```ts
| { kind: 'hourly'; every: number }
| { kind: 'daily'; every: number }
| { kind: 'weekly'; every: number; weekdays: ('mon'|'tue'|'wed'|'thu'|'fri'|'sat'|'sun')[] }
| { kind: 'monthly'; every: number; dates: number[] }
| { kind: 'monthly'; every: number; ordinal: 1|2|3|4|5|-1; day: Weekday|'day'|'weekday'|'weekend' }
| { kind: 'yearly'; every: number; months: number[] }   // optionally with ordinal + day
| { kind: 'quota'; every: number; times: number; period: 'week'|'month' }  // "3 times a week"
```

Intervals count from the habit's `start_date`. Whether a habit is due on a day is decided by `isHabitScheduledForDate` / `createHabitRequirement` in `lib/habitSchedule.ts`. Port these exactly, or streaks will differ between devices.

**`habit_completions`**: one row per habit per local day.
- Unique on **`(user_id, habit_id, date)`**; upsert with `onConflict: 'user_id,habit_id,date'`. The server assigns `id`; the phone's local id is `<habit_id>_<date>` and is never uploaded.
- `value` (1 for a tick, or the amount), `memo`, `completed`, `skipped`, `evidence` (`verified` | `context` | `self` | null).
- An untick is `deleted_at` set, or `completed = false`.
- Partial progress during the day (an amount not yet at its target) is in the phone's `habit_measurements` table, which does **not** sync row by row (see `personal_backups`).

**`tasks`**
- `title`, `description`, `due_date`, `due_time`, `estimated_minutes` (no length means **90 minutes**);
- `priority` 1–3, `difficulty` 1–3, `flexible`, `deadline` (a "due by" date distinct from the planned day);
- `goal_id`, `milestone_id`, `status` (`open` | `done` | `cancelled`), `completed_at`;
- `measure` (`done` | `count` | `time`), `target`, `unit`, `amount`;
- `subtasks` (jsonb), `section`, `source` (`app` | `mcp` | `shortcut`), `external_id`.

A task shared by a friend is the friend's row. You may edit the plan, but `status`, `completed_at` and `amount` are personal and are not uploaded onto someone else's row.

**`goal_milestones`**: a goal's checkpoints: `goal_id`, `title`, `due_date`, `done_at`, `position`.

### Other server data desktop may read

- **`personal_backups`**: one jsonb document per account holding everything that is not a table row: settings, Echo's memory and personality, focus totals and per-session records (`focus_session_<ms>` keys), check-ins, sleep, meals, brain dump, the Marks-kept ledger, and 120 days of partial progress. It is a **whole-document backup restored once per device**, not live sync. Desktop may read it at sign-in, but should not write it until it becomes versioned (section 5).
- **`profiles`**: username, display name, avatar, cover, sharing switches, plus the published `marks`, `marks_series`, `best_streak`, `goals_completed` and `shards_earned`.
- **Social / economy (RPCs only, all `security definer`):**

  | Area | RPCs |
  | --- | --- |
  | Community, missions, King of the Week | `community_feed`, `friend_stats`, `friend_today_tasks`, `friend_presence`, `leaderboard`, `crew_consistency`, `crew_king`, `crew_quest`, `crew_challenges_for`, `issue_challenge`, `join_challenge`, `my_mission`, `revealed_missions` |
  | Shards and betting market | `my_wallet`, `my_ledger`, `market_feed`, `open_market`, `place_stake`, `settle_market` |
  | Streak freezes | `my_streak_freezes`, `use_streak_freeze`, `gift_streak_freeze` |
  | Exposed | `create_exposed`, `act_on_exposed` |

  Tables read directly: `friendships`, `friend_requests`, `shared_goals`, `shared_habits`, `shared_tasks`, `shared_completions`, `day_cards`, `feed_reactions`, `feed_comments`, `notifications`, `user_blocks`.
- **`focus_sessions` (server)**: an **old, unused** table that requires a `habit_id`. Don't build on it; see section 5.

---

## 3. Features and how each is defined

Desktop parity, in priority order. Each rule lives in one `lib/` file on mobile. **Port the function, don't re-derive the rule**, or the numbers will differ between devices.

1. **Today / timeline** (`lib/dayFlow.ts`, `docs/timeline-rules.md`). The day starts at wake time:
   - meals and calendar events never move;
   - tasks come before habits; tasks are ordered by deadline, then urgency, then difficulty; habits by urgency, then difficulty;
   - something set to an exact time stays at its time (shown with a lock);
   - something too long for the gap before a fixed block splits into "1 of 2" / "2 of 2";
   - swipe to reschedule, or finish early, lays out what's left from that moment;
   - **Auto-reschedule** (a setting, default on). Off means everything with a time keeps it and nothing is laid out again; untimed things are placed once in free time.
   - Default lengths: task 90 min, habit 30 min.
2. **Habits.** A recurrence rule, done/not done or an amount, and reminders. A habit's state today (`focusing` | `paused` | `done` | `skipped` | `focus-now` | `open`) comes only from `habitStatus` in `lib/habitStatus.ts`.
3. **Goals.** Habits with `is_goal`, with linked habits, tasks and milestones. Progress, pace and forecast come from `goalInsights` (`lib/goalInsights.ts`). A goal reached is celebrated once.
4. **Tasks.** Planned day/time, length, deadline, urgency, difficulty, subtasks, a measure (count or time), and a goal or milestone link.
5. **Streaks.** `streakFrom` in `lib/dayComplete.ts`. Days covered by a streak freeze (`streak_freeze_days`) don't break a run.
6. **Marks (XP).** **Never stored**: they are recomputed from the history.

   | Event | Habit | Task | Goal | Other |
   | --- | --- | --- | --- | --- |
   | Add | +1 | +2 | +5 | |
   | Complete | +5 | +10 | +50 | sleep +20, milestone +30, mission +50 |

   Completing is multiplied by the perfect-day run (×1, then +1 every 7 perfect days, up to ×10). Marks only go up. See `lib/marks.ts`.
7. **Shards (the in-app currency, not real money).** The same ledger with misses counted (habit −2, task −4, goal −15), anti-farming rules and a 100 starter (`lib/shards.ts`):
   - something made and ticked the same day earns 0;
   - a habit ticked more than a day late earns 0;
   - a goal less than 3 days old earns 0;
   - adding things earns at most 10 a day, milestones pay at most twice a day, a day earns at most 200;
   - the server caps earned Shards at 200 per day of account age.

   **Desktop should show the server's numbers (`my_wallet`, `profiles.marks`), not compute its own**, until the ledger is authoritative on the server.
8. **Betting market.** Back a goal (yours or a friend's) with Shards from a shared pool:
   - at most 100 per goal, deadline at least 3 days away;
   - void if reached within a day; missed automatically a day after the deadline.

   Server RPCs only.
9. **Focus timer.** Sessions tied to a habit, with planned and actual seconds, completed or stopped. Totals per day/week/month/year. Local only today.
10. **Brain dump and Speak freely** (`lib/voicePlan.ts`, `lib/voiceClean.ts`). A ramble has its ums removed and is split into tasks, habits and goals; whatever is left unsorted goes to the brain dump. These are pure functions that port directly to desktop.
11. **Echo.** The companion: a personality built at onboarding (chronotype, wake/sleep, sleep need), with memory, patterns and lines. Stored in `personal_backups`.
12. **Community.** Friends, the 24-hour feed of day cards, reactions, Today / This week / Bets, Secret Missions, King of the Week, the crew quest and Exposed. All server-side.
13. **Access.** 14-day free challenge, then $9.99 once. The whole app locks after day 14. The entitlement lives in RevenueCat/App Store on the phone; nothing on the server records it yet (section 5).

---

## 4. How mobile sync works today (`lib/cloudSync.ts`)

The phone is the working copy; the server is the backup, the bridge to other devices, and what friends read.

1. **Upload** every local row with `synced = 0`, in batches of 200 (`upsert`, `onConflict` as above). Goals go before habits. A row is marked synced only if it hasn't changed during the upload. A batch the server rejects is retried row by row, so one bad row never blocks the rest. A column the server lacks is dropped and the table is re-sent later.
2. **Download**, table by table, with **one cursor per table** (the newest server `updated_at` seen). Pages of 1,000 are ordered by `(updated_at, id)`, with `updated_at >= cursor` plus keyset paging. A row that fails to write locally holds that table's cursor back.
3. **Local write rule:** an incoming row replaces the local one **only if the local row has no unsent changes** (`synced = 1`) and its `updated_at` differs. Unsent local edits win and go up next pass.
4. **Shared goals:** after the download, rows belonging to friends that are shared with you are read whole and stored locally under your id. Your done-state on a shared task stays yours.
5. **When it runs:**
   - at sign-in;
   - on returning to the foreground, throttled;
   - about 2.5 s after any change (`lib/livePulse.ts`), which then pings each **friend's** Realtime channel `pulse:<friendId>` (broadcast, payload `{ from }`) so their Community refreshes.

   It never pings the user's own other devices.
6. **Offline:** everything works offline, and changes queue as `synced = 0`.
7. **Conflicts: last writer wins at the server.** There are no revisions or conditional writes, so if the phone and desktop edit the same row before syncing, whichever uploads last wins.
8. `personal_backups` is uploaded after a successful sync when it changed, and restored once per device per account.

---

## 5. What should be shared, and what is needed

### Works with no mobile change (build these first)

- **Mobile habits, goals, tasks and milestones on desktop, editable both ways.** Sign in to the same account, then mirror the four tables with the same algorithm. Each desktop local table gets `synced` (or an outbox), a per-table cursor and soft deletes. Write upserts as soon as the desktop is online to keep the conflict window small.
- **Live updates on desktop.** Subscribe to Supabase Realtime `postgres_changes` on `habits`, `habit_completions`, `tasks` and `goal_milestones` filtered by `user_id=eq.<uid>` (RLS applies), and run a download pass when a change arrives. Keep the cursor pass as the source of truth; Realtime is only a nudge.
- **Server numbers:** Marks, Shards, wallet, streak freezes and Community, all through the RPCs above.

### Needs a mobile change (propose SQL and the mobile change; the owner applies them)

1. **Revisions and conditional writes** before both apps edit the same rows in earnest:
   - add `revision bigint not null default 0` to the four tables, incremented by trigger;
   - clients send the revision they last saw, and a mismatch returns the server row so the client can merge or ask. Field-level merge is fine for most columns; a completion is a set per `(habit, date)`.
   - Both apps must ship this together.
2. **Phone → desktop nudge.** Optional if desktop uses `postgres_changes`: the phone could also broadcast on `pulse:<ownId>` after a sync.
3. **Focus time from desktop.** A new table rather than the old `focus_sessions`:
   - `focus_blocks (id uuid, user_id, device_id, source 'phone'|'desktop', started_at, ended_at, label, habit_id uuid null, task_id uuid null, linked boolean default false, updated_at, deleted_at)`, with RLS for its owner only;
   - the phone would then move its own focus sessions there too, so totals add up across devices.
4. **Settings and Echo as live shared state.** Move them from the single `personal_backups` document into versioned per-key rows (`user_settings (user_id, key, value jsonb, revision, updated_at)`). Until then, desktop reads the backup once and keeps its own settings.
5. **Entitlement on the server.** A RevenueCat webhook → `subscriptions`/`entitlements` row, so desktop can honour the lifetime purchase and the 14-day window. Without it desktop can't know whether the app is unlocked.
6. **Authoritative Shards ledger.** Shards are computed on each phone today, with server caps. Combined stats across devices need the ledger on the server.

### Combined stats

Habits, completions, tasks and goals already merge naturally, because both devices write the same rows. Focus time combines once item 3 exists. Desktop activity time (apps, categories) is a separate, desktop-only stat.

---

## 6. Account and privacy limits

- **Window titles, bundle IDs and per-app intervals never leave the Mac.** Not to Supabase, not into `personal_backups`, not to friends. If cross-device activity stats are ever wanted, send only opt-in **daily aggregates** (minutes per category per day), never titles or app names.
- **Desktop activity never completes a habit or task, and never earns Marks or Shards, unless the user explicitly links it**, for example by choosing "count this focus block toward Read". The `linked` flag records that choice.
- Friends see only what the sharing switches on `profiles` allow, and only through RPCs that check friendship and blocks. Desktop must not query friends' rows directly.
- **One account per device database.** When a different account signs in, clear the local data first; the phone does the same (`clearPersonal`).
- **Account deletion:** `delete_my_account` (RPC) cascades on the server; desktop then wipes its local store.
- Never put secrets in the bundle (publishable key only), and never log tokens.

---

## Mobile files worth reading

| File | Why |
| --- | --- |
| `lib/cloudSync.ts` | The sync algorithm |
| `lib/cloudMapping.ts` | Row conversions and value cleaning (port these) |
| `lib/cloudPullPage.ts` | Stable paging |
| `lib/personalBackup.ts` | What is in `personal_backups` |
| `lib/recurrence.ts`, `lib/habitSchedule.ts` | When a habit is due |
| `lib/dayFlow.ts`, `docs/timeline-rules.md` | The timeline |
| `lib/dayComplete.ts` (`streakFrom`), `lib/goalInsights.ts`, `lib/habitStatus.ts` | Stats |
| `lib/marks.ts`, `lib/shards.ts`, `lib/market.ts` | Marks, Shards, bets |
| `lib/voicePlan.ts`, `lib/voiceClean.ts` | Speak freely |
| `lib/account.ts`, `lib/socialSignIn.ts`, `docs/authentication.md` | Sign-in |
| `supabase/migrations/` | The schema and every RPC |

Scale note: measure concurrently active devices and requests per action, not registered users. Debounce writes, page history, scope Realtime to the signed-in account, and load-test sync before sizing compute. See https://supabase.com/docs/guides/platform/performance.
