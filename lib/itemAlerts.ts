/**
 * A habit's or task's own reminders before it begins: minutes before its start
 * ("Study in 10 min"), as many as wanted. The start itself is always told
 * (lib/dayGuide.ts); these are the extras, set in its Reminder section.
 * Stored on the habit or task as JSON ("[10, 30]").
 */
export const ALERT_CHOICES = [5, 10, 15, 30, 60] as const;

/** From the stored JSON (or a number list), kept to whole positive minutes, each once, soonest last. */
export function parseAlerts(raw: unknown): number[] | undefined {
    let list: unknown = raw;
    if (typeof raw === 'string') { try { list = JSON.parse(raw); } catch { return undefined; } }
    if (!Array.isArray(list)) return undefined;
    const minutes = [...new Set(list.map(Number).filter(value => Number.isFinite(value) && value > 0 && value <= 24 * 60).map(Math.round))].sort((a, b) => b - a);
    return minutes.length ? minutes : undefined;
}

export const storeAlerts = (alerts: number[] | undefined | null): string | null => {
    const clean = parseAlerts(alerts ?? []);
    return clean ? JSON.stringify(clean) : null;
};

/** Each habit's and task's reminders before it begins, by id. A habit's older single "minutes before" counts too. */
export async function loadItemAlerts(
    habits: { id: string; alerts?: number[]; reminderOffset?: number }[],
    tasks: { id: string; alerts?: number[] }[],
): Promise<Record<string, number[]>> {
    const out: Record<string, number[]> = {};
    for (const habit of habits) {
        const list = habit.alerts ?? (habit.reminderOffset && habit.reminderOffset > 0 ? [habit.reminderOffset] : undefined);
        if (list?.length) out[habit.id] = list;
    }
    for (const task of tasks) if (task.alerts?.length) out[task.id] = task.alerts;
    return out;
}

/** "10 min before", "1 hr and 10 min before", or "At the start" when none. */
export function describeAlerts(alerts: number[] | undefined): string {
    if (!alerts?.length) return 'At the start';
    const label = (minutes: number) => (minutes >= 60 && minutes % 60 === 0 ? `${minutes / 60} hr` : `${minutes} min`);
    const list = [...alerts].sort((a, b) => b - a).map(label);
    return `${list.length > 1 ? `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}` : list[0]} before`;
}
