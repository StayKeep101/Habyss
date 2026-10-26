import { addDays } from './goalInsights';

const dateOf = (key: string) => new Date(`${key}T12:00:00`);
const keyOf = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/** The days a range covers, `offset` steps from the one holding today. */
export function periodOf(range: 'day' | 'week' | 'month', offset: number, today: string, weekStartsMonday: boolean): { from: string; to: string } {
    if (range === 'day') { const day = addDays(today, offset); return { from: day, to: day }; }
    if (range === 'week') {
        const weekday = dateOf(today).getDay();
        const back = weekStartsMonday ? (weekday + 6) % 7 : weekday;
        const from = addDays(today, -back + offset * 7);
        return { from, to: addDays(from, 6) };
    }
    const base = dateOf(today);
    const first = new Date(base.getFullYear(), base.getMonth() + offset, 1, 12);
    return { from: keyOf(first), to: keyOf(new Date(first.getFullYear(), first.getMonth() + 1, 0, 12)) };
}

