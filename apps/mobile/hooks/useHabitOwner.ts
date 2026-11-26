import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/** Who set a habit up: you, or the friend who shared it with you (lib/sharedAdopt.ts). */
export interface HabitOwner { name: string; mine: boolean }

/**
 * The last answer for each habit, kept between screens and launches, so a
 * habit opened before shows its own buttons straight away. Cleared with the
 * other social caches when another account takes the phone (personalBackup).
 */
export const HABIT_OWNER_KEY = 'habyss_habit_owner';
let memo: Record<string, HabitOwner> = {};
let loaded: Promise<void> | null = null;
const load = () => loaded ??= AsyncStorage.getItem(HABIT_OWNER_KEY)
    .then(raw => { const parsed = raw ? JSON.parse(raw) : null; if (parsed && typeof parsed === 'object') memo = { ...parsed, ...memo }; })
    .catch(() => undefined);
const remember = (id: string, owner: HabitOwner) => {
    memo = { ...memo, [id]: owner };
    void AsyncStorage.setItem(HABIT_OWNER_KEY, JSON.stringify(memo)).catch(() => undefined);
};
const YOURS: HabitOwner = { name: 'You', mine: true };

/**
 * Whether a habit is yours to change, and `known` once that is certain.
 *
 * A page waits for `known` before drawing Share and Edit (or the lock), so it
 * never shows one set of buttons and then swaps them for the other. Most
 * habits are nobody else's, and the phone's list of shared ids says so at
 * once; only a shared one asks the server, and remembers the answer.
 */
export function useHabitOwner(habitId: string | undefined): { owner: HabitOwner; known: boolean } {
    const [state, setState] = useState<{ id?: string; owner: HabitOwner | null }>(() => ({ id: habitId, owner: habitId ? memo[habitId] ?? null : YOURS }));
    useEffect(() => {
        if (!habitId) return;
        let alive = true;
        const settle = (owner: HabitOwner) => { if (alive) setState({ id: habitId, owner }); };
        void (async () => {
            await load();
            if (memo[habitId]) settle(memo[habitId]);
            const { FriendsService } = require('@/lib/friendsService') as typeof import('@/lib/friendsService');
            const shared = (await FriendsService.sharedIds().catch(() => new Set<string>())).has(habitId);
            // Not shared with anyone: yours, known at once.
            if (!shared && !memo[habitId]) settle(YOURS);
            const rows = await FriendsService.getSharedItemParticipants(habitId, 'habit').catch(() => null);
            if (rows === null) { if (!memo[habitId]) settle(YOURS); return; }
            const found = (rows as { isOwner?: boolean; isYou?: boolean; username?: string }[]).find(row => row.isOwner);
            const owner = rows.length < 2 || !found || found.isYou ? YOURS : { name: found.username ?? 'A friend', mine: false };
            remember(habitId, owner);
            settle(owner);
        })();
        return () => { alive = false; };
    }, [habitId]);
    const owner = state.id === habitId ? state.owner : habitId ? memo[habitId] ?? null : YOURS;
    return { owner: owner ?? YOURS, known: owner !== null };
}
