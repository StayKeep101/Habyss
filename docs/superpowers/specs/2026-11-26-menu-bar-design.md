# Menu bar panel — design

Piece 1 of 5 in the Habyss Desktop rework (order agreed 2026-11-26: menu bar → Tracking tab & Calendar → automatic checking → Dashboard & Analytics → Echo).

## Intent

The owner's picture of a normal day: open the MacBook, glance at the menu bar, see what to do right now and through the day, and see where the time actually went — without opening the main window. The company stance this serves: *very simple on the outside, very complex inside; people should never need to open the app.* The menu bar is where most of Habyss Desktop is used, so it carries the depth.

Habyss Desktop and Habyss Mobile are **the same app** (as Notion, Arc, Discord are on both). The panel must look and behave like the phone's Today screen, not like a desktop reinterpretation of it.

Approved visual reference: `.superpowers/brainstorm/51113-1795701308/content/menubar-v2.html` (owner: "Exactly that is perfect"), plus the owner's phone screenshots of the Today timeline and list views and of the iOS Live Activity.

## What the owner decided

1. **Menu bar item** — the same pill as the phone's Live Activity: Habyss logo + live countdown of the current item (e.g. `9:53`). When nothing is running/current, the logo alone.
2. **Clicking it opens a panel**, top to bottom:
   - **Now card** — the iOS Live Activity, as on the phone: progress ring with the Habyss mark (left), the current item's title and big countdown (centre), a check button (right) that completes it.
   - **Week row** — seven day rings (Mon–Sun) showing each day's completion, today filled, as on the phone. Clicking a day shows that day in the panel.
   - **Day line** — wake–sleep window (`08:00–23:30`), "14 h 37 min left", and the coloured day bar with the now marker, as on the phone.
   - **Toolbar** — `Timeline | List` switch for the planned side; `+ Task`, `+ Habit`, `+ Log time`; `Both | Plan | Tracked` switch.
   - **Two timelines side by side on one shared time axis** (hour labels in a centre column):
     - **Left, Planned** — the phone's Today, in the view chosen: **Timeline** (round coloured icons on a vertical rail; an item's icon stretches into a tall pill in proportion to its duration; time range above the title; `Urgent`/`Hard` tags; lock/link badges; the `Now` clock chip; a ring check circle on the right in the item's colour; done items dimmed) or **List** (a *Tasks* section then a *Habits* section, each with *See all*; task cards with checkbox, icon, title, due/`Urgent`+bell, duration, and `Today` (amber) / `Overdue` (red)).
     - **Right, Tracked** — Chronoid-style: every stretch of time spent in an app or website is a block at its real time, showing the app/site icon, the main title (document, page or window), duration, and under it the top few sub-items with their durations. A thin colour strip on the far edge marks the category (distraction in red). A red "now" line spans both sides.
   - **Hovering a tracked block** shows a detail card with information that is genuinely valuable, e.g. exact span, time without switching away, number of switches, typing time, the planned item it matched, category and productivity class, and deep-work share / longest unbroken stretch.
3. **Add task, add habit and log time manually** from the panel.
4. **Remove** the Progress and Friends tabs from the main window (friends features will live inside habits and tasks later). Goals are removed too, matching the phone (the mobile app dropped goals in its latest commits).
5. **Type sizes** like conventional desktop apps (Notion, Claude, ClickUp), following Apple's Human Interface Guidelines.

6. **The day must be identical on phone and desktop, so the phone-only day inputs sync** (owner, 2026-11-26: "yes they should as it is the same app … the best sync like Notion, ClickUp"). Today the phone keeps these on the device only (AsyncStorage): the wake/sleep window (`lib/echo.ts` `getDayWindow`), swipe-reschedules and pins (`lib/reschedule.ts`), meals, calendar events and travel, the peak-hours inputs, and the active habit. This piece moves them into the cloud data model and changes **both apps** (this repo and `/Users/erwan/Coding/Habyss`) to read and write them there, and re-ports the phone's current `lib/dayFlow.ts` (674 lines; the desktop copy is 356 and out of date). The desktop's hard-coded 07:00–23:00 window goes away. Sync quality bar: the big cross-device apps — local-first (instant locally, works offline), changes appear on the other device within seconds while both are online (the desktop already has a realtime channel, `src-tauri/src/cloud/realtime.rs`), field-level merges so two devices editing different fields never clobber each other, and nothing lost or duplicated after offline edits on both sides.

## Builder's calls (made during design, not decided by the owner — check these)

