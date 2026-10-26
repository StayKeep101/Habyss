import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Echo's quick questions — how's your mood, your energy — asked now and then
 * when you pull down on Home, answered with one tap in a small pop-up.
 *
 * When to ask is learned, not fixed: every question remembers how often it
 * was answered rather than waved away, and at what hour answers come. The
 * chance of asking rises with both, falls when it is dismissed, and it is
 * never asked twice within a few hours or again once answered today. All on
 * this phone.
 */

export type CheckInKind = 'mood' | 'energy';
export interface CheckIn { at: string; kind: CheckInKind; value: 1 | 2 | 3 | 4 | 5 }
export interface AskStats { asked: number; answered: number; lastAsked?: string; hours: number[] }
export interface CheckInState { entries: CheckIn[]; stats: Record<CheckInKind, AskStats> }

export const QUESTIONS: Record<CheckInKind, { title: string; options: string[]; icon: string }> = {
    mood: { title: 'How’s your mood?', options: ['Awful', 'Low', 'Okay', 'Good', 'Great'], icon: 'happy-outline' },
    energy: { title: 'How’s your energy?', options: ['Drained', 'Low', 'Okay', 'Good', 'High'], icon: 'flash-outline' },
};

/**
 * What Echo says on its line just before asking, typed out first, then the
 * pop-up. Plain in the Normal voice; with a joke in the others.
 */
const LEAD_INS: Record<CheckInKind, { plain: string[]; funny: string[] }> = {
    mood: {
        plain: ['Quick one: how are you feeling?', 'Before you go on: how’s your mood?'],
        funny: ['Mood check. No wrong answers. Except lying.', 'Scientists say I should ask how you feel. I am the scientists.', 'Rate your vibe. I won’t tell anyone. Probably.'],
    },
    energy: {
        plain: ['Quick one: how’s your energy?', 'How much fuel is in the tank today?'],
        funny: ['Battery check. Are we at 100% or one bar and dimming?', 'Energy report, please. Coffee counts as a personality.', 'How charged are you? Be honest, I can see the yawn.'],
    },
};

/** Echo's lead-in for a question, in its voice (Normal is plain). */
export function leadInFor(kind: CheckInKind, voice: string, random: () => number = Math.random): string {
    const lines = voice === 'normal' ? LEAD_INS[kind].plain : LEAD_INS[kind].funny;
    return lines[Math.floor(random() * lines.length) % lines.length];
}

const KEY = 'habyss_check_ins';
const KEEP_DAYS = 120;
/** Never the same question twice within this long. */
const GAP_HOURS = 4;
const emptyStats = (): AskStats => ({ asked: 0, answered: 0, hours: Array(24).fill(0) });
const EMPTY: CheckInState = { entries: [], stats: { mood: emptyStats(), energy: emptyStats() } };

let state: CheckInState = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();
export const currentCheckIns = (): CheckInState => state;
export function subscribeCheckIns(listener: () => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}
async function commit(next: CheckInState) {
    state = next;
    listeners.forEach(listener => listener());
    await AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => undefined);
}
export async function loadCheckIns(): Promise<CheckInState> {
    if (loaded) return state;
    loaded = true;
    try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw) {
            const parsed = JSON.parse(raw) as Partial<CheckInState>;
            state = {
                entries: Array.isArray(parsed.entries) ? parsed.entries : [],
                stats: { mood: { ...emptyStats(), ...parsed.stats?.mood }, energy: { ...emptyStats(), ...parsed.stats?.energy } },
            };
            listeners.forEach(listener => listener());
        }
    } catch { /* starts empty */ }
    return state;
}

const dayOf = (iso: string) => {
    const date = new Date(iso);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

/** Morning (before noon), afternoon (before 6 PM), evening. */
const partOf = (hour: number) => (hour < 12 ? 0 : hour < 18 ? 1 : 2);

/**
 * Which question to ask now, if any. Pure: `random` is passed in, so the
 * learning can be tested. The chance is the answer rate (with a prior of one
 * answer in two) times how much answers cluster at this hour, kept between
 * 10% and 75% so it is never pushy and never silent for good.
 *
 * Mood is asked once a day. Energy changes through the day, so it can be
 * asked once in each part of it (morning, afternoon, evening), and more
 * readily in the part with the fewest answers: that is how the energy curve
 * (lib/energyCurve.ts) learns your whole day, not just the hour you usually
 * answer.
 */
export function pickQuestion(current: CheckInState, now: Date, random: () => number = Math.random): CheckInKind | null {
    const today = dayOf(now.toISOString());
    const hour = now.getHours();
    const kinds = (Object.keys(QUESTIONS) as CheckInKind[]).filter(kind => {
        const answeredToday = current.entries.filter(entry => entry.kind === kind && dayOf(entry.at) === today);
        if (kind === 'mood' ? answeredToday.length > 0 : answeredToday.some(entry => partOf(new Date(entry.at).getHours()) === partOf(hour))) return false;
        const last = current.stats[kind].lastAsked;
        return !last || now.getTime() - new Date(last).getTime() >= GAP_HOURS * 3600000;
    });
    if (!kinds.length) return null;
    const chance = (kind: CheckInKind) => {
        const s = current.stats[kind];
        const rate = (s.answered + 1) / (s.asked + 2);
        const total = s.hours.reduce((sum, n) => sum + n, 0);
        const affinity = total >= 3 ? (s.hours[hour] + s.hours[(hour + 23) % 24] + s.hours[(hour + 1) % 24] + 1) / (total / 8 + 1) : 1;
        // Energy: a part of the day with few answers is worth asking about.
        let explore = 1;
        if (kind === 'energy' && total >= 3) {
            const inPart = s.hours.reduce((sum, n, h) => sum + (partOf(h) === partOf(hour) ? n : 0), 0);
            explore = 1 + 0.6 * Math.max(0, 1 / 3 - inPart / total) * 3;
        }
        return Math.max(0.1, Math.min(0.75, 0.4 * rate * 2 * Math.min(1.8, affinity * explore)));
    };
    // The least recently asked goes first, so both get their turn.
    const ordered = kinds.sort((a, b) => (current.stats[a].lastAsked ?? '').localeCompare(current.stats[b].lastAsked ?? ''));
    const kind = ordered[0];
    return random() < chance(kind) ? kind : null;
}

export async function markAsked(kind: CheckInKind, now = new Date()): Promise<void> {
    await loadCheckIns();
    const s = state.stats[kind];
    await commit({ ...state, stats: { ...state.stats, [kind]: { ...s, asked: s.asked + 1, lastAsked: now.toISOString() } } });
}

export async function answer(kind: CheckInKind, value: CheckIn['value'], now = new Date()): Promise<void> {
    await loadCheckIns();
    const s = state.stats[kind];
    const hours = [...s.hours];
    hours[now.getHours()] += 1;
    const floor = new Date(now);
    floor.setDate(floor.getDate() - KEEP_DAYS);
    const entries = [...state.entries.filter(entry => new Date(entry.at) >= floor), { at: now.toISOString(), kind, value }];
    await commit({ entries, stats: { ...state.stats, [kind]: { ...s, answered: s.answered + 1, hours } } });
}

/** Today's latest answer to one question, if there is one. */
export function todays(current: CheckInState, kind: CheckInKind, now = new Date()): CheckIn['value'] | null {
    const today = dayOf(now.toISOString());
    const found = [...current.entries].reverse().find(entry => entry.kind === kind && dayOf(entry.at) === today);
    return found ? found.value : null;
}

export { dayOf as checkInDay };
