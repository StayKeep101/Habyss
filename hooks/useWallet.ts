import { useCallback, useEffect, useMemo, useState } from 'react';
import { on } from '@/lib/appEvents';
import { getCompletionStamps } from '@/lib/habitsSQLite';
import { myWallet, type LedgerEntry } from '@/lib/market';
import { publishShards } from '@/lib/marksSync';
import { SHARDS, changeToday, shardMoves, walletPoints, type ShardMove, type TimedPoint } from '@/lib/shards';
import { rememberShardEarnings } from '@/lib/shardHistory';
import type { MarkEvent } from '@/lib/marks';
import type { Marks } from '@/hooks/useMarks';

export interface Wallet {
    /** What you have now: the starter hundred, everything doing earned and cost, and what bets moved. */
    balance: number;
    /** Shards on bets still open. */
    inPlay: number;
    /** What doing has earned (and cost) since you started, bets left out: the gems that fly in count its rises. */
    earned: number;
    /** The change today, everything together. */
    today: number;
    /** Every moment the balance moved, oldest first, for the hour-by-hour chart. */
    timeline: TimedPoint[];
    /** The newest moves first, for the transactions list. */
    activity: ShardMove[];
}

/**
 * Your Shards wallet: the Marks record's events with Shards' rules applied
 * (lib/shards.ts), at the moments they happened, plus what bets moved on the
 * server (lib/market.ts). The doing part moves the instant something is
 * ticked; the bets part is read again whenever a bet is placed or settled.
 * The earned total is sent to the server, which checks bets against it.
 */
export function useWallet(marks: Pick<Marks, 'ledger'>, ready = true): Wallet {
    const [bets, setBets] = useState<{ ledger: number; inPlay: number; entries: LedgerEntry[] }>({ ledger: 0, inPlay: 0, entries: [] });
    const refresh = useCallback(() => { myWallet().then(setBets).catch(() => undefined); }, []);
    useEffect(() => {
        refresh();
        const sub = on('market_changed', refresh);
        return () => sub.remove();
    }, [refresh]);

    // When each habit tick was made, read again whenever the record changes: the moments Shards
    // landed, and which ticks were filled in later (those earn none).
    const [ticks, setTicks] = useState<Record<string, number>>({});
    const [reserved, setReserved] = useState<MarkEvent[]>([]);
    const [processed, setProcessed] = useState<MarkEvent[] | null>(null);
    useEffect(() => {
        if (!ready) return;
        let cancelled = false;
        Promise.all([getCompletionStamps(400), rememberShardEarnings(marks.ledger)]).then(([rows, history]) => {
            if (cancelled) return;
            const found: Record<string, number> = {};
            for (const [key, at] of Object.entries(rows)) { const t = new Date(at).getTime(); if (Number.isFinite(t)) found[key] = t; }
            setTicks(found);
            setReserved(history);
            setProcessed(marks.ledger);
        }).catch(() => undefined);
        return () => { cancelled = true; };
    }, [marks.ledger, ready]);

    const wallet = useMemo<Wallet>(() => {
        const moves = shardMoves(marks.ledger, ticks, bets.entries.map(entry => ({ at: new Date(entry.at).getTime(), amount: entry.amount, reason: entry.reason, title: entry.title })), reserved);
        const timeline = walletPoints(moves);
        // Bets older than the newest hundred listed still count: folded into where the line starts.
        const listed = bets.entries.reduce((sum, entry) => sum + entry.amount, 0);
        if (bets.ledger !== listed) for (const point of timeline) point.value = Math.max(0, point.value + bets.ledger - listed);
        const balance = timeline[timeline.length - 1]?.value ?? SHARDS.starter;
        return {
            balance,
            inPlay: bets.inPlay,
            earned: balance - SHARDS.starter - bets.ledger,
            today: changeToday(moves),
            timeline,
            activity: [...moves].reverse().slice(0, 40),
        };
    }, [marks.ledger, ticks, bets, reserved]);

    // The server checks bets against what doing earned, capped by the account's age.
    useEffect(() => { if (ready && processed === marks.ledger) void publishShards(Math.max(0, wallet.earned)); }, [wallet.earned, ready, processed, marks.ledger]);

    return wallet;
}
