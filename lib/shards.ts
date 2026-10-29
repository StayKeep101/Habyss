/**
 * Shards: Habyss's currency. Marks are experience (they rank you and never
 * leave); Shards are what you spend, on bets on friends' goals
 * (lib/market.ts).
 *
 * Earned only by doing: one Shard for every five Marks that completing things
 * earned (lib/marks.ts completedByDay), at most twenty a day. A miss costs
 * Marks, never Shards. Things made and ticked the same day earn none, and the
 * daily cap means no pile of tiny tasks is worth more than an honest day. The
 * server holds the same cap against your account's age, so an edited phone
 * cannot mint them either. Everyone starts with a hundred.
 */
export const SHARDS = {
    /** Marks from completing things for each Shard. */
    perMarks: 5,
    /** The most Shards a day of doing can earn. */
    dailyCap: 20,
    /** What everyone starts with, enough for a few small bets on day one. */
    starter: 100,
} as const;

/** The Shards one day's completions earned. */
export const shardsForDay = (completedMarks: number): number =>
    Math.min(SHARDS.dailyCap, Math.floor(Math.max(0, completedMarks) / SHARDS.perMarks));

/** Every Shard earned by doing, all time. */
export function earnedShards(completedByDay: Record<string, number>): number {
    return Object.values(completedByDay).reduce((sum, marks) => sum + shardsForDay(marks), 0);
}

/* ------------------------------------------------------------- by the hour */

export interface TimedPoint { t: number; value: number }
/** Something that earned at a moment: a habit ticked (weight 5), a task finished (10). */
export interface TimedEarning { at: number; weight: number }

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** The wallet's ranges, like a trading app's, and how finely each is drawn. */
export const WALLET_RANGES = [
    { id: '1H', label: '1H', span: HOUR, step: 2 * MINUTE },
    { id: '24H', label: '24H', span: DAY, step: 30 * MINUTE },
    { id: '1W', label: '1W', span: 7 * DAY, step: 3 * HOUR },
    { id: '1M', label: '1M', span: 30 * DAY, step: 12 * HOUR },
    { id: '1Y', label: '1Y', span: 365 * DAY, step: DAY },
    { id: 'ALL', label: 'All', span: Infinity, step: 0 },
] as const;
export type WalletRange = typeof WALLET_RANGES[number]['id'];

const startOf = (day: string) => new Date(`${day}T00:00:00`).getTime();

/**
 * Every moment the balance moved, oldest first, starting at the hundred
 * everyone begins with. A day's Shards land across the moments things were
 * done that day, in proportion to what each earned, and add up to exactly
 * what the day earned (the cap included); a day with nothing timed lands at
 * noon. Bets move it at the moment they were placed or paid.
 */
export function walletTimeline(
    completedByDay: Record<string, number>,
    earnings: TimedEarning[],
    bets: { at: number; amount: number }[],
    now = Date.now(),
): TimedPoint[] {
    const moves: { t: number; amount: number }[] = bets.map(bet => ({ t: bet.at, amount: bet.amount }));
    for (const [day, marks] of Object.entries(completedByDay)) {
        const shards = shardsForDay(marks);
        if (!shards) continue;
        const from = startOf(day);
        const that = earnings.filter(item => item.at >= from && item.at < from + DAY && item.at <= now).sort((a, b) => a.at - b.at);
        if (!that.length) { moves.push({ t: Math.min(now, from + 12 * HOUR), amount: shards }); continue; }
        const total = that.reduce((sum, item) => sum + item.weight, 0);
        let given = 0;
        let running = 0;
        for (const item of that) {
            running += item.weight;
            const due = Math.floor((shards * running) / total);
            if (due > given) { moves.push({ t: item.at, amount: due - given }); given = due; }
        }
    }
    moves.sort((a, b) => a.t - b.t);
    const first = moves[0]?.t ?? now;
    const points: TimedPoint[] = [{ t: Math.min(first, now) - HOUR, value: SHARDS.starter }];
    let value: number = SHARDS.starter;
    for (const move of moves) {
        value = Math.max(0, value + move.amount);
        points.push({ t: move.t, value });
    }
    return points;
}

/** The balance at a moment: the last move at or before it. */
export function valueAt(points: TimedPoint[], t: number): number {
    let value = points[0]?.value ?? SHARDS.starter;
    for (const point of points) {
        if (point.t > t) break;
        value = point.value;
    }
    return value;
}

/** The balance across one range, one point per step, ending now. */
export function sampleRange(points: TimedPoint[], range: WalletRange, now = Date.now()): TimedPoint[] {
    const spec = WALLET_RANGES.find(item => item.id === range)!;
    const from = Number.isFinite(spec.span) ? now - spec.span : (points[0]?.t ?? now - DAY);
    const step = spec.step || Math.max(HOUR, Math.ceil((now - from) / 120));
    // One pass: the samples and the moves are both in time order.
    const out: TimedPoint[] = [];
    let index = 0;
    let value = points[0]?.value ?? SHARDS.starter;
    const advance = (t: number) => { while (index < points.length && points[index].t <= t) value = points[index++].value; };
    for (let t = from; t < now; t += step) { advance(t); out.push({ t, value }); }
    advance(now);
    out.push({ t: now, value });
    return out;
}
