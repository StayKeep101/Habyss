/**
 * Product switches.
 *
 * PAYWALL_ENABLED: whether Habyss Pro (desktop sync, $4.99 a month) can be
 * bought (lib/access.ts). The app itself is free and never locks; with this
 * off, or no RevenueCat key on the build, Pro is simply not offered.
 */
export const PAYWALL_ENABLED = true;

/**
 * MARKET_ENABLED: betting Marks on friends' goals (lib/market.ts). Marks are
 * never bought or cashed out, but Apple's age rating counts this as simulated
 * gambling; false hides every way in, and nothing else changes.
 */
export const MARKET_ENABLED = false;

/**
 * REMINDERS_ENABLED: Apple Reminders with a due time on the timeline, beside
 * calendar events (lib/calendarEvents.ts). Needs a build carrying
 * NSRemindersFullAccessUsageDescription in Info.plist (runtime 1.0.3 on):
 * asking iOS for reminders without it closes the app.
 */
export const REMINDERS_ENABLED = true;

/**
 * GOALS_ENABLED: goals, everywhere they show (Home's card, the + menu, the
 * Calendar's goals and its filter, the Goal chip on habits and tasks, the brain
 * dump's Goal tiles, the profile's Goals done, a day's "goals moved", the Goals
 * widget). Off for the first release: the code stays, nothing of it is shown.
 * Bets are on goals, so MARKET_ENABLED goes with it.
 */
export const GOALS_ENABLED = false;
