import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * What Echo said lately, shared by everything that speaks on Home (the
 * pressure lines, the brief, patterns, the written bank).
 *
 * Two rules, so Echo talks like a person and not a loop:
 * - a line said in the last LIMIT lines is not said again;
 * - a topic ("Study is on", "you are behind") waits until TOPIC_REST other
 *   things were said, so a refresh always moves the conversation on.
 * Kept on the phone, so reopening the app does not reset it.
 */
export interface Said { line: string; topic: string; at: number }
export interface Option { topic: string; line: string }

const KEY = 'habyss_echo_said';
const LIMIT = 30;
export const TOPIC_REST = 2;

let cache: Said[] | null = null;

export async function loadSaid(): Promise<Said[]> {
    if (cache) return cache;
    try {
        const parsed = JSON.parse((await AsyncStorage.getItem(KEY)) ?? '[]');
        cache = Array.isArray(parsed) ? parsed.filter(item => item && typeof item.line === 'string') : [];
    } catch {
        cache = [];
    }
    return cache!;
}

export async function noteSaid(line: string, topic: string, at = Date.now()): Promise<void> {
    const said = await loadSaid();
    cache = [{ line, topic, at }, ...said.filter(item => item.line !== line)].slice(0, LIMIT);
    await AsyncStorage.setItem(KEY, JSON.stringify(cache)).catch(() => undefined);
}

/** The lines said lately, newest first. */
export const saidLines = (said: Said[]): string[] => said.map(item => item.line);

/**
 * The first option, in the order given (most important first), that is
 * neither a line said lately nor a topic that just had its turn. Null when
 * everything has been said: the caller moves on to something else.
 */
export function pickFresh(options: Option[], said: Said[], rest = TOPIC_REST): Option | null {
    const lines = new Set(said.map(item => item.line));
    const resting = new Set(said.slice(0, rest).map(item => item.topic));
    return options.find(option => !lines.has(option.line) && !resting.has(option.topic)) ?? null;
}

/** The same list in a random order, so the variants of a topic take turns. */
export function shuffled<T>(items: T[], random: () => number = Math.random): T[] {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

export function resetSaidForTests() { cache = null; }
