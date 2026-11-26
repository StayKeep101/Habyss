/**
 * Product switches.
 *
 * PAYWALL_ENABLED: whether Habyss Pro (desktop sync, $4.99 a month) can be
 * bought (lib/access.ts). The app itself is free and never locks; with this
 * off, or no RevenueCat key on the build, Pro is simply not offered.
 */
export const PAYWALL_ENABLED = true;

/**
 * REMINDERS_ENABLED: Apple Reminders with a due time on the timeline, beside
 * calendar events (lib/calendarEvents.ts). Needs a build carrying
 * NSRemindersFullAccessUsageDescription in Info.plist (runtime 1.0.3 on):
 * asking iOS for reminders without it closes the app.
 */
export const REMINDERS_ENABLED = true;
