import { addDays } from './goalInsights';

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

export interface WalletPoint { date: string; value: number }

/**
 * The wallet day by day, oldest first, ending today: the starter Shards, plus
 * what each day earned, plus what bets moved (`moves`: Shards in or out by
 * local day, from the server's ledger).
 */
export function walletSeries(completedByDay: Record<string, number>, moves: Record<string, number>, today: string): WalletPoint[] {
    const days = [...Object.keys(completedByDay), ...Object.keys(moves)].filter(day => day <= today).sort();
    const first = days[0] ?? today;
    const series: WalletPoint[] = [];
    let value: number = SHARDS.starter;
    for (let day = first; day <= today; day = addDays(day, 1)) {
        value = Math.max(0, value + shardsForDay(completedByDay[day] ?? 0) + (moves[day] ?? 0));
        series.push({ date: day, value });
    }
    return series;
}
