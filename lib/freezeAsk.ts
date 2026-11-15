import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * When Echo asks you to send a friend a streak freeze — the only time one is
 * sent (components/Echo/FreezeAskHost.tsx). In the evening, a friend with a
 * streak worth keeping (3 days or more) who has done nothing today is about to
 * lose it; Echo asks about the one with the longest, once a day per friend.
 */
export interface FreezeCandidate { id: string; name: string; avatarUrl?: string; streak: number }
export const FREEZE_ASK = { fromHour: 18, minStreak: 3 } as const;

/** The friend to ask about now, or null. Pure. */
export function friendToSave(
    friends: { userId: string; displayName?: string; username: string; avatarUrl?: string; currentStreak?: number; todayCompleted?: number; todayTotal?: number }[],
    now: Date,
    asked: Set<string>,
): FreezeCandidate | null {
    if (now.getHours() < FREEZE_ASK.fromHour) return null;
    const day = dayKey(now);
    const atRisk = friends
        .filter(friend => (friend.currentStreak ?? 0) >= FREEZE_ASK.minStreak && (friend.todayTotal ?? 0) > 0 && (friend.todayCompleted ?? 0) === 0)
        .filter(friend => !asked.has(`${friend.userId}:${day}`))
        .sort((a, b) => (b.currentStreak ?? 0) - (a.currentStreak ?? 0));
    const friend = atRisk[0];
    return friend ? { id: friend.userId, name: friend.displayName || friend.username, avatarUrl: friend.avatarUrl, streak: friend.currentStreak ?? 0 } : null;
}

const pad = (n: number) => String(n).padStart(2, '0');
const dayKey = (at: Date) => `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
const KEY = 'habyss_freeze_asked';

export async function askedSet(): Promise<Set<string>> {
    try { return new Set(JSON.parse((await AsyncStorage.getItem(KEY)) ?? '[]') as string[]); } catch { return new Set(); }
}
/** Asked about this friend today: not again until tomorrow. Only the last few weeks are kept. */
export async function markAsked(friendId: string, now = new Date()): Promise<void> {
    const all = [...await askedSet(), `${friendId}:${dayKey(now)}`].slice(-60);
    await AsyncStorage.setItem(KEY, JSON.stringify(all)).catch(() => undefined);
}

/** Looks at your friends and asks, at most once a day per friend (Home calls it as it comes into view). */
export async function maybeAskForFreeze(now = new Date()): Promise<void> {
    if (now.getHours() < FREEZE_ASK.fromHour) return;
    try {
        const { FriendsService } = require('./friendsService') as typeof import('./friendsService');
        const friends = await FriendsService.getFriendsWithProgress();
        const friend = friendToSave(friends, now, await askedSet());
        if (!friend) return;
        await markAsked(friend.id, now);
        (require('./appEvents') as typeof import('./appEvents')).emit('show_freeze_ask', friend);
    } catch { /* offline or signed out: nobody to ask about */ }
}
