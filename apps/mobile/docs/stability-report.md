# Habyss stability checks — 26 September 2026

The applicable Goal composer improvements now also work in Habit and Task creation and editing. Automated longevity checks found and fixed persistence, statistics, and performance defects. No production database was used or modified by these tests.

## Creation flows

- Habit and Task detail panels fit their content, with a height limit and scrolling on smaller screens.
- Recognized dates, times, amounts, repeat days, and task priorities use inline accent highlighting where applicable.
- Habits use the searchable, grouped unit selector while keeping the amount field in place. The shared Look controls provide more icons, a selected-icon preview, color swatches, and custom color selection.
- Tasks open the calendar directly, with swiping, month arrows, and month/year navigation. Past task dates and the “No date” choice are preserved.
- Editing preserves midnight, fractional or single-unit numeric targets, existing reminders, quit habits, and monthly/yearly schedules. Clearing the title cannot silently save the previous title.

## Defects fixed

- Database callers now wait until initialization and migrations finish. A failed initialization closes its connection and can retry.
- Check-ins, skips, measured progress, and HealthKit completion writes share a serialized queue and commit atomically. Failed writes do not publish successful progress or discard the previous measurement.
- A completion toggle reads the saved row rather than relying on an already-populated cache.
- Imported tasks use an atomic upsert. Simultaneous imports no longer collide, deleted imports can be restored, and existing completion status and omitted fields survive re-import.
- Lifetime statistics and goal histories no longer stop at 90, 366, or 730 days. Skipped days preserve streaks, while a missed scheduled day is not forgiven merely because today is an off day.
- Month reports avoid repeatedly copying large task arrays. Goal calculations reuse compiled schedules and accumulate task counts rather than scanning every task for every day.
- Late-night task completions use their local calendar date. Malformed optional stored arrays cannot hide the entire habit list.
- Progress caches are cleared after a storage reload. The unused local completion sync queue no longer grows on every check-in; backup still uses the existing `synced` fields.
- Goal and Roadmap progress controls revert failed optimistic changes and show a retry message. Task save/delete failures in those views are handled.
- Roadmap drag values use Reanimated’s compiler-compatible get/set API.

## Verification

Tests ran on Node 24.20.0. The integration adapter uses real SQLite in a temporary file with the app’s migrations and persistence code; it replaces the Expo transport and mocks native notifications, widgets, and HealthKit.

| Check | Result |
| --- | --- |
| Full Jest suite | 52 suites, 576 tests passed |
| Ten-year history | 200 habits × 3,653 days = 730,600 check-ins retained |
| Large task history | 50,000 completed tasks retained and counted |
| Simultaneous imports | 50 imports of one external ID produce one row |
| Simultaneous measured progress | 200 additions of 0.1 persist exactly 20 |
| Mixed writes and overflow | Ordered check-in/skip/measurement changes and rejected overflowing totals |
| Failure injection | Partial measurement write rolls back; later retry succeeds |
| Database startup | 101 callers share initialization; failed initialization retries |
| Database restart/upgrade | Edits survive reopening; migrations safely replay; `PRAGMA integrity_check` returns `ok` |
| Calendar boundaries | Longevity, scheduling, and task statistics passed in Toronto and UTC |
| TypeScript and UI consistency | Passed |
| ESLint on changed source/test files | No errors; existing warnings remain |
| Production iOS JavaScript/Hermes export | Passed; output generated outside the repository |

One isolated local run calculated the monthly report for 50,000 tasks in approximately 25 ms and the full ten-year goal with 200 habits and 50,000 tasks in approximately 1.3 seconds. These measure JavaScript calculations on this Mac, not device frame rates. The extreme goal calculation can still be noticeable on a phone.

## Reproduce

```sh
npm run test:stress
npx jest --ci --maxWorkers=2 --watch=false --silent
npm run type-check
npm run check:ui
TZ=UTC npx jest lib/__tests__/longevity.stress.test.ts lib/__tests__/habitSchedule.test.ts lib/__tests__/taskStats.test.ts --runInBand --watch=false
```

The stress suite requires Node with `node:sqlite` support and creates and removes its own database. It does not populate the app with test data.

## Remaining validation

This is an automated data and component stability pass, not a guarantee against every future failure. Simulator UI automation was unavailable. Native gestures, keyboard/caret behavior, device memory pressure, extended foreground/background use, OS termination during writes, native SQLite connection contention, notification delivery, widgets, HealthKit, and real cloud backup/restore still need device-level testing. The iOS export verifies the production JavaScript bundle; it is not a signed Xcode build or an on-device soak test.
