import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * The hard lock on Earn your scroll (lib/appGate.ts). Once it is on, it cannot
 * simply be switched off, and the list of blocked apps cannot be changed: you
 * ask to unlock, and the lock opens only a day later. The craving passes long
 * before then; a real reason to change it does not. You can take the request
 * back at any time. Once open, it stays open for a day for the one change you
 * asked for, then locks again by itself.
 */

/** How long a request to unlock takes. */
export const UNLOCK_WAIT_MS = 24 * 3600_000;
/** How long the lock stays open once the wait is over. */
export const UNLOCK_OPEN_MS = 24 * 3600_000;

const KEY = 'habyss_gate_unlock_asked';

export type LockState =
    | { kind: 'locked' }
    | { kind: 'waiting'; opensAt: number }
    | { kind: 'open'; closesAt: number };

/** Where the lock stands, from when the unlock was asked (or null). */
export function lockState(askedAt: number | null, now: number): LockState {
    if (askedAt == null || !Number.isFinite(askedAt)) return { kind: 'locked' };
    const opensAt = askedAt + UNLOCK_WAIT_MS;
    if (now < opensAt) return { kind: 'waiting', opensAt };
    const closesAt = opensAt + UNLOCK_OPEN_MS;
    if (now < closesAt) return { kind: 'open', closesAt };
    return { kind: 'locked' };
}

async function askedAt(): Promise<number | null> {
    try {
        const stored = await AsyncStorage.getItem(KEY);
        const value = stored == null ? NaN : Number(stored);
        return Number.isFinite(value) ? value : null;
    } catch { return null; }
}

export async function currentLock(now = Date.now()): Promise<LockState> {
    return lockState(await askedAt(), now);
}

/** Starts the wait; returns when the lock opens. Asking again does not restart it. */
export async function askToUnlock(now = Date.now()): Promise<number> {
    const state = await currentLock(now);
    if (state.kind === 'waiting') return state.opensAt;
    await AsyncStorage.setItem(KEY, String(now)).catch(() => undefined);
    return now + UNLOCK_WAIT_MS;
}

/** Takes the request back, or closes the lock again once the change is made. */
export async function relock(): Promise<void> {
    await AsyncStorage.removeItem(KEY).catch(() => undefined);
}
