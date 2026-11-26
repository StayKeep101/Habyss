# App Foundation (Plan 2a) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Habyss Desktop the premium look from the concept, using the phone's design system. This plan adds:
- the three-column app layout;
- the right panel and menu-bar panel (Focus Mode, Due Today, Up Next, Today at a Glance);
- a focus timer with pause and a menu-bar title;
- the Dashboard, all on real synced and tracked data.

**Architecture:**
- **Design system.** The phone's tokens (`~/Coding/Habyss/theme/*.ts`) are ported to `src/theme/tokens.ts` and emitted as CSS custom properties per theme. Screens use only those variables and a small set of primitives in `src/ui/`.
- **Pure TS models.** A pure model `src/today/today.ts` turns `cloud_data` plus the activity snapshot into everything the panel and Dashboard show, using the Plan 1 shared rules in `src/shared/`. A pure `src/dashboard/stats.ts` does the range aggregations. React components only render these models.
- **Rust focus engine.** The focus engine gains pause, resume and a linked item, and a 1 s ticker sets the tray title.

**Tech Stack:**
- Existing: Tauri 2, Rust, React 19, TypeScript, Vitest with jsdom and @testing-library/react, Tailwind 4 (already installed), motion.
- New npm packages:
  - `@fontsource/lexend` and `@fontsource/space-grotesk`, for bundled fonts (no network, CSP stays `'self'`);
  - `react-icons`, using only its `io5` set, which is Ionicons, the phone's icon source.

**Spec:** `docs/superpowers/specs/2026-11-02-desktop-app-design.md`, which builds on `docs/superpowers/specs/2026-11-02-desktop-sync-design.md`. Mobile reference, read-only: `~/Coding/Habyss` (theme/, components/ui/, docs/UI_CONSISTENCY.md, docs/motion-system.md).

## Global Constraints

- **Visual target:** `/Users/erwan/Downloads/Habyss Dark Mode Productivity Dashboard.png`. Default theme `abyss`; `trueDark` and `light` are also supported.
- **Tokens only:** screens use CSS variables from `src/theme/`, never raw colours or sizes. These are the phone's exact values:
  - Radii: small 12, control 18, card 22, sheet 24, pill 999.
  - Spacing: xs 4, sm 8, md 12, lg 16, xl 20, xxl 24, section 32.
  - Fonts: Lexend in weights 400, 500 and 700 only. Space Grotesk 700 only for brand and large display numbers.
  - Motion durations: tap 120, quick 180, base 260, exit 190, emphasis 420. Nothing bounces. Honour `prefers-reduced-motion`.
  - Abyss surfaces: fill `#111113`, top `#18181B`, bottom `#0C0C0E`, raised `#1C1C1F`, lip `rgba(255,255,255,0.06)`, line `rgba(255,255,255,0.05)`.
  - Abyss colours: background `#050505`, accent `#8EB0FF`, textPrimary `#F4F5F7`, textSecondary `#A3A3AD`, textTertiary `#8A8A94`, success `#2FE3A1`, warning `#FFB020`, error `#FF4757`.
- **Icons:** only through `AppIcon` (react-icons `io5`). Outline icons for actions, filled for selected or done. Icon buttons have an `aria-label` and a hit target of at least 44 px.
- **No mock data.** Every number comes from `cloud_data`, `cloud_rpc`, `snapshot`, or local focus sessions. Where data is missing, show an empty state or "–", never an invented value.
- **Rules come from the shared code:** the day layout from `flowDay`/`flowInputs`, due-ness from `isHabitScheduledForDate`, the streak from `streakFrom`, goal % from `goalProgress`. Never re-derive them.
- **Focus Mode** only starts and stops the focus timer. Paused time never counts as focus.
- **Activity data never leaves the Mac.**
- **Local migrations:** they follow the pattern in `src-tauri/src/storage.rs`. `user_version` stays 1, and each additive migration records its number in `schema_migrations`.
- **Rust style** matches the existing dense style. TS style matches `src/`.
- **Disk space is tight:** never `cargo clean`, and no release builds.
- **Commit** on branch `desktop-sync`.

