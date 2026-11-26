/**
 * A habit held to something in the day: "Study Accounting, right before
 * Accounting class". It is one habit with one streak; on a day the class is on
 * the calendar, the timeline places it against the class (before it, or after
 * it), whatever time the class is that day. On a day without it, it is an
 * ordinary flexible habit.
 *
 * Matched by name, so every "Accounting" event counts ("ACCT 2010 Accounting
 * Lecture" included), and meals count too ("Walk after Lunch"). Before an event
 * with travel, it ends before you leave; after one, it starts once you are back.
 */
export interface HabitAnchor {
    /** The name to look for in the day's events and meals ("Accounting"). */
    to: string;
    side: 'before' | 'after';
    /** Minutes between the two (0: right before or right after). */
    gap: number;
}

export const ANCHOR_GAPS = [0, 15, 30, 60] as const;

const clean = (text: string) => text.trim().toLowerCase().replace(/\s+/g, ' ');

export function parseAnchor(value: unknown): HabitAnchor | undefined {
    let raw = value;
    if (typeof raw === 'string') {
        try { raw = JSON.parse(raw); } catch { return undefined; }
    }
    if (!raw || typeof raw !== 'object') return undefined;
    const { to, side, gap } = raw as Partial<HabitAnchor>;
    if (typeof to !== 'string' || !to.trim()) return undefined;
    return {
        to: to.trim().slice(0, 80),
        side: side === 'after' ? 'after' : 'before',
        gap: Number.isFinite(gap) ? Math.max(0, Math.min(240, Math.round(gap as number))) : 0,
    };
}

/** As stored (SQLite text and the server's column); null for none. */
export const storeAnchor = (anchor: HabitAnchor | null | undefined): string | null => {
    const parsed = parseAnchor(anchor ?? null);
    return parsed ? JSON.stringify(parsed) : null;
};

/** Whether an event or meal called `title` is the one a habit is held to. */
export const anchorMatches = (title: string, anchor: HabitAnchor): boolean => {
    const want = clean(anchor.to);
    return !!want && clean(title).includes(want);
};

/** "Right before Accounting", "30 min after Lunch". */
export function anchorLabel(anchor: HabitAnchor): string {
    const gap = anchor.gap ? `${anchor.gap >= 60 && anchor.gap % 60 === 0 ? `${anchor.gap / 60} hr` : `${anchor.gap} min`} ${anchor.side}` : `Right ${anchor.side}`;
    return `${gap} ${anchor.to}`;
}

export interface AnchorBlock { title: string; start: number; minutes: number; /** Travel there and back, in minutes. */ before?: number; after?: number }

/**
 * Where an anchored habit goes today: the start minute, or null when nothing
 * today matches. The first match of the day wins (two classes: before the first).
 */
export function anchoredStart(anchor: HabitAnchor, length: number, blocks: AnchorBlock[]): number | null {
    const match = blocks.filter(block => anchorMatches(block.title, anchor)).sort((a, b) => a.start - b.start)[0];
    if (!match) return null;
    if (anchor.side === 'before') return Math.max(0, match.start - (match.before ?? 0) - anchor.gap - length);
    return Math.min(24 * 60 - length, match.start + match.minutes + (match.after ?? 0) + anchor.gap);
}
