# Habyss Desktop, Plan 2: the full app on top of sync

Date: 2026-11-02
Builds on: `docs/superpowers/specs/2026-11-02-desktop-sync-design.md` (Plan 1, done on branch `desktop-sync`).
Inputs: the owner's structure brief (pasted 2026-11-02); the concept image `~/Downloads/Habyss Dark Mode Productivity Dashboard.png`; the mobile repo at `~/Coding/Habyss`.

## Intent

Habyss saves people's time. The desktop app has to be incredibly intuitive, powerful and premium. It is the same Habyss as the phone, with real data from Supabase through the Plan 1 sync. It adds a desktop-native layout and deep tracking of screen time: apps and websites. Every screen shows real synced or locally tracked data. Nothing is mock data.

## Look and feel

- **Visual target:** the concept image. Dark, with a deep abyss background, soft rounded cards, a blue/violet accent, and the Abyss imagery (the eclipse over the mountain).
- **Design system:** the phone's, ported to web CSS. That means `~/Coding/Habyss/theme/` (colors, designSystem, tokens, motion, scale), the rules in `docs/UI_CONSISTENCY.md` and `docs/motion-system.md`, and the components in `components/ui`.
  - Screens use named tokens, never raw values. The tokens become CSS custom properties.
  - Components are rebuilt in React DOM with the same names and roles where they apply.
  - Use the `abyss` theme by default, and also support `trueDark` and `light`.
- **Layout:** three columns, as in the concept.
  - Left: the sidebar, holding the brand, Dashboard, Calendar, Progress, Analytics, Friends, Profile and Settings, plus "The Abyss / Rise Higher" art at the bottom.
  - Centre: the tab content.
  - Right: a collapsible right panel holding Focus Mode, Due Today or Timeline, Up Next, and Today at a Glance.

## Screens

- **Dashboard.**
  - **Header:** "Good evening, <display name>", with the name from `profiles`, and a line.
  - **Range switch:** Today, Week, Month or Year. It applies to the stat row and the cards.
  - **Stat row:**
    - day streak (`streakFrom`);
    - focus time (desktop focus sessions);
    - goals done or total;
    - tasks done or total;
    - productive %.
  - **Cards:**
    - the Focus timer;
    - Time Allocation, a donut of tracked time by category;
    - Progress, the top goals with `goalInsights` percentages;
    - Today's Timeline, which toggles between Scheduled and Activity;
    - Activity (Live), with apps and websites, a productive, neutral or unproductive tag, and the duration.
- **Calendar.**
  - The day's scheduled timeline (`dayFlow` from the shared rules) beside the activity timeline (apps, websites, idle, meetings).
  - Clicking a habit or task opens an analytics panel. For a habit: streak, history, completion rate, next due, linked goal. For a task: due date, deadline, estimate, subtasks, goal.
  - Clicking an activity block opens its details: app or site, duration, category, productive or not, and a control to change the classification.
  - You can tick, skip and reschedule from here, and the change syncs.
- **Progress / Goals.**
  - Every goal with its linked habits, tasks and milestones, showing where you are, what's left, pace and forecast (`goalInsights`).
  - You create and edit goals, milestones (the roadmap), habits and tasks here, and they sync.
- **Analytics.** Screen time over a day, week or month, broken down by app, website and category. It shows productive versus unproductive trends, focus versus activity overlap, and meeting time. This replaces today's separate Applications and Analytics screens.
- **Friends.** Friends list and requests, challenges (issue or join), bets (market, stake), the feed, King of the Week and missions. Everything goes through the phone's access paths (Plan 1 decision). Actions that need a connection say so.
- **Profile.** Stats, rank (leaderboard), Marks, Shards, wallet ("money"), streaks and streak freezes, best streak and goals completed.
- **Settings.** Account and sync, all the existing tracking and privacy controls, and the new tracking settings:
  - idle threshold;
  - meeting apps, which count as meeting time even without input;
  - website tracking on or off;
  - "Don't track private browsing" (on by default);
  - productivity classification overrides;
  - menu bar options;
  - appearance.

## Menu bar

- **Panel (opened):** a Focus Mode toggle, Today and Timeline tabs, Due Today with tick-off, Up Next showing what you should be doing now, and Today at a Glance. The Timeline tab shows where you are in the day right now.
- **Closed:** the tray title shows the running focus timer, plus, optionally (a setting), the current task or habit.
- **Focus Mode** only starts or stops the focus timer. There is no blocking or warnings (owner decision).

## Website tracking

- Read the active tab's address from supported browsers while one is in front: Safari, Chrome, Arc, Brave, Edge and Opera. This uses macOS Automation (Apple Events), and macOS asks for permission once per browser.
- Store the host only, for example `docs.google.com`, not the full URL. It is local only and never synced or uploaded.
- **Private browsing is never recorded** while the setting is on, which is the default:
  - Chromium browsers: check the front window's mode ("incognito").
  - Safari: use whatever reliable signal exists.
  - **If private state can't be determined, record no host for that interval (fail closed).**
