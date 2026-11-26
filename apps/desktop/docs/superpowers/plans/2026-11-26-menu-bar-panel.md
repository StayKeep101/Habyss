# Menu Bar Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The menu bar pill and the two-timeline panel from the approved mockup: Now card, week row, day line, Planned (phone timeline/list) beside Tracked (Chronoid blocks with hover detail), quick adds and manual time; Progress/Friends tabs gone; desktop type scale.

**Architecture:** The day comes from `buildDay` (plan `2026-11-26-day-sync.md`, Task 8). The webview pushes the day's slots to Rust, and the existing `habyss-tray` thread picks the pill text each second with the phone's Live Activity rule, so the pill keeps counting while windows are hidden. The panel is one React tree (`src/panel/`) on a shared minute→pixel axis; tracked blocks come from a pure merge over the snapshot's intervals.

**Tech Stack:** Tauri 2 (Rust), React 18 + TypeScript, Vitest + Testing Library, Motion (already a dependency).

**Spec:** `docs/superpowers/specs/2026-11-26-menu-bar-design.md`. Visual reference: `.superpowers/brainstorm/51113-1795701308/content/menubar-v2.html`; phone sources `components/Roadmap/DayTimeline.tsx`, `app/(root)/(tabs)/roadmap.tsx` (list view), `components/Roadmap/TaskItem.tsx`, `components/Home/SwipeableHabitItem.tsx`, `ios/Widget/WidgetLiveActivity.swift`, `lib/scheduledActivities.ts`.

**Depends on:** plan `2026-11-26-day-sync.md` complete.

## Global Constraints

