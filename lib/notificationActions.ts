/**
 * Acting on the day from a notification, without finding the item first.
 *
 * Every reminder about a habit or task (its own reminder, Echo's, the day
 * guide's "Now:") carries four buttons, seen by pressing on it:
 *
 *   Done             ticks it
 *   Start focus      opens focus on it, already running
 *   In 10 minutes    asks again in ten
 *   Skip today       a habit is set aside for today; a task moves to tomorrow
 *
 * At the end of its time (Time's up) the buttons are Done, +10 min, +30 min
 * and Skip: more time asks again then, and the tick that follows is how long
 * it really took (lib/learnedLength.ts).
 *
 * Echo's follow-up, when something's time went by untouched, offers
 * "Just 5 minutes" in place of Start: the smallest possible start, a
 * five-minute clock that keeps counting if it takes.
 *
 * iOS runs a button's action only by opening the app (only Android can act in
 * the background), so each button opens Habyss and does its job at once.
 */
export const ITEM_CATEGORY = 'ECHO_ALIVE';
export const NUDGE_CATEGORY = 'ECHO_NUDGE';
/** At the end of something's time (lib/dayGuide.ts): done, or more time? */
export const TIMES_UP_CATEGORY = 'ECHO_TIMES_UP';
/** The day as it happens (lib/dayGuide.ts): one button, Done, ticking the habit or task whose time just ended. */
export const DONE_CATEGORY = 'HABYSS_DONE';
/** A handover ("Emails" starts as Study ends): its button ticks the one whose time just ended, so it says so. */
export const HANDOVER_CATEGORY = 'HABYSS_HANDOVER';
/** Echo asking how your energy is, answered on the notification. */
export const ENERGY_CATEGORY = 'ECHO_ENERGY';

export const ACTION = {
    done: 'ECHO_DONE',
    snooze: 'ECHO_SNOOZE',
    start: 'ECHO_START',
    five: 'ECHO_FIVE',
    skip: 'ECHO_SKIP',
    more10: 'ECHO_MORE_10',
    more30: 'ECHO_MORE_30',
} as const;
export const ACTIONS: string[] = Object.values(ACTION);

/** "Need more time": how many minutes each button gives before Echo asks again. */
export const MORE_MINUTES: Record<string, number> = { [ACTION.more10]: 10, [ACTION.more30]: 30 };

/**
 * Community, answered on the push itself (the server names the category,
 * supabase push_notification): a friend's nudge, "On it", tells them you are;
 * a comment, "Reply", answers in its thread; a duel waiting on you, "Accept"
 * or "Decline". Handled in lib/socialActions.ts.
 */
export const FRIEND_NUDGE_CATEGORY = 'HABYSS_FRIEND_NUDGE';
export const COMMENT_CATEGORY = 'HABYSS_COMMENT';
export const DUEL_CATEGORY = 'HABYSS_DUEL';
export const SOCIAL_ACTION = {
    onIt: 'HABYSS_ON_IT',
    reply: 'HABYSS_REPLY',
    accept: 'HABYSS_DUEL_ACCEPT',
    decline: 'HABYSS_DUEL_DECLINE',
} as const;

/** Energy, one tap: low, okay, high (stored as 2, 3 and 5 on the 1–5 scale). */
export const ENERGY_ACTION = { low: 'ECHO_ENERGY_LOW', ok: 'ECHO_ENERGY_OK', high: 'ECHO_ENERGY_HIGH' } as const;
export const ENERGY_VALUE: Record<string, 2 | 3 | 5> = { [ENERGY_ACTION.low]: 2, [ENERGY_ACTION.ok]: 3, [ENERGY_ACTION.high]: 5 };

/** How long "In 10 minutes" waits. */
export const SNOOZE_MINUTES = 10;
/** The smallest start Echo offers. */
export const STARTER_MINUTES = 5;