- Firefox and other browsers without automation support are tracked at app level only.
- Existing exclusions, retention, export and delete apply to hosts too.

## Productivity

- Each category has a classification: productive, neutral or unproductive. The `categories.classification` column already exists.
- Defaults by category, for example Development and Design are productive and Social and Entertainment are unproductive. Websites get categories through a built-in starter list of common hosts.
- The user can override the category or classification for any app or website, from Settings or by clicking an activity block.
- Productive % = productive time ÷ active tracked time.
- Meeting apps (Zoom, Google Meet in a browser, Teams, FaceTime, Slack huddles where detectable) count as meeting time while in front, even without keyboard or mouse input. Meeting time is shown separately and is never treated as idle.

## Sign in with Apple and Google

- Both use Supabase OAuth with PKCE through the system browser, returning to the desktop app through a deep link with the scheme `habyss-desktop://auth-callback` (`tauri-plugin-deep-link`).
- The desktop exchanges the code with `POST /auth/v1/token?grant_type=pkce`. The session is then handled exactly like an email sign-in (Keychain, account row, sync).
- **Owner setup in the Supabase dashboard** (only the owner can do this):
  - add `habyss-desktop://auth-callback` to Authentication → URL Configuration → Redirect URLs;
  - make sure the Apple provider is set up for the web flow (Services ID, key and team), not only native iOS.
  
  Google needs no change, because it returns through Supabase's own callback.

## Non-goals

- No paywall (Plan 1 decision).
- No changes to Supabase or the mobile app. `focus_blocks`, revisions and shared settings stay for later. Desktop focus sessions stay local.
- No app or website blocking.
- No location tracking: "where you went" means websites.
- No sync of activity data of any kind.

## Anti-goals

- Recording a private-browsing address, or any address while unsure whether the window is private.
- Screens showing placeholder or invented numbers.
- Numbers that differ from the phone for the same data (use the shared rules from Plan 1).
- A UI that looks like a generic dashboard template instead of the concept and the phone's design.
- Breaking offline use, or the existing tracker.

## Decided

**By the owner:**
- the screen list and their contents;
- the concept image as the visual target;
- the phone's UI guidelines as the design base;
- website tracking with a private-browsing switch;
- Focus Mode only starts the timer;
- Apple and Google sign-in;
- productivity by category with per-app and per-site overrides;
- meeting apps count as meeting time.

**My calls:**
- store the host only;
- fail closed on private detection;
- the right panel is collapsible;
- the Abyss art is a bundled image asset;
- the phone tokens become CSS variables;
- Applications and Analytics merge into Analytics.

## Builder-check answers (my calls unless marked)

- **Time Allocation (owner decision):** the donut shows tracked time by app/site category, such as Development, Communication, Research and Social, with "Other" for small slices.
- **Progress card:** goals, by `goalInsights` percentage.
- **Focus timer:** behaves like the phone's timer (`~/Coding/Habyss/docs/HabyssTimer.md`). It is a countdown from a preset, with pause, stop and next. Paused time doesn't count as focus. The label is the current task or habit, or a free label. This needs pause support in the local `focus_sessions` table: a new migration adding `paused_ms` and `paused_at`.
- **Dashboard range:** applies to the stat row, Time Allocation and Activity. The streak always shows the current streak. Goals are counted as done out of active. Tasks are completed in the range out of due in the range. The Focus card and Today's Timeline always show today.
- **Meeting time:** derived from meeting apps and meeting hosts (meet.google.com, zoom.us, teams…). The engine treats a meeting app or host in front as active even with no input. Old data is unchanged.
- **Unknown apps and sites:** they count as "uncategorized", which is neutral and included in the Productive % denominator. With no tracked time, the stat shows "–".
- **Fonts and art:** copy the phone's font files and the Abyss art from `~/Coding/Habyss/assets/`. If no fitting eclipse image exists there, crop it from the concept image.
- **Apple sign-in:** build both Apple and Google. If Supabase reports that the provider isn't configured, show "Apple sign-in isn't set up yet." Deep links are tested in a built `.app`, not in `tauri dev`.
- **Window:** keep the current overlay title bar with the traffic lights, and add macOS vibrancy behind the sidebar. It stays on macOS 14.
- **Editing in Progress:** a focused editor covering name, icon and colour, goal link, schedule (the phone's recurrence rules), time and duration, done-or-amount tracking, and target date and milestones for goals. Reminders, ringtones, location and HealthKit stay phone-only, and their values are kept untouched when editing.

## Suggested split

1. **2a, foundation:** design system port, app shell (three columns), menu bar panel and tray title, Dashboard.
2. **2b, tracking:** website tracking with privacy, productivity classification, meeting time, Calendar, Analytics.
3. **2c, the rest:** Progress (with creating and editing), Friends, Profile, Settings, Apple and Google sign-in.

## Left to the builder

- Exact component breakdown and CSS structure within the token system.
- Chart rendering, using the existing DOM/SVG approach, with no heavy chart library.
- The starter host-to-category list.
- How the Safari private-window signal is detected, as long as it fails closed.