## Review Focus

1. **Signed out, or sync not set up.** The Dashboard and panel still render tracking data. Habit and goal areas show a sign-in prompt, not zeros. Tested in Task 6.
2. **Midnight while open.** "Today" rolls to the new day without a restart, in the timeline, Due Today and the streak. Tested in Task 3 with `today` as an injected value.
3. **A focus session paused when the app quits.** On restart it recovers as interrupted, with paused time excluded. Tested in Task 4.
4. **A day with nothing scheduled and nothing tracked.** Every card shows its empty state, and "Productive" shows "–". Tested in Tasks 3 and 7.
5. **Unticking from the panel.** It syncs (`cloud_set_completion` with `value: null`), and the item moves back to open immediately (optimistic), then refreshes on `cloud-changed`. Tested in Task 5.

---

### Task 1: Design tokens, fonts and icons

**Files:**
- Create:
  - `apps/desktop/src/theme/tokens.ts`: the port of the phone's `colors.ts` (abyss, trueDark, light), `designSystem.ts` (Surfaces, Radius, Spacing, Control, Typography, Elevation) and `motion.ts` (DURATION, cubic-bezier easings), as plain TS constants with values copied exactly.
  - `apps/desktop/src/theme/css.ts`
  - `apps/desktop/src/theme/fonts.css`
  - `apps/desktop/src/ui/AppIcon.tsx`
- Modify:
  - `apps/desktop/src/styles.css`: replace the hand-made `:root` palette with `@import` of fonts and the generated variables. Remap existing class colours to the new variables, so current screens keep working.
  - `apps/desktop/src/main.tsx`: call `applyTheme`.
  - `apps/desktop/package.json`: add the new packages.
- Test: `apps/desktop/src/theme/tokens.test.ts`

**Interfaces:**
- Produces:
  - `export type ThemeName = 'abyss' | 'trueDark' | 'light'`
  - `export function cssVars(theme: ThemeName): Record<string, string>`. Keys are `--bg`, `--surface`, `--surface-top`, `--surface-bottom`, `--surface-raised`, `--lip`, `--line`, `--text`, `--text-muted`, `--text-subtle`, `--accent`, `--success`, `--warning`, `--danger`, `--radius-small|control|card|sheet|pill`, `--space-xs…section`, `--dur-tap|quick|base|exit|emphasis`, `--ease-enter|exit|move`, `--shadow-card|control|floating`, `--font-body` ("Lexend") and `--font-display` ("Space Grotesk").
  - `export function applyTheme(theme: ThemeName, root?: HTMLElement): void`. This sets every variable and `data-theme` on `document.documentElement`.
  - The existing setting `appearance` ('dark'|'light'|'system') maps to theme as: dark→abyss, light→light, system→`prefers-color-scheme`.
  - `export function AppIcon({ name, size, filled, label }: { name: IconName; size?: number; filled?: boolean; label?: string }): JSX.Element`. `IconName` is a union of the glyphs used in Plan 2a: home, calendar, trending-up, stats-chart, people, person, settings, hourglass, flame, checkmark-circle, ellipse, play, pause, stop, play-skip-forward, chevron-back, chevron-forward, add, timer, desktop, sparkles, cube, heart, wallet, moon and sync. It maps to the `Io…`/`Io…Outline` components.

- [ ] **Step 1: Write failing tests**

```ts
it('abyss surfaces and colours are the phone values', () => {
  const v = cssVars('abyss');
  expect(v['--bg']).toBe('#050505'); expect(v['--surface']).toBe('#111113');
  expect(v['--surface-top']).toBe('#18181B'); expect(v['--accent']).toBe('#8EB0FF');
  expect(v['--radius-card']).toBe('22px'); expect(v['--radius-control']).toBe('18px');
  expect(v['--dur-base']).toBe('260ms'); expect(v['--font-body']).toContain('Lexend');
});
it('every theme defines the same variable names', () => {
  const keys = (t: ThemeName) => Object.keys(cssVars(t)).sort();
  expect(keys('light')).toEqual(keys('abyss')); expect(keys('trueDark')).toEqual(keys('abyss'));
});
it('applyTheme writes variables and data-theme', () => { /* jsdom root; assert style.getPropertyValue('--surface') and dataset.theme */ });
it('AppIcon has an accessible label when given one, and is hidden otherwise', () => { /* render; getByLabelText / aria-hidden */ });
```

