import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ShardMove } from './shards';

/**
 * Shards that moved while you were not in the app: a night's sleep, a run
 * Apple Health counted, a habit ticked from the Lock Screen card, a bet
 * settled. Habyss remembers when you last had it open; coming back, what
 * moved since is summed and said once (components/Shards/AwayShards.tsx).
 */
const KEY = 'habyss_shards_seen_at';

export async function shardsSeenAt(): Promise<number | null> {
    try { const raw = await AsyncStorage.getItem(KEY); return raw ? Number(raw) || null : null; } catch { return null; }
}
export async function markShardsSeen(at = Date.now()): Promise<void> {
    await AsyncStorage.setItem(KEY, String(at)).catch(() => undefined);
}

export interface AwayLine { title: string; amount: number }
export interface AwaySummary { total: number; lines: AwayLine[] }

/** What moved after `since` (up to `now`), each kind of thing once, biggest first; null when nothing was earned. */
export function earnedSince(moves: Pick<ShardMove, 't' | 'amount' | 'title' | 'held'>[], since: number, now: number): AwaySummary | null {
    const fresh = moves.filter(move => move.t > since && move.t <= now && move.amount !== 0 && !move.held);
    const byTitle = new Map<string, number>();
    for (const move of fresh) byTitle.set(move.title, (byTitle.get(move.title) ?? 0) + move.amount);
    const lines = [...byTitle.entries()].map(([title, amount]) => ({ title, amount })).filter(line => line.amount !== 0)
        .sort((a, b) => b.amount - a.amount);
    const total = lines.reduce((sum, line) => sum + line.amount, 0);
    if (!lines.some(line => line.amount > 0) || total <= 0) return null;
    return { total, lines };
}
