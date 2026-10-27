/**
 * Reminders are booked a week or so ahead and refreshed whenever the app
 * opens; iOS will not wake the app to book more. Someone who relies on them
 * and does not open Habyss for a while would otherwise just stop hearing from
 * it, which reads as "notifications broke". So one last note goes after the
 * final booked reminder, saying so. Opening the app books the next ones and
 * moves this note along with them.
 */
export const KEEP_ALIVE_ID = 'reminders-keep-alive';
const AFTER_LAST_MS = 30 * 60_000;

export function keepAliveAt(booked: { date: Date }[]): Date | null {
    if (!booked.length) return null;
    const last = Math.max(...booked.map(item => item.date.getTime()));
    return new Date(last + AFTER_LAST_MS);
}

export const KEEP_ALIVE_CONTENT = {
    title: 'Your reminders are paused',
    body: 'That was the last one booked. Open Habyss and the next ones are planned.',
};