- [ ] **Step 2: Run** `bun run test src/theme`. Expected: fail, because the modules are missing.
- [ ] **Step 3: Implement**, then `bun add @fontsource/lexend @fontsource/space-grotesk react-icons` from `apps/desktop`. `fonts.css` imports only `@fontsource/lexend/400.css`, `500.css` and `700.css`, plus `@fontsource/space-grotesk/700.css`.
- [ ] **Step 4: Run** `bun run test` and `bun run check`. Expected: pass. Existing screens still render: run `bun run dev`, or rely on the existing tests.
- [ ] **Step 5: Commit** with the message `feat(ui): phone design tokens, fonts and icons`.

---

### Task 2: UI primitives and Abyss art

**Files:**
- Create in `apps/desktop/src/ui/`:
  - `Card.tsx`: the matte surface. A vertical gradient from `--surface-top` to `--surface-bottom`, a 1 px top `--lip`, radius `--radius-card` and `--shadow-card`. Optional `title`, `action` and `aside` props.
  - `StatTile.tsx`: an icon, a big value in `--font-display` and a label, as in the concept's stat row.
  - `Segmented.tsx`: Today/Week/Month/Year and Scheduled/Activity style.
  - `ProgressBar.tsx`
  - `Donut.tsx`: SVG.
  - `IconButton.tsx`
  - `Button.tsx`: primary, quiet and danger variants. Minimum height 36 on desktop. The phone uses 54 for touch, so this is a ruled desktop adaptation; note it in a comment.
  - `Tag.tsx`: productive, unproductive or neutral, with the success, danger or muted tone.
  - `Empty.tsx`
  - `AbyssArt.tsx`: an inline SVG eclipse with a glowing ring and a mountain silhouette, resolution independent, decorative and `aria-hidden`. Sizes are `hero` (dashboard header) and `badge` (sidebar foot).
  - `index.ts`
  - `ui.css`: classes that use only theme variables.
- Test: `apps/desktop/src/ui/ui.test.tsx`

**Interfaces:**
- Consumes: Task 1 (`AppIcon` and the variables).
- Produces, all exported from `src/ui/index.ts`:
  - `Card({title?, action?, children, className?})`
  - `StatTile({icon: IconName, value: string, label: string})`
  - `Segmented<T extends string>({options: T[], value: T, onChange(v:T)})`, which renders `role="tablist"` and buttons with `aria-selected`
  - `ProgressBar({value: number /*0..100*/, label?: string})`, with `role="progressbar"` and clamped values
  - `Donut({slices: {label:string; value:number; color?:string}[], center: string, caption?: string})`
  - `IconButton({icon, label, onClick, filled?})`
  - `Button({variant?: 'primary'|'quiet'|'danger', ...})`
  - `Tag({tone: 'productive'|'unproductive'|'neutral'})`, which renders the text "Productive", "Unproductive" or "Neutral"
  - `Empty({children})`
  - `AbyssArt({size: 'hero'|'badge'})`
  - `export function donutArcs(values: number[], radius: number): { start: number; end: number }[]`, pure, in `Donut.tsx`

- [ ] **Step 1: Write failing tests:**
  - `donutArcs([1,1,2], r)` gives arcs covering 25%, 25% and 50% that sum to a full circle.
  - `donutArcs([])` and all-zero inputs give `[]`, and Donut then shows only the centre text.
  - `ProgressBar` clamps -5 to 0 and 140 to 100, and sets `aria-valuenow`.
  - `Segmented` calls `onChange` with the clicked option and marks it `aria-selected`.
  - `Tag` shows "Productive" for `productive`.
  - `IconButton` without a label is a TypeScript error (type-level), and with one it is reachable by role and name.
