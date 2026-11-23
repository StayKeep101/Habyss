import { getSupabase } from './supabase';
import { emit } from './appEvents';

/**
 * Race the clock (supabase/migrations/20261122000100_races.sql): a challenge
 * you set yourself. Tasks from your plan, a time, a stake; friends bet for or
 * against you. The server keeps every Shard and pays out; this file asks it,
 * works out what a bet would pay before it is placed, and says how long is left.
 *
 * Won: your stake back, plus Habyss's match (up to 500, your first race of the
 * day), plus what was bet against you when nobody backed you. Missed: your
 * stake goes to those who bet against you.
 */

export type RaceSide = 'for' | 'against';
export type RaceStatus = 'open' | 'won' | 'missed' | 'void';
export interface RaceTask { key: string; title: string }

export interface Race {
    id: string;
    ownerId: string;
    name: string;
    avatarUrl?: string;
    title: string;
    tasks: RaceTask[];
    stake: number;
    /** What Habyss adds on a win (0 for a second race that day). */
    match: number;
    startsAt: number;
    endsAt: number;
    status: RaceStatus;
    payout: number | null;
    pool: Record<RaceSide, number>;
    people: Record<RaceSide, number>;
    mine: boolean;
    myBet: { side: RaceSide; amount: number; payout: number | null } | null;
}

/** A task with no estimate is expected to take this long. */
export const TYPICAL_TASK = 90;

/** How long the chosen tasks should take: their estimates, 90 minutes each without one. */
export const expectedMinutes = (tasks: { estimatedMinutes?: number }[]): number =>
    tasks.reduce((sum, task) => sum + (task.estimatedMinutes && task.estimatedMinutes > 0 ? task.estimatedMinutes : TYPICAL_TASK), 0);

/**
 * The times you can race in: 15 minutes up to what the tasks should take (a
 * race is beating the clock, never padding it), in quarter hours, at most 12 hours.
 */
export function raceTimes(expected: number): number[] {
    const cap = Math.max(RACE_MIN, Math.min(RACE_MAX, Math.floor(expected / 15) * 15));
    return Array.from({ length: cap / 15 }, (_, index) => (index + 1) * 15);
}
export const RACE_MIN = 15;
export const RACE_MAX = 12 * 60;
/** Habyss's match on a win, at most. */
export const MATCH_CAP = 500;
/** What one friend can put on one race. */
export const BET_CAP = 100;
export const BET_STAKES = [10, 25, 50, 100] as const;

/** "1h 25m left", "12m left", "0:42 left" in the last minute. */
export function timeLeft(endsAt: number, now: number): string {
    const seconds = Math.max(0, Math.round((endsAt - now) / 1000));
    if (seconds < 60) return `0:${String(seconds).padStart(2, '0')} left`;
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    return hours ? `${hours}h ${minutes % 60}m left` : `${minutes}m left`;
}

/** A race's name from what it is: "3 tasks in 3 hours". */
export function raceTitle(tasks: number, minutes: number): string {
    const time = minutes % 60 === 0 ? `${minutes / 60} hour${minutes === 60 ? '' : 's'}` : minutes > 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes} minutes`;
    return `${tasks === 1 ? '1 task' : `${tasks} tasks`} in ${time}`;
}

/** What you get back if you win: your stake and Habyss's match (bets against you come on top when nobody backs you). */
export const ownerWin = (stake: number, firstToday: boolean): number => stake + (firstToday ? Math.min(stake, MATCH_CAP) : 0);

/** What a friend's bet would return if that side wins, the pool as it stands plus this bet (a miss adds the owner's stake to "against"). */
export function betPayout(amount: number, side: RaceSide, pool: Record<RaceSide, number>, ownerStake: number, already = 0): number {
    const mine = already + amount;
    if (mine <= 0) return 0;
    const winners = pool[side] + amount;
    const losers = side === 'for' ? pool.against : pool.for + ownerStake;
    return mine + Math.floor((losers * mine) / winners);
}

async function client() {
    const sb = getSupabase();
    if (!sb) return null;
    const { data } = await sb.auth.getSession();
    return data.session?.user?.id ? { sb, me: data.session.user.id } : null;
}

/** Your race and your friends', running or finished this week. */
export async function raceFeed(): Promise<Race[]> {
    const ctx = await client();
    if (!ctx) return [];
    const { data, error } = await ctx.sb.rpc('race_feed');
    if (error) { console.warn('[Races] could not load:', error.message); return []; }
    return ((data as any[]) ?? []).map(row => ({
        id: row.id,
        ownerId: row.owner_id,
        name: (row.display_name || row.username || 'A friend') as string,
        avatarUrl: row.avatar_url ?? undefined,
        title: row.title,
        tasks: Array.isArray(row.tasks) ? row.tasks.map((task: any) => ({ key: String(task.key), title: String(task.title) })) : [],
        stake: Number(row.stake) || 0,
        match: Number(row.match) || 0,
        startsAt: Date.parse(row.starts_at),
        endsAt: Date.parse(row.ends_at),
        status: row.status as RaceStatus,
        payout: row.payout ?? null,
        pool: { for: Number(row.for_total) || 0, against: Number(row.against_total) || 0 },
        people: { for: Number(row.backers) || 0, against: Number(row.doubters) || 0 },
        mine: row.owner_id === ctx.me,
        myBet: row.my_side ? { side: row.my_side as RaceSide, amount: Number(row.my_amount) || 0, payout: row.my_payout ?? null } : null,
    }));
}

/** Starts your race: those tasks, that many minutes, that stake. */
export async function openRace(tasks: RaceTask[], minutes: number, stake: number): Promise<string> {
    const ctx = await client();
    if (!ctx) throw new Error('Sign in to race the clock.');
    const { data, error } = await ctx.sb.rpc('open_race', {
        p_title: raceTitle(tasks.length, minutes), p_tasks: tasks, p_minutes: Math.round(minutes), p_stake: Math.round(stake),
    });
    if (error) throw new Error(error.message);
    emit('market_changed');
    return String(data);
}

export async function betOnRace(raceId: string, side: RaceSide, amount: number): Promise<void> {
    const ctx = await client();
    if (!ctx) throw new Error('Sign in to bet.');
    const { error } = await ctx.sb.rpc('bet_on_race', { p_race: raceId, p_side: side, p_amount: amount });
    if (error) throw new Error(error.message);
    emit('market_changed');
}

/** Your phone, when the last task is ticked (won), or when you give up. */
export async function finishRace(raceId: string, won: boolean): Promise<string | null> {
    const ctx = await client();
    if (!ctx) return null;
    const { data, error } = await ctx.sb.rpc('finish_race', { p_race: raceId, p_won: won });
    if (error) { console.warn('[Races] could not finish:', error.message); return null; }
    emit('market_changed');
    return String(data);
}

/** Whether every task in the race is done, each before the clock ran out. */
export function raceDone(race: Pick<Race, 'tasks' | 'endsAt'>, tasks: { id: string; status: string; completedAt?: string | null }[]): boolean {
    return race.tasks.length > 0 && race.tasks.every(item => {
        const task = tasks.find(candidate => candidate.id === item.key);
        if (!task || task.status !== 'done') return false;
        const at = task.completedAt ? Date.parse(task.completedAt) : Date.now();
        return at <= race.endsAt + 2 * 60_000;
    });
}
