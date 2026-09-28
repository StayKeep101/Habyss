# Open work

Tracked from the list of 2026-09-26. Sign-in (Apple / Google / email) is
deliberately excluded: it works on the simulator and is not to be touched.

Status: `[ ]` not started · `[~]` in progress · `[x]` done

## Correctness — things the app currently gets wrong

- [x] **Goal progress is wrong.** Fixed: a goal naming a number is now measured
      against that number (`goalTarget` / `contributingHabits` in goalInsights),
      not by schedule adherence. Goals without a number keep adherence.
- [x] **Goal title swallows the deadline.** Fixed: the parser already struck the
      date out, but `buildTitle`'s no-number path fell back to the raw text.
- [~] **The app slows down the longer it runs**, until the build is restarted.
      Partly addressed by the concurrent stability work (see
      docs/stability-report.md: month reports no longer copy large task arrays,
      goal calculations reuse compiled schedules). Not yet confirmed fixed from
      the user's side — still needs a measured before/after over a long session.

## Flows

- [x] Swipe a habit or task left → edit + delete. Past half the row (never less
      than 130pt, so a flick cannot do it) the delete swells, the others
      retreat, a haptic marks the line, and letting go deletes. No dialog.
      Goals still confirm — one swipe should not take a whole plan with it.
- [x] Closing a create/edit sheet: the keyboard pops back up before
      disappearing. Fixed — the modal now outlives `visible` by one slide, so
      the keyboard is dismissed first and nothing is focused at unmount, and the
      card slides down instead of the whole modal fading.
- [x] Habit "choose days": now a cadence — Weekly / Every 2, 3 or 4 weeks /
      Day of month / Yearly — above the weekday grid, which hides itself for
      the cadences that repeat off the start date instead. The schedule engine
      already understood all of these; only the sheet never asked.
- [x] Reminders for habits: a time, how far ahead of the habit it lands
      (on time / 5 / 15 / 30 min before), arrival at a place — the geofences
      were always in the model and in LocationService and nothing ever asked
      for one — and a sentence of your own, which beats Echo's when set.
- [~] The same for tasks. Habits are done; the task sheet still offers only a
      due time.
- [x] Tasks need notifications at all. Already built (`buildTaskReminderPlan`,
      routed to the roadmap, Echo-written bodies, 6 tests). It never fired
      because permission was never requested — fixed with the Settings switch.

## What the cards say

- [x] Habits and tasks show whether a reminder is set (small bell).
- [x] Habits with a measurement show it, as "2 books" not a bare number.
- [x] Tasks show priority as a coloured flag — red high, amber normal, grey low.
      Normal is an outline rather than nothing, so it cannot be read as unset.

## Settings

- [x] Move the day window out of the Echo page — it now sits under Notifications
      as "Your day", which is the page that decides when you are interrupted.
- [x] Echo page: Voice and On Home were vertical lists of full-width rows
      describing options you had not chosen. Both are now chip rows with the
      detail shown only for the one in use. 433 -> 347 lines.
- [x] Card Size. The page was already at /appearance and already held it; only
      its title still said "Theme & accent". Renamed to "Appearance", which is
      what it actually is. (Alternative: a separate page — say the word.)
- [x] Sound and Haptics: one row with two channel toggles instead of two rows.
- [~] Notifications page: day window done, master switch done. Still to do:
      fold the remaining per-type switches into "with or without Echo".

## Moments

- [x] Completing a goal deserves a real celebration. A goal gets the full
      burst — rays, a struck ring, its own name; the day's promise gets a
      quieter version of the same shape, so they read as relatives rather than
      one thing reused. Both claimed once (lib/milestones.ts, 12 tests): a
      goal that crosses 100%, falls back and crosses again is still one goal
      finished once.
- [x] Completing the daily 3 or 5 deserves one too. It yields when the same
      tick also finishes every habit due — the whole day has its own card, and
      two celebrations on one action is worse than either alone.

## Goal detail

- [x] Background image: the 56% dimming and the gradient overlay are gone; the
      panel now casts onto the photo instead. The picture hangs on a canvas
      1.9x the screen, positioned so its middle falls in the strip above the
      panel — so you see its middle, not its sky, and sliding the panel down
      uncovers more photo rather than its edge.

## Profile and social

- [x] A profile page (`app/(root)/profile.tsx`). It shows what a friend would
      see and every part is editable where it sits — no Save button, because a
      profile is not a form. Photo, name, bio, birthday, gender, plus the
      momentum / recovery / finished numbers read from the same place Home
      reads them, and links out to Appearance, Echo and Account.
      Reached from the Home ring and from Settings. `lib/profile.ts` now owns
      the six loose AsyncStorage keys that were read by hand in three places.
      NOTE: `components/Profile/EditProfileModal.tsx` (348 lines) is orphaned
      by this — it was the old save-button modal. Delete when you are happy
      with the page.
- [x] **Daily feed replaces the leaderboard.** One card per person, ordered by
      what was done rather than who anyone is. `Leaderboard.tsx` deleted (315
      lines) — a ranked table answers "who is winning", which rewards whoever
      tracks the least demanding things and makes a bad week public.
      `lib/feed.ts` + `lib/proof.ts`, 24 tests; `DayCard`, 9 tests.