- [ ] **Step 2: Run** `bun run test src/ui`. Expected: fail.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `bun run test` and `bun run check`. Expected: pass.
- [ ] **Step 5: Commit** with the message `feat(ui): matte primitives and abyss art`.

---

### Task 3: The today model

**Files:**
- Create:
  - `apps/desktop/src/today/today.ts`
  - `apps/desktop/src/today/useCloud.ts`
- Test: `apps/desktop/src/today/today.test.ts`

**Interfaces:**
- Consumes:
  - Plan 1 types `CloudData`, `HabitRow`, `TaskRow`, `CompletionRow`, `MilestoneRow`, `SyncStatus` (`src/types.ts`).
  - Shared rules:
    - `rowToHabit`, `rowToTask` (`shared/rows.ts`)
    - `isHabitScheduledForDate`, `localDateKey` (`shared/habitSchedule.ts`)
    - `flowInputs`, `flowDay`, `upNext` (`shared/dayFlow.ts`)
    - `streakFrom`, `tallyDay` (`shared/dayComplete.ts`)
    - `goalProgress`, `linkedHabits` (`shared/goalInsights.ts`)
- Produces:
  - `export interface TodayItem { id: string; kind: 'habit'|'task'; title: string; done: boolean; skipped: boolean; start: number; end: number; state: 'done'|'now'|'next'|'later'; locked: boolean; icon?: string; color?: string; goalId?: string }`
  - `export interface GoalSummary { id: string; name: string; percent: number; icon?: string; color?: string }`
  - `export interface Today { day: string; items: TodayItem[]; current: TodayItem | null; next: TodayItem | null; done: number; total: number; streak: number; goals: GoalSummary[]; goalsDone: number; goalsTotal: number; signedIn: boolean }`
  - `export function buildToday(data: CloudData | null, opts: { now: Date; signedIn: boolean; window?: { wake: number; sleep: number } }): Today`. The window defaults to `{wake: 420, sleep: 1380}`.
    - Habits are those not archived, not goals, not deleted, and scheduled for `localDateKey(now)`.
    - Tasks are open or done with `due_date` = today, plus done-today tasks.
    - Completion maps are built from `completions` (`deleted=0`; `skipped` separately).
    - The layout comes from `flowDay(flowInputs({...}), minuteOfDay(now), window)`.
    - The streak uses `streakFrom(habits, tasks, history, skips, today)`.
    - Goals are `is_goal=1` and not archived. Percent comes from `goalProgress`, sorted by percent descending. `goalsDone` counts goals at 100%.
    - With `data === null` or `!signedIn`, return empty items with `signedIn` false.
  - `export function useCloud(): { data: CloudData | null; status: SyncStatus | null; refresh(): Promise<void>; setLocal(mutate: (d: CloudData) => CloudData): void }`. This does `invoke('cloud_data', {completionsSince: <today minus 400 days>})` and `invoke('cloud_status')`, then re-fetches on the `cloud-changed` and `sync-status` events (cancelled/dispose pattern) and when the window becomes visible. `setLocal` applies an optimistic change.

- [ ] **Step 1: Write failing tests** with in-file row factories. The `today` value is injected through `opts.now`.
  - `scheduled_habits_and_due_tasks_make_the_day`: a daily habit, a habit scheduled only on another weekday, a task due today and a task due tomorrow. Only the first and third appear.
  - `ticked_habit_is_done_and_counts`: `done==1` and `total==2`.
  - `current_is_the_item_on_now`: with `now` inside the task's block, `current.id` is the task and `next` is the following item.
  - `midnight_rolls_the_day`: the same data at 23:59 and at 00:01 the next day gives different `day` values and recomputed items.
  - `streak_matches_shared_rule`: equals `streakFrom` called directly on the same inputs.
  - `goals_sorted_by_progress_and_counted`.
  - `signed_out_gives_empty_model`: `signedIn:false` gives `items:[]`, `streak:0` and `goals:[]`.
  - `deleted_and_archived_are_ignored`.
