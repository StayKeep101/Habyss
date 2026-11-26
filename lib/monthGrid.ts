import { localDateKey } from './habitSchedule';

const dateOf = (key: string) => new Date(`${key}T12:00:00`);

/**
 * A month as calendar rows of seven: each cell a day's key, or null for the
 * days before the 1st and after the last, starting on Monday or Sunday.
 */
export function monthGrid(month: string, weekStartsMonday: boolean): (string | null)[][] {
    const first = dateOf(month.slice(0, 7) + '-01');
    const lead = weekStartsMonday ? (first.getDay() + 6) % 7 : first.getDay();
    const length = new Date(first.getFullYear(), first.getMonth() + 1, 0, 12).getDate();
    const cells: (string | null)[] = [...Array(lead).fill(null)];
    for (let date = 1; date <= length; date++) cells.push(localDateKey(new Date(first.getFullYear(), first.getMonth(), date, 12)));
    while (cells.length % 7) cells.push(null);
    const rows: (string | null)[][] = [];
    for (let at = 0; at < cells.length; at += 7) rows.push(cells.slice(at, at + 7));
    return rows;
}