- **Focus sessions stay.** A running focus session takes over the menu bar pill and the Now card (as the phone's Live Activity follows focus); otherwise the pill follows the timeline's current item. Start/pause/stop focus live in the Now card; `FocusControls` folds into it.
- **Goals are removed end to end**, not just the screens: desktop sync mapping (`src-tauri/src/cloud/mapping.rs`), local schema and `today.ts` goal progress are brought in line with the cloud after `supabase/migrations/20261125000200_remove_goals.sql`, so sync keeps working.
- **Now card between items** shows the next item, as on the phone, including meals and events once they sync (decision 6). For an amount-measured habit the check button opens a small amount entry instead of ticking.
- **Other days** (week row): past days show that day's plan and tracking and can be ticked, as the phone's Roadmap allows; future days show the plan only; rings use the phone's day tally (`tallyDay`). Day logic must therefore build any date, not only "now", and tick/add act on the shown date.

## Goals

- Everything in "What the owner decided", working against real data in the current `desktop-sync` codebase.
- The planned side produces **the same items, order, times and states as the phone** for the same account and day. The desktop already ports the phone's day logic (`apps/desktop/src/shared/dayFlow.ts`, `dayPlan.ts`, `habitSchedule.ts`, `tasks.ts`, `recurrence.ts`; assembled in `apps/desktop/src/today/today.ts`); the panel uses that, never a second implementation.
- Checking, unchecking, adding and logging go through the existing local-first cloud commands (`cloud_save`, `cloud_set_completion`, `cloud_set_task_done` in `src-tauri/src/cloud/commands.rs`) so they reach the phone on the next sync.
- The tracked side is built from the tracking data the app already records (intervals with app, title, URL/domain, document, typing/pointer/meeting/media time, category — see `TRACKING_ENGINE.md`).

## Non-goals (later pieces)

- Automatic checking of tasks/habits from activity or screen understanding (piece 3). The hover card's "matched item" field may show a simple time-overlap guess but must never tick anything by itself in this piece.
- The Tracking tab, Calendar redesign, private-browser exclusion (piece 2).
- Dashboard charts, Analytics (piece 4). Echo (piece 5).
- Full habit editor parity (reminders, places, Health metrics, challenges). The panel's "+ Habit" is a quick add; the full editor comes with the main window later.

## Anti-goals

- A panel that looks like a generic desktop widget instead of the phone's Today screen.
- Two diverging copies of day logic (desktop showing different items/times than the phone).
- Anything that requires opening the main window for the everyday loop (see now, tick, add, glance at tracked time).
- Slow or janky open: the panel must appear instantly on click and stay smooth while ticking every second.

## Constraints

- Tauri 2 app; the panel is the existing `panel` webview window (`tauri.conf.json`, currently 380×640) toggled from the tray icon in `src-tauri/src/lib.rs`; the tray title is already set every second by the `habyss-tray` thread. The current panel UI is `apps/desktop/src/panel/TodayPanel.tsx` (also embedded in the main window's right column).
- The panel needs roughly **780 px wide** for two timelines; it must still fit and position correctly on a 13" display and next to the right screen edge.
- Fonts and colours follow the phone (`/Users/erwan/Coding/Habyss/theme/`: Lexend 400/500/700, Space Grotesk 700 for numbers; tokens in `theme/tokens.ts`, `colors.ts`). The desktop already mirrors these in `apps/desktop/src/theme/`.
- Phone source to port visuals from: timeline `components/Roadmap/DayTimeline.tsx` (+ `NowCard.tsx`, `DayPlanCard.tsx`), list view inline in `app/(root)/(tabs)/roadmap.tsx` with `components/Roadmap/TaskItem.tsx` and `components/Home/SwipeableHabitItem.tsx`, Live Activity `ios/Widget/WidgetLiveActivity.swift`.
- Signed out: the planned side shows the existing sign-in prompt; the tracked side still works.
- Privacy: tracked titles, URLs and documents appear only if window titles are enabled (existing setting).

## Left to the builder

- The cloud shape of the synced day inputs (new tables vs. a per-user settings row, per-field timestamps or revisions), migration of each phone's existing AsyncStorage values on first launch, and the conflict rule per field — within the sync quality bar in decision 6 and `SYNC_ARCHITECTURE.md`.

- Exact panel height, scroll behaviour (the two timelines scroll together, starting near "now"), and how the time axis scales (minutes → pixels) — the phone uses one scale for pills and gaps ("an hour is always twice as tall as half an hour").
- How tracked spans merge into blocks (Chronoid merges consecutive time in one app and folds short interruptions; pick thresholds that keep the column readable at day scale) and which sub-items show.
- The exact hover-card fields beyond the list above, and the colour strip mapping.
- Form fields for the quick adds (phone's `app/add.tsx` quick-add is the reference) and for "Log time" (an app/activity, a start–end, an optional note, stored so it shows on the tracked side marked as manual).
- Whether the main window keeps a right-hand Today column or reuses the new panel component there.
- Type scale values, within "like Notion/Claude/ClickUp" and Apple HIG.