- [ ] **Step 2: Run** `bun run test src/today`. Expected: fail.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `bun run test` and `bun run check`. Expected: pass.
- [ ] **Step 5: Commit** with the message `feat(today): today model from synced data`.

---

### Task 4: Focus engine with pause, linked item and tray title

**Files:**
- Create: `apps/desktop/src-tauri/migrations/003_focus.sql`. It adds to `focus_sessions` the columns `paused_ms INTEGER NOT NULL DEFAULT 0`, `paused_at INTEGER`, `item_id TEXT` and `item_kind TEXT`, guarded so it can run repeatedly, and records version 3 in `schema_migrations`.
- Modify:
  - `src-tauri/src/storage.rs`: run 003 after 002, and update the `focus` select and insert.
  - `src-tauri/src/models.rs`:
    - `FocusSession` gains `paused_ms: i64`, `paused_at: Option<i64>`, `item_id: Option<String>` and `item_kind: Option<String>`.
    - `Settings` gains `menu_bar_timer: bool` (default true) and `menu_bar_task: bool` (default true).
  - `src-tauri/src/commands.rs`:
    - `start_focus(label, minutes, item_id: Option<String>, item_kind: Option<String>)`, keeping the existing validation;
    - new `pause_focus()` and `resume_focus()`;
    - `stop_focus()` ends a paused session, adding the open pause first.
  - `src-tauri/src/lib.rs`:
    - register the commands;
    - a `habyss-tray` thread that, every 1 s, locks the service briefly, computes the title and calls `tray.set_title(...)` only when the title changed;
    - the deep link `habyss://focus` opens the Dashboard.
  - `src/types.ts` and `src/analytics.ts`: focus overlap excludes paused time.
- Test: in `storage.rs` and in a new `src-tauri/src/focus.rs`.

**Interfaces:**
- Produces, in `focus.rs`:
  - `pub fn focus_elapsed(s:&FocusSession, now:i64)->i64`: elapsed active ms = `(end or now) − start − paused_ms − (now − paused_at if paused)`, floored at 0.
  - `pub fn focus_remaining(s:&FocusSession, now:i64)->i64`: `target_ms − elapsed`, floored at 0.
  - `pub fn tray_title(s:Option<&FocusSession>, now:i64, settings:&Settings)->String`:
    - `""` when there is no running session or `!menu_bar_timer`;
    - otherwise `"MM:SS"` of remaining time;
    - plus `" · <label>"` when `menu_bar_task` is set and the label is not empty, with the label truncated to 24 chars with "…";
    - a paused session shows `"⏸ MM:SS"`.
- Produces, in `storage.rs`: `Store::pause_focus(now)`, `Store::resume_focus(now)` and `Store::start_focus(label,target,now,item_id,item_kind)`.
- Produces, in Rust and TS: `Snapshot` gains `classifications: HashMap<String,String>`, a category id → `productive|neutral|unproductive` map from the `categories` table, so the panel and Dashboard can compute Productive. Add a test `snapshot_includes_classifications`.
- Produces, in TS: `FocusSession` gets `paused_ms`, `paused_at`, `item_id` and `item_kind`. `analytics.ts` `metrics` counts declared focus with paused time excluded: a running pause is excluded from `paused_at` to now.
- Behaviour:
  - A running session whose remaining time reaches 0 is completed automatically by the ticker, at `start + target + paused_ms`.
  - Crash recovery: the existing "interrupted at checkpoint" rule also closes an open pause at the checkpoint.

