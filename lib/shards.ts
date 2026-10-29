import { MARKS, type MarkEvent, type MarkItem, type MarkKind } from './marks';

/**
 * Shards: Habyss's currency. Marks are XP (they only go up and rank you);
 * Shards are what you have, and what you spend on bets (lib/market.ts).
 *
 * They follow the rules the Marks record keeps (lib/marks.ts): adding a
 * habit, task or goal earns, completing earns more (times the perfect-day
 * multiplier), and missing one costs. A good night's sleep earns, a short one
 * costs, a milestone earns. Never below zero. Everyone starts with a hundred.
 *
 * And they cannot be farmed:
 * - completing something made the same day earns nothing;
 * - a habit ticked more than a day after the day it counts for (filled in
 *   later) earns nothing;
 * - a goal pays its reward only if it existed at least three days;
 * - adding things earns at most ten a day, milestones at most two a day;
 * - no day earns more than two hundred, all together;
 * - deleting something takes back what it earned and keeps what it cost
 *   (lib/marks.ts, lib/marksLedger.ts).
 * The server holds earned Shards to that same daily ceiling for the
 * account's age, so an edited phone cannot mint them either.
 */
export const SHARDS = {
    /** What everyone starts with, enough for a few small bets on day one. */
    starter: 100,
    /** The most adding things can earn in a day. */
    addCap: 10,
    /** The most a day can earn, everything together. */
    dailyCap: 200,
    /** Milestones that pay Shards in one day. */
    milestonesPerDay: 2,
    /** Days a goal must have existed before reaching it pays Shards. */
    goalMinDays: 3,
    /** How late a habit may be ticked for a day and still pay (logging yesterday is fine). */
    lateTickDays: 1,
    /** What each thing earns or costs: the table the Marks record already keeps. */
    rules: MARKS,
} as const;

export interface ShardMove {
    t: number;
    date: string;
    amount: number;
    kind: MarkKind | 'stake' | 'payout' | 'refund';
    item?: MarkItem;
    title: string;
}

export interface TimedPoint { t: number; value: number }

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const startOf = (day: string) => new Date(`${day}T00:00:00`).getTime();
const pad = (n: number) => String(n).padStart(2, '0');
const dayOf = (t: number) => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

/**
 * Every Shard that moved, oldest first: the record's events at the moment
 * they happened (a habit at the minute it was ticked, `ticks` by
 * "habitId:date", when that was the same day; a miss as its day begins; a
 * night's sleep in the morning; anything else untimed at noon), with the
 * farming guards applied, and the bets the server holds.
 */
export function shardMoves(
    ledger: MarkEvent[],
    ticks: Record<string, number>,
    bets: { at: number; amount: number; reason: 'stake' | 'payout' | 'refund'; title: string }[] = [],
): ShardMove[] {
    const timed = ledger
        .filter(event => !event.sameDay && event.points !== 0)
        .filter(event => {
            if (event.kind !== 'complete') return true;
            // Filled in later: a tick made more than a day after the day it counts for.
            if (event.item === 'habit' && event.id) {
                const made = ticks[`${event.id}:${event.date}`];
                if (made !== undefined && made >= startOf(event.date) + (1 + SHARDS.lateTickDays) * DAY) return false;
            }
            // A goal made to be reached: it has to have lived a few days.
            if (event.item === 'goal' && event.madeOn && startOf(event.date) - startOf(event.madeOn) < SHARDS.goalMinDays * DAY) return false;
            return true;
        })
        .map(event => {
            const from = startOf(event.date);
            const tick = event.item === 'habit' && event.id ? ticks[`${event.id}:${event.date}`] : undefined;
            const t = event.kind === 'miss' ? from + MINUTE
                : event.item === 'habit' && event.kind === 'complete' ? (tick !== undefined && tick < from + DAY ? tick : from + 12 * HOUR)
                : event.item === 'sleep' ? from + 8 * HOUR
                : event.at !== undefined && event.at >= from && event.at < from + DAY ? event.at
                : from + 12 * HOUR;
            return { t, date: event.date, amount: event.points, kind: event.kind, item: event.item, title: event.title } as ShardMove;
        })
        .sort((a, b) => a.t - b.t);

    // The guards, day by day in the order things happened.
    const added = new Map<string, number>();
    const gained = new Map<string, number>();
    const milestones = new Map<string, number>();
    const moves: ShardMove[] = [];
    for (const move of timed) {
        let amount = move.amount;
        if (amount > 0 && move.item === 'milestone') {
            const count = milestones.get(move.date) ?? 0;
            milestones.set(move.date, count + 1);
            if (count >= SHARDS.milestonesPerDay) amount = 0;
        }
        if (amount > 0 && move.kind === 'add') {
            amount = Math.min(amount, SHARDS.addCap - (added.get(move.date) ?? 0));
            added.set(move.date, (added.get(move.date) ?? 0) + Math.max(0, amount));
        }
        if (amount > 0) {
            amount = Math.min(amount, SHARDS.dailyCap - (gained.get(move.date) ?? 0));
            gained.set(move.date, (gained.get(move.date) ?? 0) + Math.max(0, amount));
        }
        if (amount !== 0) moves.push({ ...move, amount });
    }
    for (const bet of bets) moves.push({ t: bet.at, date: dayOf(bet.at), amount: bet.amount, kind: bet.reason, title: bet.title });
    return moves.sort((a, b) => a.t - b.t);
}

/** The balance moment by moment from the hundred everyone starts with, never below zero. */
export function walletPoints(moves: ShardMove[], now = Date.now()): TimedPoint[] {
    const first = moves[0]?.t ?? now;
    const points: TimedPoint[] = [{ t: Math.min(first, now) - HOUR, value: SHARDS.starter }];
    let value: number = SHARDS.starter;
    for (const move of moves) {
        if (move.t > now) break;
        value = Math.max(0, value + move.amount);
        points.push({ t: move.t, value });
    }
    return points;
}

/* ------------------------------------------------------------- the ranges */

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

/** The balance at the end of each of the last `days` days, for a profile's backdrop. */
export function dailyCloses(points: TimedPoint[], days = 60, now = Date.now()): number[] {
    const today = startOf(dayOf(now));
    return Array.from({ length: days }, (_, index) => valueAt(points, today - (days - 1 - index) * DAY + DAY - 1));
}

/** What moved today, everything together. */
export function changeToday(moves: ShardMove[], now = Date.now()): number {
    const today = dayOf(now);
    return moves.filter(move => move.date === today && move.t <= now).reduce((sum, move) => sum + move.amount, 0);
}

