/**
 * How long before a habit its reminder lands.
 *
 * The sheet offered four buttons — on time, 5, 15 and 30 minutes — which is
 * fine for "leave in a minute" and useless for anything you have to prepare
 * for. A reminder to pack for a run wants an hour; one about a weekly shop
 * wants the day before.
 *
 * Everything here speaks in minutes, because that is what the database column
 * has always held and what `buildHabitReminderPlan` subtracts. Hours and days
 * are a way of saying a number of minutes, not a second field, so no stored
 * habit has to change to gain them.
 */

export type LeadUnit = 'minutes' | 'hours' | 'days';

const MINUTES: Record<LeadUnit, number> = { minutes: 1, hours: 60, days: 1440 };

/** A month ahead. Past this the reminder is about a different week's life. */
export const LEAD_MAX = 30 * 1440;

/** What each unit offers. Chosen to cover what people actually ask for. */
export const LEAD_AMOUNTS: Record<LeadUnit, number[]> = {
    minutes: [5, 10, 15, 30, 45],
    hours: [1, 2, 3, 6, 12],
    days: [1, 2, 3, 7],
};

export const LEAD_UNITS: LeadUnit[] = ['minutes', 'hours', 'days'];

export const leadMinutes = (value: number, unit: LeadUnit): number =>
    Math.min(LEAD_MAX, Math.max(0, Math.round(value) * MINUTES[unit]));

/**
 * The same duration said in the largest unit that fits it exactly.
 *
 * Exactly, not approximately: 90 minutes is not "1 hour", and a picker that
 * rounded it there would quietly move a reminder the user had set.
 */
export function splitLead(minutes: number | null | undefined): { value: number; unit: LeadUnit } {
    const total = Math.max(0, Math.round(minutes ?? 0));
    if (total === 0) return { value: 0, unit: 'minutes' };
    if (total % 1440 === 0) return { value: total / 1440, unit: 'days' };
    if (total % 60 === 0) return { value: total / 60, unit: 'hours' };
    return { value: total, unit: 'minutes' };
}

const plural = (value: number, word: string) => `${value} ${word}${value === 1 ? '' : 's'}`;

/** "1 hour and 30 minutes" — for a sentence, so nothing is abbreviated. */
export function longLead(minutes: number | null | undefined): string {
    const total = Math.max(0, Math.round(minutes ?? 0));
    if (total === 0) return 'now';
    const parts: string[] = [];
    const days = Math.floor(total / 1440);
    const hours = Math.floor((total % 1440) / 60);
    const rest = total % 60;
    if (days) parts.push(plural(days, 'day'));
    if (hours) parts.push(plural(hours, 'hour'));
    if (rest) parts.push(plural(rest, 'minute'));
    return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0];
}

/** "1 hr 30 min before" — for a chip, where there are 30 points to say it in. */
export function shortLead(minutes: number | null | undefined): string {
    const total = Math.max(0, Math.round(minutes ?? 0));
    if (total === 0) return 'On time';
    const days = Math.floor(total / 1440);
    const hours = Math.floor((total % 1440) / 60);
    const rest = total % 60;
    const parts = [
        days ? `${days} ${days === 1 ? 'day' : 'days'}` : '',
        hours ? `${hours} hr` : '',
        rest ? `${rest} min` : '',
    ].filter(Boolean);
    return `${parts.join(' ')} before`;
}

/** The label on one amount button, without repeating "before" six times. */
export const amountLabel = (value: number, unit: LeadUnit): string =>
    unit === 'minutes' ? `${value} min` : unit === 'hours' ? `${value} hr` : `${value} ${value === 1 ? 'day' : 'days'}`;