- [ ] **Step 1: Write failing tests:**
  - Rust `focus.rs`:
    - `elapsed_excludes_pauses`: start 0, paused_ms 60000, now 300000 gives 240000.
    - `paused_session_stops_counting`: paused_at 100000, now 400000, paused_ms 0, start 0 gives 100000.
    - `title_formats`: 1500000 ms remaining gives `"25:00 · Deep Work"`. With `menu_bar_task=false` it gives `"25:00"`. Paused gives `"⏸ 25:00 · Deep Work"`. No session gives `""`.
    - `long_label_truncates`.
  - Rust `storage.rs`:
    - `pause_resume_accumulates`
    - `stop_while_paused_closes_pause`
    - `recovery_closes_open_pause_at_checkpoint`
    - `migration_003_idempotent_records_3_and_keeps_user_version_1`
    - `old_rows_get_zero_paused_ms`
  - TS `analytics.test.ts`: `declared_focus_excludes_paused_time`.
- [ ] **Step 2: Run** `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml focus storage` and `bun run test src/analytics`. Expected: fail.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the full `cargo test`, `bun run test` and `bun run check`. Expected: pass.
- [ ] **Step 5: Commit** with the message `feat(focus): pause, linked item and menu bar title`.

---

### Task 5: Today panel, used in the menu bar and the main window

**Files:**
- Create:
  - `apps/desktop/src/panel/TodayPanel.tsx`
  - `apps/desktop/src/panel/FocusControls.tsx`
  - `apps/desktop/src/panel/panel.css`
- Modify:
  - `apps/desktop/src/App.tsx`: the `panel` branch renders `<TodayPanel mode="menubar"/>`.
  - `src-tauri/tauri.conf.json`: the panel window becomes 380×640.
- Test: `apps/desktop/src/panel/TodayPanel.test.tsx`

**Interfaces:**
- Consumes:
  - `buildToday`, `useCloud`, `TodayItem` (Task 3);
  - the primitives (Task 2);
  - the Task 4 commands `start_focus{label,minutes,itemId,itemKind}`, `pause_focus`, `resume_focus`, `stop_focus`;
  - `snapshot` (existing);
  - the Plan 1 commands `cloud_set_completion{habitId,date,value,skipped,memo,evidence}`, `cloud_set_task_done{id,done}` and `cloud_save{table:'tasks',row}`.
- Produces: `export function TodayPanel({ mode }: { mode: 'menubar' | 'window' }): JSX.Element`. Its sections, in order:
  1. **Header:** an hourglass icon and "Focus Mode", with a switch. On means `start_focus` with the current item's title, otherwise "Focus", plus a 25 minute preset and the item's id and kind. Off means `stop_focus`.
  2. **`Segmented` Today | Timeline.**
     - Today shows "Due Today · done/total" with a `+` that adds a task due today from an inline input. Rows have a check circle that ticks or unticks optimistically and calls the command; a done row is struck through.
     - Timeline shows the items with their time range from `start`/`end`, with the `now` item highlighted and a "Now" tag.
  3. **"Up Next":** the current item, or else the next one, with its time range. A play button starts focus on it.
  4. **"Today at a Glance":**
     - Focus Time: today's declared focus with pauses excluded (`metrics`);
     - Screen Time: today's active time;
     - Productive: productive ÷ active using `categories.classification`, or "–" when no classified time;
     - Tasks: done/total.
  - Signed out: sections 2 and 3 show "Sign in to see your habits and tasks" with a button that opens Settings. Focus Mode and the glance still work.
  - `mode="window"` renders the same content in the right column, with a collapse button.

- [ ] **Step 1: Write failing tests.** Mock `invoke` and `listen`, and feed `cloud_data` fixtures.
  - `shows_due_count_and_rows`
  - `ticking_a_habit_calls_set_completion_and_strikes_it`: optimistic, before the promise resolves.
  - `unticking_sends_null_value`
  - `task_tick_calls_set_task_done`
  - `focus_switch_starts_with_current_item`: args include `itemId` and `minutes: 25`.
  - `focus_switch_off_stops`
  - `plus_adds_task_due_today`: `cloud_save` with `{title, due_date: today}`.
  - `signed_out_shows_prompt_but_glance_still_renders`
  - `productive_shows_dash_without_classified_time`
- [ ] **Step 2: Run** `bun run test src/panel`. Expected: fail.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `bun run test` and `bun run check`. Expected: pass.
- [ ] **Step 5: Commit** with the message `feat(panel): today panel for menu bar and window`.

