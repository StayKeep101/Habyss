import type { FocusSession, Interval } from './types';
export const overlap = (start: number, end: number, from: number, to: number) => Math.max(0, Math.min(end, to) - Math.max(start, from));
export function dayRange(date: string): [
    number,
    number
] { const [y, m, d] = date.split('-').map(Number); return [new Date(y, m - 1, d).getTime(), new Date(y, m - 1, d + 1).getTime()]; }
export function localDate(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
export function duration(ms: number) { const mins = Math.floor(Math.max(0, ms) / 60000); return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`; }
export function precise(ms: number) { const secs = Math.floor(Math.max(0, ms) / 1000); return `${Math.floor(secs / 60).toString().padStart(2, '0')}:${(secs % 60).toString().padStart(2, '0')}`; }
export function metrics(intervals: Interval[], focus: FocusSession[], from: number, to: number, now = Date.now()) {
    const list = intervals.filter(i => i.end > from && i.start < to);
    const active = list.filter(i => i.state === 'active');
    const sum = (state: string) => list.filter(i => i.state === state).reduce((n, i) => n + overlap(i.start, i.end, from, to), 0);
    const apps = new Map<string, {
        name: string;
        bundle: string;
        category: string;
        ms: number;
        sessions: number;
    }>();
    for (const i of active) {
        const key = i.bundle_id ?? i.name;
        const a = apps.get(key) ?? { name: i.name, bundle: key, category: i.category, ms: 0, sessions: 0 };
        a.ms += overlap(i.start, i.end, from, to);
        a.sessions++;
        apps.set(key, a);
    }
    let switches = 0;
    let longest = 0;
    let run = 0;
    let previous: Interval | undefined;
    for (const i of active) {
        const contiguous = previous && i.start === previous.end;
        run = (contiguous ? run : 0) + overlap(i.start, i.end, from, to);
        longest = Math.max(longest, run);
        if (contiguous && previous?.bundle_id !== i.bundle_id)
            switches++;
        previous = i;
    }
    const declared = focus.reduce((n, f) => n + overlap(f.start, f.end ?? now, from, to), 0);
    const observedFocus = focus.reduce((n, f) => n + active.reduce((s, i) => s + overlap(i.start, i.end, Math.max(from, f.start), Math.min(to, f.end ?? now)), 0), 0);
    const categories = new Map<string, number>();
    for (const a of apps.values())
        categories.set(a.category, (categories.get(a.category) ?? 0) + a.ms);
    return { active: sum('active'), idle: sum('idle'), declared, observedFocus, switches, longest, apps: [...apps.values()].sort((a, b) => b.ms - a.ms), categories: [...categories.entries()].sort((a, b) => b[1] - a[1]) };
}
export const colors = ['#6484ff', '#82cfdf', '#a08ae0', '#d68fa3', '#82b8a2', '#d6bd89'];
export function appColor(name: string) { return colors[[...name].reduce((n, c) => n + c.charCodeAt(0), 0) % colors.length]; }
