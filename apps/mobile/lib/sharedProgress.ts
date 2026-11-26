import type { RecordDay } from './habitRecord';

/**
 * A shared habit, person by person: your days, each friend's, and all of you
 * together. Friends' ticks come from the server (shared_completions, readable
 * by everyone on the share); their due days are the habit's own, the same as
 * yours, so each person's days line up and start from the same place.
 */
export interface Person { id: string; name: string; you: boolean; color: string }

/** A friend's days: the habit's schedule (from yours), ticked where they ticked. */
export function friendHistory(base: RecordDay[], ticked: Set<string>): RecordDay[] {
    return base.map(day => ({ date: day.date, scheduled: day.scheduled, skipped: false, completed: ticked.has(day.date) }));
}

/** Everyone together: a day is done once all of you did it, and shaded by how many did. */
export function togetherHistory(histories: RecordDay[][]): RecordDay[] {
    if (!histories.length) return [];
    const [first, ...rest] = histories;
    const others = rest.map(list => new Map(list.map(day => [day.date, day])));
    return first.map(day => {
        const all = [day, ...others.map(map => map.get(day.date))];
        const did = all.filter(entry => entry?.completed).length;
        return { ...day, skipped: false, completed: did === all.length, share: did / all.length };
    });
}

/** Distinct colours for people, from the theme: you first (the habit's own), then the rest in turn. */
export function peopleColors(you: string, palette: string[], count: number): string[] {
    const rest = palette.filter(color => color.toLowerCase() !== you.toLowerCase());
    return Array.from({ length: count }, (_, index) => (index === 0 ? you : rest[(index - 1) % Math.max(1, rest.length)] ?? you));
}