---

### Task 6: App shell with three columns

**Files:**
- Create:
  - `apps/desktop/src/shell/Shell.tsx`
  - `apps/desktop/src/shell/Sidebar.tsx`
  - `apps/desktop/src/shell/shell.css`
- Modify:
  - `apps/desktop/src/App.tsx`: the main window renders `<Shell/>`. Onboarding is unchanged.
  - `apps/desktop/src/types.ts`: `Screen = 'Dashboard'|'Calendar'|'Progress'|'Analytics'|'Friends'|'Profile'|'Settings'`.
  - `src-tauri/tauri.conf.json`: the main window gets a minimum of 1180×760. Add macOS sidebar vibrancy via `windowEffects` (`sidebar`) with a transparent window background. The sidebar CSS falls back to `--surface` when vibrancy is unavailable.
- Test: `apps/desktop/src/shell/Shell.test.tsx`

**Interfaces:**
- Consumes: the primitives (Task 2), `TodayPanel` (Task 5), and the existing `SettingsView`, `Timeline` and Applications/Analytics content.
- Produces: `Shell({ data: Snapshot, act: Act })`.
  - **Sidebar:** the brand (hourglass and "Habyss" in the display font), then the nav: Dashboard (home), Calendar (calendar), Progress (trending-up), Analytics (stats-chart), Friends (people), a divider, Profile (person) and Settings (settings). The selected item gets the raised surface. The foot shows `AbyssArt badge`, "The Abyss" and "Rise Higher.", then the sync dot and the tracking control from Plan 1.
  - **Centre:** the selected screen.
    - Dashboard is Task 7. Until Task 7 lands it is the current dashboard content.
    - Calendar shows the existing `Timeline`, which is reworked in Plan 2b.
    - Analytics shows the existing Applications table and Analytics charts.
    - Settings shows `SettingsView`.
    - Progress, Friends and Profile show an `Empty` that names what arrives in Plan 2c, for example "Goals and roadmaps arrive here soon." No numbers.
  - **Right column:** `<TodayPanel mode="window"/>`, collapsible, with the state remembered in `localStorage` inside try/catch.
  - The keyboard shortcut ⌘, still opens Settings. ⌘1 to ⌘7 select the tabs.
  - The `navigate` event accepts the new names. The old `Focus` and `Timeline` names map to Dashboard and Calendar.

- [ ] **Step 1: Write failing tests:**
  - `sidebar_lists_seven_tabs_in_order`
  - `clicking_tab_switches_screen`
  - `cmd_number_switches_tab`
  - `navigate_event_maps_old_names`
  - `right_panel_collapses_and_remembers`
  - `signed_out_shell_still_shows_activity`: the Calendar tab renders the Timeline.
- [ ] **Step 2: Run** `bun run test src/shell`. Expected: fail.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `bun run test` and `bun run check`. Expected: pass. Then `cargo test`, because the Rust config changed.
- [ ] **Step 5: Commit** with the message `feat(shell): three-column app shell`.

---

### Task 7: Dashboard

**Files:**
- Create:
  - `apps/desktop/src/dashboard/stats.ts`
  - `apps/desktop/src/dashboard/Dashboard.tsx`
  - `apps/desktop/src/dashboard/dashboard.css`
- Modify: `apps/desktop/src/shell/Shell.tsx`, so the Dashboard tab renders `<Dashboard/>`.
- Test:
  - `apps/desktop/src/dashboard/stats.test.ts`
  - `apps/desktop/src/dashboard/Dashboard.test.tsx`

**Interfaces:**
- Consumes:
  - `buildToday`, `useCloud` (Task 3);
  - the primitives (Task 2);
  - `FocusControls` (Task 5);
  - `metrics`, `dayRange`, `duration` (`analytics.ts`);
  - `snapshot` with `from`/`to`;
  - `cloud_rpc{name:'profile', args:{}}`, which returns `Cached<{display_name?:string; username?:string}[] | object>`.
