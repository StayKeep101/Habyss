import type { DayFlow } from './dayFlow';

/**
 * Today's timeline as the Day widget draws it (ios/Widget/DayWidget.swift):
 * every habit, task, event and meal in the line's own order and times, so the
 * widget shows exactly what is on now and the rest of the day. The widget works
 * out "now" from the clock itself, so it moves on through the day without the
 * app running; the app writes this again whenever the day changes.
 */
export interface WidgetDayItem {
    id: string;
    kind: 'habit' | 'task' | 'meal' | 'event';
    title: string;
    /** Minutes from midnight. */
    start: number;
    end: number;
    done: boolean;
    /** "#RRGGBB", when the item has its own colour. */
    color?: string;
}

export interface WidgetDay {
    version: 1;
    day: string;
    wake: number;
    sleep: number;
    items: WidgetDayItem[];
    /** Tomorrow as planned now, shown from midnight until Habyss next runs, so the widget is never empty. */
    next?: Omit<WidgetDay, 'version' | 'next'>;
}

const HEX = /^#[0-9a-f]{6}$/i;

export function buildWidgetDay(flow: DayFlow | null, day: string, wake: number, sleep: number): WidgetDay {
    const items: WidgetDayItem[] = [];
    for (const item of flow?.timeline ?? []) {
        const last = items[items.length - 1];
        // A thing split around another shows once, from its first part to its last.
        if (item.part && item.part.index > 0) {
            const first = [...items].reverse().find(entry => entry.id === item.id);
            if (first) { first.end = Math.max(first.end, item.end); continue; }
        }
        if (last && last.id === item.id) { last.end = Math.max(last.end, item.end); continue; }
        items.push({
            id: item.id,
            kind: item.kind,
            title: item.title,
            start: Math.round(item.start),
            end: Math.round(item.end),
            done: item.done,
            ...(item.color && HEX.test(item.color) ? { color: item.color } : {}),
        });
    }
    // More than the largest widget shows; it keeps the shared file small.
    return { version: 1, day, wake, sleep, items: items.slice(0, 40) };
}

/** The Shards widget (ios/Widget/ShardsWidget.swift): the balance, today's change and the last day's line. */
export interface WidgetShards {
    version: 1;
    balance: number;
    today: number;
    /** The balance through the last 24 hours, oldest first, a point every half hour. */
    line: number[];
    at: number;
}

export function buildWidgetShards(balance: number, today: number, points: { t: number; value: number }[], now = Date.now()): WidgetShards {
    const line: number[] = [];
    const step = 30 * 60_000;
    let index = 0;
    let value = points.length ? points[0].value : balance;
    for (let t = now - 24 * 3600_000; t <= now; t += step) {
        while (index < points.length && points[index].t <= t) { value = points[index].value; index++; }
        line.push(Math.round(value));
    }
    line[line.length - 1] = Math.round(balance);
    return { version: 1, balance: Math.round(balance), today: Math.round(today), line, at: now };
}