type Button = {
    identifier: string; buttonTitle: string;
    textInput?: { submitButtonTitle: string; placeholder: string };
    options: { opensAppToForeground: boolean; isDestructive?: boolean };
};
const button = (identifier: string, buttonTitle: string, extra: Partial<Button['options']> = {}): Button =>
    ({ identifier, buttonTitle, options: { opensAppToForeground: true, ...extra } });

export const CATEGORIES: { id: string; buttons: Button[] }[] = [
    { id: DONE_CATEGORY, buttons: [button(ACTION.done, 'Done')] },
    { id: HANDOVER_CATEGORY, buttons: [button(ACTION.done, 'Last one done')] },
    { id: ITEM_CATEGORY, buttons: [
        button(ACTION.done, 'Done'),
        button(ACTION.start, 'Start focus'),
        button(ACTION.snooze, `In ${SNOOZE_MINUTES} minutes`),
        button(ACTION.skip, 'Skip today', { isDestructive: true }),
    ] },
    { id: NUDGE_CATEGORY, buttons: [
        button(ACTION.done, 'Done'),
        button(ACTION.five, `Just ${STARTER_MINUTES} minutes`),
        button(ACTION.snooze, `In ${SNOOZE_MINUTES} minutes`),
        button(ACTION.skip, 'Skip today', { isDestructive: true }),
    ] },
    { id: TIMES_UP_CATEGORY, buttons: [
        button(ACTION.done, 'Done'),
        button(ACTION.more10, '+10 min'),
        button(ACTION.more30, '+30 min'),
        button(ACTION.skip, 'Skip today', { isDestructive: true }),
    ] },
    { id: FRIEND_NUDGE_CATEGORY, buttons: [button(SOCIAL_ACTION.onIt, 'On it 👊', { opensAppToForeground: false })] },
    { id: COMMENT_CATEGORY, buttons: [{
        identifier: SOCIAL_ACTION.reply, buttonTitle: 'Reply',
        textInput: { submitButtonTitle: 'Send', placeholder: 'Reply…' },
        options: { opensAppToForeground: false },
    }] },
    // Accept opens Habyss: the duel starts there, and a stake you cannot cover says so.
    { id: DUEL_CATEGORY, buttons: [
        button(SOCIAL_ACTION.accept, 'Accept ⚔️'),
        button(SOCIAL_ACTION.decline, 'Decline', { opensAppToForeground: false, isDestructive: true }),
    ] },
    // Answered without opening the app: the answer is all Echo needs.
    { id: ENERGY_CATEGORY, buttons: [
        button(ENERGY_ACTION.low, 'Low', { opensAppToForeground: false }),
        button(ENERGY_ACTION.ok, 'Okay', { opensAppToForeground: false }),
        button(ENERGY_ACTION.high, 'High', { opensAppToForeground: false }),
    ] },
];

/** The kinds of notification that are about one habit or task, and so take the buttons. */
export const ITEM_KINDS = ['echo-alive', 'habit-reminder', 'task-reminder', 'day-guide', 'streak-guard'];

/**
 * Keeping the run alive: when nothing at all is done today and there is a run
 * of days behind it, Echo says so once, two hours before bed, while there is
 * still time. Null when there is nothing to protect or the moment has passed.
 * `now` and `sleep` are minutes from midnight.
 */
export function streakGuard(input: { streak: number; doneToday: boolean; now: number; sleep: number; name?: string; next?: string }): { at: number; title: string; body: string } | null {
    if (input.streak < 2 || input.doneToday) return null;
    const at = Math.max(0, input.sleep - 120);
    if (at <= input.now) return null;
    const who = input.name?.trim().split(/\s+/)[0];
    return {
        at,
        title: `${input.streak}-day run`,
        body: `${who ? `${who}, n` : 'N'}othing is done yet today, and your ${input.streak}-day run ends at midnight. `
            + (input.next ? `${STARTER_MINUTES} minutes on ${input.next} keeps it.` : 'One small thing keeps it.'),
    };
}
