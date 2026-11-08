import * as Notifications from 'expo-notifications';

/**
 * A break, said by Echo, partway through a long focus session: "Hey Erwan, 50
 * minutes in. Take five." Focus keeps every other notification quiet
 * (lib/focusQuiet.ts); this is the one let through, because a mind that never
 * stops for breath is the first to stop altogether. Booked when a session of
 * an hour or more starts, taken back when it ends.
 */
export const BREAK_AFTER_MIN = 50;
const ID = 'habyss-focus-break';

export function breakLine(name: string | null | undefined, minutes = BREAK_AFTER_MIN): { title: string; body: string } {
    const first = name?.trim().split(/\s+/)[0];
    return { title: 'Echo', body: `${first ? `Hey ${first}, ` : ''}${minutes} minutes in. Take five: stand up, some water, eyes off the screen. Then back to it.` };
}

export async function bookFocusBreak(startedAt: number, lengthSeconds: number): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync(ID).catch(() => undefined);
    if (lengthSeconds < (BREAK_AFTER_MIN + 10) * 60) return;
    const at = startedAt + BREAK_AFTER_MIN * 60_000;
    if (at <= Date.now()) return;
    const { getName } = require('./echo') as typeof import('./echo');
    const line = breakLine(await getName().catch(() => undefined));
    await Notifications.scheduleNotificationAsync({
        identifier: ID,
        content: { ...line, sound: 'default', data: { kind: 'focus-break', url: '/(root)/focus' } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(at) },
    }).catch(() => undefined);
}

export async function cancelFocusBreak(): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync(ID).catch(() => undefined);
}