- Panel window `panel`: 780 × 720 logical px, clamped inside the monitor with an 8 px margin, opens under the tray icon.
- Pill: Habyss template icon + countdown text; text empty when nothing is current or next. Focus session wins (spec Builder's calls). Countdown format as the phone's Live Activity: `M:SS` under an hour, `H:MM:SS` from one hour.
- Fonts/colours from `apps/desktop/src/theme/` (Lexend, Space Grotesk for numbers), which mirror the phone's `theme/`.
- Desktop type scale (HIG + Notion/ClickUp): screenTitle 26/32 700, title 20/28 700, heading 15/22 600, body 14/20 400, bodySmall 13/18 400, caption 12/16 400, button 13/18 500. Nothing functional under 11 px.
- Every edit (tick, add, log) goes through existing commands: `cloud_set_completion`, `cloud_set_task_done`, `cloud_save`, plus `log_time` (Task 7).
- Tracked titles/URLs/documents only when `settings.collect_titles`.
- Reduced motion respected (`prefers-reduced-motion`).

## Review Focus

1. **No account / signed out** → Planned shows the sign-in prompt; Tracked, pill (focus only) and Log time still work. Test in Task 3.
2. **Panel opened near the right screen edge or on a 1280-px-wide display** → fully visible, never off-screen. Test in Task 2.
3. **A day with 300+ tiny spans (rapid app switching)** → tracked column stays readable (merged blocks) and renders in < 50 ms. Test in Task 6.
4. **Midnight while the panel is open** → the day, week row and pill move to the new day without reopening. Test in Task 3.
5. **An amount habit's check** (e.g. "Read 30 pages") → opens amount entry instead of ticking 1. Test in Task 4.

---

### Task 1: Pill follows the day (Rust)

**Files:**
- Create: `apps/desktop/src-tauri/src/pill.rs`
- Modify: `src/lib.rs` (tray thread uses `pill::title`; register command), `src/commands.rs`, `src/focus.rs` (keep `tray_title` for the focus case)
- Test: `pill.rs` unit tests

**Interfaces:**
- Produces: `#[derive(Deserialize, Clone)] pub struct PlanSlot { pub key: String, pub title: String, pub start: i64, pub end: i64, pub fixed: bool }` (epoch ms); `#[tauri::command] pub fn set_day_plan(state, slots: Vec<PlanSlot>) -> Result<()>` (stored on `Service` as `plan: Vec<PlanSlot>`); `pub fn title(focus: Option<&FocusSession>, plan: &[PlanSlot], now: i64, settings: &Settings) -> String`.
- Rule (port of `activityPlan`, `lib/scheduledActivities.ts:54`): focus running → `focus::tray_title`. Else the slot with `start <= now < end` → its remaining time; else earliest future slot → time until it starts. `settings.menu_bar_task` appends ` · title` (24-char cut as `tray_title`).

- [ ] **Step 1: Failing tests**: `title(None,&[slot(0,600_000,"Shower")],7_000,..)` = `"9:53 · Shower"`; at 3 h 2 m left → `"3:02:00 · …"`; between slots → countdown to next start; focus present → focus title even when a slot is current; empty plan → `""`.
- [ ] **Step 2: Run** `cargo test pill` → FAIL. **Step 3: Implement**; tray thread calls `pill::title(running, &service.plan, now, &settings)`.
- [ ] **Step 4: Run** → PASS. **Step 5: Commit** `feat(pill): menu bar countdown follows the day like the Live Activity`.

### Task 2: Panel window and plan publisher

**Files:**
- Modify: `apps/desktop/src-tauri/tauri.conf.json` (`panel` 780×720), `src/lib.rs` (positioning uses window outer width, clamps both edges with 8 px), `apps/desktop/src/main.tsx` (panel entry renders `MenuPanel`)
- Create: `apps/desktop/src/panel/position.ts`, `apps/desktop/src/panel/usePlanPublisher.ts`
- Test: `src/panel/position.test.ts`, `src/panel/usePlanPublisher.test.tsx`

**Interfaces:**
- Produces: `export function panelX(iconCenter: number, width: number, monitorLeft: number, monitorRight: number, margin = 8): number` (mirrored in Rust; TS copy exists for the test table); `export function usePlanPublisher(today: Today): void` — invokes `set_day_plan` with not-done timeline items as `PlanSlot` (key `"<kind>:<id>[#part]:<day>"`, `fixed` for meal/event/travel) whenever the slot list changes, and at least once a minute.
- [ ] **Step 1: Failing tests**: `panelX(1270,780,0,1280)` = 492; `panelX(100,780,0,1280)` = 8; publisher calls `set_day_plan` once for identical lists and again when an item is ticked.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** (Rust positioning uses the same formula). **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(panel): wider panel that stays on screen; plan published to the pill`.

### Task 3: Panel shell — Now card, week row, day line, toolbar, shared axis

**Files:**
- Create: `src/panel/MenuPanel.tsx`, `src/panel/NowCard.tsx`, `src/panel/WeekRow.tsx`, `src/panel/DayLine.tsx`, `src/panel/axis.ts`, `src/panel/menuPanel.css`
- Modify: `src/panel/FocusControls.tsx` (folded into `NowCard`), remove `src/panel/TodayPanel.tsx` once nothing imports it (main window right column renders `MenuPanel` with `mode="window"` or is dropped — builder's call per spec)
- Test: `src/panel/MenuPanel.test.tsx`, `src/panel/axis.test.ts`

**Interfaces:**
- Consumes: `buildDay`, `Today`, `tallyDay`.
- Produces: `export interface Axis { from: number; to: number; pxPerMin: number; y(minute: number): number }`; `export function makeAxis(wake: number, sleep: number, pxPerMin = 1.6): Axis` (one scale for items and gaps, as the phone); `MenuPanel` state: `date`, `planView: 'timeline' | 'list'`, `show: 'both' | 'plan' | 'tracked'` (persisted per viewer in localStorage with try/catch).
- NowCard: ring progress = elapsed/length of current item (or focus), title, countdown (same formatter as the pill, exported from `src/panel/countdown.ts`: `countdown(ms: number): string`), check button → completes current item; Start/Pause/Stop focus.
- WeekRow: 7 rings Mon–Sun of the current week, ring = `tallyDay` done/total for that date, today filled; click sets `date`.
- DayLine: `HH:MM–HH:MM` window, "X h Y min left" (sleep − now), coloured bar of the day's items with now marker.

- [ ] **Step 1: Failing tests**: renders title "Shower" and countdown "9:53" for a fixture; check button calls `cloud_set_completion` for a habit; signed out → sign-in prompt in Planned, Tracked still renders; clicking Wed sets the date and the Planned column shows that day; fake timers across midnight → week row/today move; `countdown(3_723_000)` = `"1:02:03"`; `makeAxis(480,1410).y(540)` = 96.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(panel): now card, week, day line on one time axis`.

### Task 4: Planned — timeline view (phone `DayTimeline`)

**Files:**
- Create: `src/panel/PlannedTimeline.tsx`, `src/panel/AmountEntry.tsx`
- Test: `src/panel/PlannedTimeline.test.tsx`

**Interfaces:**
- Consumes: `Axis`, `Today.items` (habits, tasks, meals, events, travel).
- Rendering copied from the phone: round icon (44 px) on a rail, icon stretches into a pill of height `axis.pxPerMin × minutes` (min 44), time range above title, `Urgent`/`Hard` tags (priority 1 / difficulty 3), lock badge for `locked`, link badge for `anchoredTo`, `Now` chip with live `HH:MM:SS`, ring check in the item colour, done items dimmed + struck title. Meals/events/travel render without a check.
- Check: boolean habit/task → toggle via `cloud_set_completion`/`cloud_set_task_done`; amount habit (`unitKind` not boolean) → `AmountEntry` popover (number field, Enter saves `value`).

- [ ] **Step 1: Failing tests**: item of 90 min is 144 px tall at 1.6 px/min; urgent+hard task shows both tags; "Read 30 pages" check opens amount entry and saves 12; meal row has no check; done task title has `text-decoration: line-through`.
- [ ] **Step 2–4:** run → FAIL, implement, run → PASS.
- [ ] **Step 5: Commit** `feat(panel): planned timeline as on the phone`.

### Task 5: Planned — list view

**Files:**
- Create: `src/panel/PlannedList.tsx`
- Test: `src/panel/PlannedList.test.tsx`

**Interfaces:** sections "Tasks" then "Habits", each with "See all" (opens the main window `Calendar` for that date via `open_dashboard`). Task card: checkbox, icon tile, title, due (`Due Fri 4` via `dueLabel`) or `Urgent` flag + bell when it has reminders, length (`lengthLabel`), status `Today` (amber) / `Overdue` (red, `isLate`). Habit card: check circle, icon, name, length.

- [ ] **Step 1: Failing tests**: overdue task shows "Overdue"; due-tomorrow shows "Due …"; tasks section precedes habits; "See all" invokes `open_dashboard` with `{ screen: 'Calendar' }`.
- [ ] **Step 2–4.** **Step 5: Commit** `feat(panel): planned list view as on the phone`.

### Task 6: Tracked column — blocks and hover card

**Files:**
- Create: `src/tracking/blocks.ts`, `src/panel/TrackedTimeline.tsx`, `src/panel/BlockCard.tsx`
- Test: `src/tracking/blocks.test.ts`, `src/panel/TrackedTimeline.test.tsx`

**Interfaces:**
- Consumes: `Interval[]` (snapshot; live span via `liveIntervals` from `src/tracking/usage.ts`), `Axis`, `Today.items`, classifications.
- Produces: `export interface Block { key: string; app: string; bundle: string | null; domain: string | null; title: string; start: number; end: number; activeMs: number; category: string; parts: { label: string; ms: number }[]; switches: number; typingMs: number; longestMs: number }`; `export function mergeBlocks(intervals: Interval[], from: number, to: number, opts?: { foldMs?: number; minMs?: number }): Block[]` — defaults `foldMs = 120_000` (an interruption shorter than this inside the same app's stretch is folded in and counted in `switches`), `minMs = 60_000` (shorter stretches join the neighbouring block's `parts`). Block title = the longest part (document, page or window title; falls back to app/domain). `export function matchItem(block: Block, items: TodayItem[]): TodayItem | null` — the item overlapping the block longest (display only; never ticks).
- Column: blocks at `axis.y(start)`, icon (`AppLogo`), title, duration, up to 3 parts with durations; category strip (unproductive → `--danger`, productive → `--accent`, else `--text-subtle`); red now line shared with Planned.
- BlockCard (hover, 150 ms delay, keyboard focus too): exact span, active time, switches, typing time, matched item, category + class, longest unbroken stretch, deep-work share (`longestMs / activeMs`).

- [ ] **Step 1: Failing tests**: Word 9:00–9:40 with a 60 s Slack interruption → one Word block, `switches = 1`; 300 alternating 20 s spans → ≤ 20 blocks and `mergeBlocks` < 50 ms; a 30 s YouTube visit joins the neighbour's parts; idle intervals never form blocks; hover shows "Matched: ADM2302" for an overlapping task; with `collect_titles=false` titles fall back to app names.
- [ ] **Step 2–4.** **Step 5: Commit** `feat(panel): tracked timeline with hover detail`.

### Task 7: Quick adds and Log time

**Files:**
- Create: `src/panel/QuickAdd.tsx`; Rust: `apps/desktop/src-tauri/src/storage.rs` (`log_time`), `commands.rs`, `src/lib.rs`
- Test: `src/panel/QuickAdd.test.tsx`; `storage.rs` test `manual_entry_is_stored_and_never_overlaps_trimmed`

**Interfaces:**
- `+ Task`: title, date (shown day), optional time, length (default 90), priority, difficulty → `cloud_save('tasks', row)` using `rows.ts` shape. `+ Habit`: name, time of day/start time, length (default 30), days (default every day) → `cloud_save('habits', row)` (full editor out of scope). `+ Log time`: activity name, start–end on the shown date, optional app (picked from today's apps), note → `#[tauri::command] log_time(state, name: String, bundle: Option<String>, start: i64, end: i64, note: Option<String>) -> Result<()>` inserting an interval with `source='manual'`, `state='active'`, title = name (+ note in `interval_details`), rejecting `end <= start` or ranges over 24 h.
- [ ] **Step 1: Failing tests**: adding "Email Prof" saves a task row for the shown date; Log time 14:00–14:30 calls `log_time` with those ms; Rust: manual entry is returned by `intervals()` with `source` manual and survives `commit` idle trimming (trim only deletes `source='macos-native'`).
- [ ] **Step 2–4.** **Step 5: Commit** `feat(panel): add task, habit and manual time from the menu bar`.

### Task 8: Live Activity tip, main window cleanup, type scale

**Files:**
- Create: `src/panel/LiveActivityTip.tsx`
- Modify: `src/types.ts` (`Screen` without `Progress`, `Friends`), `src/shell/Sidebar.tsx`, `src/shell/Shell.tsx` (`COMING`, `SUBTITLE`, `NAV_ALIASES` map `Progress`/`Friends` → `Dashboard`), `src/theme/tokens.ts` (type scale from Global Constraints), `src/theme/tokens.test.ts`, `src/shell/Shell.test.tsx`
- Test: `src/panel/LiveActivityTip.test.tsx`

**Interfaces:**
- Tip: shown once (localStorage `habyss.liveActivityTip`, try/catch) above the Now card: "Seeing Habyss twice? Hide the iPhone one on this Mac." with button "Open Menu Bar settings" → `open_url('x-apple.systempreferences:com.apple.ControlCenter-Settings.extension')` (verify the pane on macOS 27; fall back to Notifications pane) and "Dismiss". Copy for older macOS per spec decision 7.
- [ ] **Step 1: Failing tests**: tip shows on first render, not after Dismiss; sidebar has no Progress/Friends; `resolveScreen('Friends')` → `Dashboard`; tokens body size 14.
- [ ] **Step 2–4.** **Step 5: Commit** `feat: Live Activity tip; Progress and Friends tabs removed; desktop type scale`.

### Task 9: Verify in the running app

- [ ] Run `bun run dev`; with tracking on and an account signed in: pill counts down with the phone's Live Activity (compare side by side); panel opens under the icon at 780 px; switch Timeline/List and Both/Plan/Tracked; tick a habit on desktop → phone shows it after sync; change wake time on the phone → desktop day line updates within seconds; hover a tracked block; Log time appears on the Tracked side.
- [ ] Record results (and any mismatch with the phone) in the PR/commit message; fix before calling it done.
