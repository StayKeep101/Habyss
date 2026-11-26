import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Habyss's own passcode, for App Lock (components/Auth/BiometricGuard.tsx):
 * what you type when Face ID fails or you'd rather not use it, on Habyss's own
 * keypad instead of iOS's. Four digits, kept only as a salted SHA-256 in the
 * Keychain (expo-secure-store), never as typed. Five wrong in a row and it
 * waits 30 seconds, then a minute, then five. The iPhone passcode stays as the
 * way back in if it is forgotten.
 */

export const PASSCODE_LENGTH = 4;
const KEY = 'habyss_app_passcode';
const TRIES_KEY = 'habyss_app_passcode_tries';
const WAITS = [30_000, 60_000, 300_000];

const secure = () => require('expo-secure-store') as typeof import('expo-secure-store');
const crypto = () => require('expo-crypto') as typeof import('expo-crypto');

async function hash(code: string, salt: string): Promise<string> {
    const { digestStringAsync, CryptoDigestAlgorithm } = crypto();
    return digestStringAsync(CryptoDigestAlgorithm.SHA256, `${salt}:${code}`);
}

export async function hasPasscode(): Promise<boolean> {
    try { return !!(await secure().getItemAsync(KEY)); } catch { return false; }
}

export async function setPasscode(code: string): Promise<void> {
    if (!new RegExp(`^\\d{${PASSCODE_LENGTH}}$`).test(code)) throw new Error(`Use ${PASSCODE_LENGTH} digits.`);
    const salt = crypto().randomUUID();
    await secure().setItemAsync(KEY, JSON.stringify({ salt, hash: await hash(code, salt) }));
    await AsyncStorage.removeItem(TRIES_KEY).catch(() => undefined);
}

export async function clearPasscode(): Promise<void> {
    await secure().deleteItemAsync(KEY).catch(() => undefined);
    await AsyncStorage.removeItem(TRIES_KEY).catch(() => undefined);
}

interface Tries { wrong: number; until: number; rounds: number }
async function readTries(): Promise<Tries> {
    try { return { wrong: 0, until: 0, rounds: 0, ...JSON.parse((await AsyncStorage.getItem(TRIES_KEY)) ?? '{}') }; } catch { return { wrong: 0, until: 0, rounds: 0 }; }
}

/** How long until another try is allowed (ms); 0 when it is. */
export async function passcodeWait(now = Date.now()): Promise<number> {
    return Math.max(0, (await readTries()).until - now);
}

/** The next state after a wrong try: every fifth waits, longer each round. Pure. */
export function afterWrong(tries: Tries, now: number): Tries {
    const wrong = tries.wrong + 1;
    if (wrong < 5) return { ...tries, wrong };
    return { wrong: 0, rounds: tries.rounds + 1, until: now + WAITS[Math.min(tries.rounds, WAITS.length - 1)] };
}

/** 'ok', 'wrong', or 'wait' (too many wrong: try again later). */
export async function checkPasscode(code: string, now = Date.now()): Promise<'ok' | 'wrong' | 'wait'> {
    const tries = await readTries();
    if (tries.until > now) return 'wait';
    try {
        const stored = JSON.parse((await secure().getItemAsync(KEY)) ?? 'null') as { salt: string; hash: string } | null;
        if (stored && (await hash(code, stored.salt)) === stored.hash) {
            await AsyncStorage.removeItem(TRIES_KEY).catch(() => undefined);
            return 'ok';
        }
    } catch { /* counted as wrong */ }
    await AsyncStorage.setItem(TRIES_KEY, JSON.stringify(afterWrong(tries, now))).catch(() => undefined);
    return 'wrong';
}
