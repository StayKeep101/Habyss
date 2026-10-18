import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Echo's easter eggs. Now and then, Echo's line on Home is not a line but a
 * door: tap it and a small pop-up opens.
 *
 * - Help a friend: send one of them a streak freeze.
 * - A memory: Echo says back something real it noticed about you.
 * - The vault: Echo asks for a word, like Geometry Dash's vault. The right
 *   words unlock secrets, kept in a collection on the Echo page.
 *
 * Rare by design (about one Home visit in eight, at most once a day, never
 * the same one twice in a row), so finding one feels like finding something.
 */

export type EggId = 'help_friend' | 'memory' | 'vault';

export const EGG_LINES: Record<EggId, string[]> = {
    help_friend: ['Psst. Someone you know could use a hand today.', 'A friend’s streak is on thin ice. You could help.', 'Help your friend out. Tap me.'],
    memory: ['I remember something about you.', 'Want to hear what I noticed?'],
    vault: ['Say the word.', 'There is a door here. Do you know the word?', 'I keep secrets. Want one?'],
};

/** The vault's words and what they unlock. Case and spaces do not matter. */
export const VAULT: Record<string, string> = {
    abyss: 'You stared into it. It blinked first.',
    climb: 'One foothold at a time. That is the whole secret.',
    echo: 'You called. I answered. I always will.',
    discipline: 'Freedom, with a longer name.',
    communisme: 'Muhahahaha. The app stays free. Kof kof.',
    habyss: 'You found the name inside the name.',
    streak: 'Not a chain. A rope you climb.',
};

export interface EggState { found: EggId[]; words: string[]; lastDay?: string; lastEgg?: EggId }
const KEY = 'habyss_echo_eggs';
let state: EggState = { found: [], words: [] };
let loaded = false;
const listeners = new Set<() => void>();
export const currentEggs = (): EggState => state;
export function subscribeEggs(listener: () => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}
async function commit(next: EggState) {
    state = next;
    listeners.forEach(listener => listener());
    await AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => undefined);
}
export async function loadEggs(): Promise<EggState> {
    if (loaded) return state;
    loaded = true;
    try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw) { state = { found: [], words: [], ...JSON.parse(raw) }; listeners.forEach(l => l()); }
    } catch { /* none yet */ }
    return state;
}

/** Whether this Home visit shows an egg, and which. Pure: `random` is passed in. */
export function pickEgg(current: EggState, context: { today: string; hasFriends: boolean; hasMemory: boolean }, random: () => number = Math.random): EggId | null {
    if (current.lastDay === context.today) return null;
    if (random() >= 0.125) return null;
    const eligible = (['help_friend', 'memory', 'vault'] as EggId[])
        .filter(id => (id !== 'help_friend' || context.hasFriends) && (id !== 'memory' || context.hasMemory) && id !== current.lastEgg);
    if (!eligible.length) return null;
    return eligible[Math.floor(random() * eligible.length) % eligible.length];
}

export const eggLine = (id: EggId, random: () => number = Math.random) => EGG_LINES[id][Math.floor(random() * EGG_LINES[id].length) % EGG_LINES[id].length];

export async function markShown(id: EggId, today: string): Promise<void> {
    await loadEggs();
    await commit({ ...state, lastDay: today, lastEgg: id });
}

export async function markFound(id: EggId): Promise<void> {
    await loadEggs();
    if (!state.found.includes(id)) await commit({ ...state, found: [...state.found, id] });
}

const normal = (word: string) => word.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');

/** Tries a word in the vault: its secret, or null. A found word is kept. */
export async function tryWord(word: string): Promise<string | null> {
    const key = normal(word);
    const secret = VAULT[key] ?? null;
    if (secret) {
        await loadEggs();
        if (!state.words.includes(key)) await commit({ ...state, words: [...state.words, key] });
    }
    return secret;
}

export const vaultSize = Object.keys(VAULT).length;