- Produces, in `stats.ts`:
  - `export type Range = 'Today'|'Week'|'Month'|'Year'`
  - `export function rangeBounds(range: Range, now: Date): [number, number]`: local calendar boundaries. A week starts Monday. Month and Year are calendar month and year. The end is now.
  - `export function greeting(now: Date): 'Good Morning'|'Good Afternoon'|'Good Evening'`: 05–11, 12–17, otherwise evening.
  - `export function allocation(intervals: Interval[], from:number, to:number, now:number): {label:string; value:number}[]`: active time by category, largest first. Slices under 5% fold into "Other". It returns at most 5 slices plus Other.
  - `export function productivePercent(intervals: Interval[], classes: Record<string,'productive'|'neutral'|'unproductive'>, from:number, to:number, now:number): number | null`: `null` when the active time is 0 or nothing is classified non-neutral.
  - `export function tasksInRange(tasks: TaskRow[], from: string, to: string): { done: number; total: number }`: total is tasks due in the range, and done is those completed within it.
- `Dashboard` layout follows the concept:
  - **Header:** the eyebrow "DASHBOARD", `"<greeting>, <display name>."` (the name is left out with the comma dropped when unknown), the line "Discipline compounds. So does freedom.", and `AbyssArt hero` on the right.
  - **`Segmented`:** Today, Week, Month or Year.
  - **Stat row of five `StatTile`s:**
    - Day Streak (flame);
    - Focus Time (hourglass, in range);
    - Goals (`goalsDone/goalsTotal`);
    - Tasks (`tasksInRange`);
    - Productive (`productivePercent`, or "–").
  - **Row:**
    - the Focus card (`FocusControls`: the big countdown in the display font, with previous and next to pick the item and stop, play/pause and finish);
    - Time Allocation (`Donut`, with the centre showing the total tracked time and "Total Tracked");
    - Progress (top 3 goals as `ProgressBar`s, with a → that goes to the Progress tab).
  - **Row:**
    - Today's Timeline with `Segmented` Scheduled | Activity. Scheduled shows today's items with a time, a now marker, done items struck through and lengths. Activity shows the recent intervals.
    - Activity (Live), which shows the top apps in range: icon badge, name, a `Tag` from category classification, and duration.
  - Signed out: Goals and Tasks tiles show "–", and Progress and Timeline Scheduled show the sign-in prompt. Activity cards still work.

- [ ] **Step 1: Write failing tests:**
  - `stats.test.ts`:
    - `week_starts_monday`
    - `month_and_year_bounds_local`
    - `greeting_boundaries`: 04:59 gives Evening, 05:00 Morning, 12:00 Afternoon and 18:00 Evening.
    - `allocation_folds_small_into_other`
    - `allocation_empty_is_empty`
    - `productive_null_without_classified_time`
    - `productive_percent_counts_active_only`
    - `tasks_in_range_counts_due_and_completed`
  - `Dashboard.test.tsx`:
    - `greets_by_display_name`
    - `greeting_without_name_has_no_comma`
    - `range_switch_requeries_snapshot_with_bounds`
    - `signed_out_shows_dash_tiles_and_prompt`
    - `empty_day_shows_empty_states`
- [ ] **Step 2: Run** `bun run test src/dashboard`. Expected: fail.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `bun run test`, `bun run check` and `cargo test`. Expected: pass.
- [ ] **Step 5: Visual check.** Run `bun run dev`. This needs the installed Habyss.app to be quit; if it is still running, report that instead. Take a screenshot of the main window and the panel with `screencapture -l <window id>` or `screencapture -R`, save it to the report directory, and compare it to the concept image. List any visible deviations in the report.
- [ ] **Step 6: Commit** with the message `feat(dashboard): dashboard on real data`.

---

Plans 2b (website tracking, productivity, meetings, Calendar, Analytics) and 2c (Progress, Friends, Profile, Settings, Apple and Google sign-in) follow after this one ships. They build on `src/theme`, `src/ui`, `src/today` and `Shell`.
