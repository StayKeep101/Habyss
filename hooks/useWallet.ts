import { useCallback, useEffect, useMemo, useState } from 'react';
import { on } from '@/lib/appEvents';
import { localDateKey } from '@/lib/habitSchedule';
import { myWallet, type LedgerEntry } from '@/lib/market';
import { publishShards } from '@/lib/marksSync';
import { SHARDS, earnedShards, shardsForDay, walletTimeline, type TimedEarning, type TimedPoint } from '@/lib/shards';
import { getCompletionTicks } from '@/lib/habitsSQLite';
import { MARKS } from '@/lib/marks';
import type { Task } from '@/lib/tasks';
import type { Marks } from '@/hooks/useMarks';

export interface WalletActivity {
    key: string;
    date: string;
    title: string;
    detail: string;
    amount: number;
    kind: 'earned' | LedgerEntry['reason'];
}

export interface Wallet {
    /** What you have to spend now: the starter hundred, everything earned, and what bets moved. */
    balance: number;
    /** Shards on bets still open. */
    inPlay: number;
    /** Every Shard ever earned by doing (what the gems that fly in are counted from). */
    earned: number;
    /** Earned today by doing, and how much of the day's cap is left. */
    today: number;
    capLeft: number;
    /** Every moment the balance moved, oldest first (lib/shards.ts walletTimeline), for the hour-by-hour chart. */
    timeline: TimedPoint[];
    activity: WalletActivity[];
}

/**
 * Your Shards wallet, from the Marks Home already worked out (lib/shards.ts)
 * and what bets have moved on the server (lib/market.ts). The earned part
 * moves the instant something is ticked; the bets part is read again whenever
 * a bet is placed or settled.
 */
export function useWallet(marks: Pick<Marks, 'completedByDay'>, tasks: Task[]): Wallet {
    const [bets, setBets] = useState<{ ledger: number; inPlay: number; entries: LedgerEntry[] }>({ ledger: 0, inPlay: 0, entries: [] });
    const refresh = useCallback(() => { myWallet().then(setBets).catch(() => undefined); }, []);
    useEffect(() => {
        refresh();
        const sub = on('market_changed', refresh);
        return () => sub.remove();
    }, [refresh]);

    const earned = useMemo(() => earnedShards(marks.completedByDay), [marks.completedByDay]);
    // When habits were ticked, read again whenever what was earned changes: the moments Shards landed.
    const [ticks, setTicks] = useState<{ at: string }[]>([]);
    useEffect(() => { getCompletionTicks(400).then(setTicks).catch(() => undefined); }, [marks.completedByDay]);
    // The server checks bets against this, capped by the account's age.
    useEffect(() => { void publishShards(earned); }, [earned]);

    return useMemo(() => {
        const today = localDateKey(new Date());
        // Entries older than the newest hundred are folded into where the line starts.
        const listed = bets.entries.reduce((sum, entry) => sum + entry.amount, 0);
        const earnings: TimedEarning[] = [
            ...ticks.map(tick => ({ at: new Date(tick.at).getTime(), weight: MARKS.complete.habit })),
            ...tasks.filter(task => task.status === 'done' && task.completedAt).map(task => ({ at: new Date(task.completedAt!).getTime(), weight: MARKS.complete.task })),
        ].filter(item => Number.isFinite(item.at));
        const timeline = walletTimeline(marks.completedByDay, earnings, bets.entries.map(entry => ({ at: new Date(entry.at).getTime(), amount: entry.amount })));
        // Bets older than the newest hundred listed still count: folded into where the line starts.
        if (bets.ledger !== listed) for (const point of timeline) point.value = Math.max(0, point.value + bets.ledger - listed);
        const todayEarned = shardsForDay(marks.completedByDay[today] ?? 0);
        const earnedRows: WalletActivity[] = Object.entries(marks.completedByDay)
            .map(([date, points]) => ({ date, amount: shardsForDay(points) }))
            .filter(row => row.amount > 0)
            .map(row => ({
                key: `earned-${row.date}`, date: row.date, kind: 'earned' as const, amount: row.amount,
                title: 'Earned by doing', detail: row.amount >= SHARDS.dailyCap ? 'Daily limit reached' : 'Habits, tasks and goals done',
            }));
        const betRows: WalletActivity[] = bets.entries.map((entry, index) => ({
            key: `bet-${entry.at}-${index}`, date: localDateKey(new Date(entry.at)), kind: entry.reason, amount: entry.amount,
            title: entry.reason === 'stake' ? 'Bet placed' : entry.reason === 'payout' ? 'Bet won' : 'Bet refunded',
            detail: entry.title,
        }));
        const activity = [...earnedRows, ...betRows].sort((a, b) => b.date.localeCompare(a.date) || b.amount - a.amount).slice(0, 40);
        return {
            balance: SHARDS.starter + earned + bets.ledger,
            inPlay: bets.inPlay,
            earned,
            today: todayEarned,
            capLeft: Math.max(0, SHARDS.dailyCap - todayEarned),
            timeline,
            activity,
        };
    }, [marks.completedByDay, earned, bets, ticks, tasks]);
}
