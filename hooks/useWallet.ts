import { useCallback, useEffect, useMemo, useState } from 'react';
import { on } from '@/lib/appEvents';
import { localDateKey } from '@/lib/habitSchedule';
import { myWallet, type LedgerEntry } from '@/lib/market';
import { publishShards } from '@/lib/marksSync';
import { SHARDS, earnedShards, shardsForDay, walletSeries, type WalletPoint } from '@/lib/shards';
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
    series: WalletPoint[];
    activity: WalletActivity[];
}

/**
 * Your Shards wallet, from the Marks Home already worked out (lib/shards.ts)
 * and what bets have moved on the server (lib/market.ts). The earned part
 * moves the instant something is ticked; the bets part is read again whenever
 * a bet is placed or settled.
 */
export function useWallet(marks: Pick<Marks, 'completedByDay'>): Wallet {
    const [bets, setBets] = useState<{ ledger: number; inPlay: number; entries: LedgerEntry[] }>({ ledger: 0, inPlay: 0, entries: [] });
    const refresh = useCallback(() => { myWallet().then(setBets).catch(() => undefined); }, []);
    useEffect(() => {
        refresh();
        const sub = on('market_changed', refresh);
        return () => sub.remove();
    }, [refresh]);

    const earned = useMemo(() => earnedShards(marks.completedByDay), [marks.completedByDay]);
    // The server checks bets against this, capped by the account's age.
    useEffect(() => { void publishShards(earned); }, [earned]);

    return useMemo(() => {
        const today = localDateKey(new Date());
        // What bets moved, by the local day they happened. Entries older than the
        // newest hundred are folded into the first day, so the line still ends at the balance.
        const moves: Record<string, number> = {};
        let listed = 0;
        for (const entry of bets.entries) {
            const day = localDateKey(new Date(entry.at));
            moves[day] = (moves[day] ?? 0) + entry.amount;
            listed += entry.amount;
        }
        const series = walletSeries(marks.completedByDay, moves, today);
        if (bets.ledger !== listed && series.length) {
            const older = bets.ledger - listed;
            for (const point of series) point.value = Math.max(0, point.value + older);
        }
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
            series,
            activity,
        };
    }, [marks.completedByDay, earned, bets]);
}