- [x] **Proof-backed completions.** Three tiers in `lib/proof.ts`, per your
      call: verified (Health recorded it) > timed (a focus session ran for it)
      > logged (your word, and the honest default). The friend-vouches tier was
      dropped. `lib/evidence.ts` computes it for real from `healthKitMetric`
      and the timer's saved sessions — your own feed card carries true
      evidence today; a friend's needs the migration. 20 tests.
      Counted rather than crowned: one verified among nine ticks reads
      "1 of 4 backed", not a single badge that flatters the day.
      **Decision taken: feed-only.** Completion, streaks, momentum and recovery
      are untouched — tying "done" to evidence everywhere would change every
      number in the app and punish habits that cannot be proved.
- [x] Reactions. Five, one tap, tap again to take back — and they **reach the
      friend** now: `feed_reactions` holds one per pair per day, so a second
      reaction replaces the first because that is the table's primary key rather
      than a rule written in the app. Still written to the device as well, so
      the feed does not lose its answer while the insert is in flight; the
      server wins on the next load, since it knows what was sent from any
      device.
- [x] Comments on a day (`lib/dayNotes.ts`, 15 tests). The reaction row ends
      with a bubble that opens a composer, and what has been said sits under it
      with the writer's name; you can take back your own. Five emoji cannot ask
      "how was the long run", so a word can.
      They reach the person now, through `feed_comments`. A note that cannot be
      sent — signed out, or the insert failed — is kept on the device, marked
      pending, drawn with a quiet "· sending", and sent on the next visit, then
      dropped from the device so it is never held in two places. The server's
      rows are the truth and `mergeNotes` puts anything still waiting after
      them, so nothing is ever shown twice. Notes are kept per day.
- [ ] Messages and emoji between friends. **Blocked, and deliberately not
      faked.** Notes on a day could be kept locally because a note is still a
      record of what you thought; a message that never leaves the phone is a
      conversation with nobody. This needs a `friend_messages` table with RLS
      scoped to the two people in it, which means the migration below has to be
      applied first — say the word and it goes in the same one.
- [~] Shared habits **and tasks**: the rule is built and tested (`lib/shared.ts`,
      12 tests) — not done until everyone on it has done it, two people or
      five — and surfaced on the habit page as who is on it, who it is waiting
      on, and a tick per person. Task sharing needs the `shared_tasks` table in
      the migration; the rule itself is already indifferent to which it is.
      **Streaks deliberately untouched.** Tying your run to someone else's
      behaviour is a much heavier promise than it sounds: one friend's quiet
      week would end a streak you kept perfectly. That should be a decision
      taken on purpose, not one that arrives with a feature — say the word.
      **Data caveat:** the server answers "did they do anything today", not
      "did they do this". The rule is right; its input is approximate until the
      feed migration adds per-habit completion.

## Done

- [x] Remove the music integration. SpotifyPage, spotifyService, MusicService,
      the habit-detail Music tab and the integrations entry are all gone.

## Waiting on you

- [x] **All three migrations applied, 2026-09-27.**
      `20260926_habit_reminder_message.sql`,
      `20260927_feed_reactions_and_proof.sql` and a new
      `20260927_habit_recurrence.sql`. The feed migration needed two
      corrections before it would run: `shared_completions.item_id` and
      `shared_tasks.task_id` were declared `text`, and every id they can hold is
      a `uuid` on this server, so the RLS policy comparing them failed with
      `operator does not exist: uuid = text`; and the new tables were pointed at
      `auth.users`, where every other social table on this project points at
      `profiles`. Four tables, RLS on, policies attached, and PostgREST can see
      all four.
      `reminder_message` and `recurrence` are now in `cloudMapping.ts` in both
      directions — until this, a habit that repeats on the third Sunday of every
      second month came back from a restore as whatever the legacy weekday
      columns alone describe.

## Launch crash on device — diagnosis in progress (2026-09-26)

Reported: the app loads on the phone, then crashes. **Not reproduced.**

Ruled out so far:
- **Not a bundling/module error.** `npx expo export --platform ios` builds the
  full 10MB bundle clean.
- **Not the new schema column.** `habitToRemote` in cloudMapping enumerates
  columns explicitly, so `reminder_message` is never uploaded; sync is
  unaffected by local schema v11.
- **Not reproducible in the simulator.** Launched on iPhone 18 Pro (iOS 27) —
  the app starts and keeps running, no fatal lines in the device log.
- **Not an obvious native fault in SharedDefaults.** No force unwraps, `as!`,
  `try!` or `fatalError`; every path guards its optionals.

Still open, in order of suspicion:
1. **The simulator build is old** — it predates SharedDefaults being added to
   the Xcode target, so it still falls back to the JS mock. A freshly built app
   runs that Swift for the first time. A device build is needed to reproduce.
2. **`runtimeVersion` changed** from a static iOS `"1.0.0"` to the `fingerprint`
   policy. A phone holding a build made under the old value, with expo-updates
   configured, is worth eliminating.
3. **Device-only native paths** the simulator never runs: HealthKit sync on
   launch, geofence registration, ActivityKit.

**What would settle it in one step:** the crash report. On the phone,
Settings → Privacy & Security → Analytics & Improvements → Analytics Data,
find `Habyss-…​.ips` from the time it crashed and send it over. That names the
thread and the frame, and turns this from elimination into a fix.
