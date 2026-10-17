import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * What Echo remembers, on this phone only, and always in the person's hands.
 *
 * - Notes: things the person told Echo (`source: 'you'`) and patterns Echo
 *   noticed in their data (`source: 'echo'`, with the evidence). Every note can
 *   be read, changed and deleted in "What Echo remembers".
 * - Help tried: each time Echo helped someone start (a two-minute start, a
 *   five-minute session, a plan), and whether the thing got done after. That
 *   is how Echo learns which help works for this person: by counting, not by
 *   guessing.
 * - Dismissed: insights the person waved away, so they do not come straight back.
 * - Energy: how the person said they feel today, which only shapes today.
 *
 * Nothing here is uploaded. One copy in memory for every screen.
 */

export type NoteKind = 'preference' | 'obstacle' | 'strategy' | 'ambition' | 'pattern';
export type HelpType = 'two_minute' | 'five_minute' | 'plan';
export type Energy = 'low' | 'ok' | 'high';

export interface MemoryNote {
    id: string;
    kind: NoteKind;
    text: string;
    /** 'you': said by the person. 'echo': inferred from their data. */
    source: 'you' | 'echo';
    /** For inferred notes: the numbers behind it, in words. */
    evidence?: string;
    /** For inferred notes: a stable key, so the same pattern is not noted twice. */
    key?: string;
    createdAt: string;
}

export interface HelpTried {
    id: string;
    type: HelpType;
    /** "task:<id>" or "habit:<id>". */
    item: string;
    /** Local day it was tried. */
    day: string;
    /** Set once known: did the thing get done that day or the next? */
    outcome?: 'done' | 'not';
}

export interface EchoMemoryState {
    notes: MemoryNote[];
    helps: HelpTried[];
    dismissed: Record<string, string>;
    energy: { day: string; level: Energy } | null;
}

const KEY = 'habyss_echo_memory';
const MAX_NOTES = 60;
const MAX_HELPS = 200;
export const EMPTY_MEMORY: EchoMemoryState = { notes: [], helps: [], dismissed: {}, energy: null };

let state: EchoMemoryState = EMPTY_MEMORY;
let loaded = false;
const listeners = new Set<() => void>();
const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export const currentMemory = (): EchoMemoryState => state;
export function subscribeMemory(listener: () => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}

async function commit(next: EchoMemoryState): Promise<void> {
    state = next;
    listeners.forEach(listener => listener());
    await AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => undefined);
}

export async function loadMemory(): Promise<EchoMemoryState> {
    if (loaded) return state;
    loaded = true;
    try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw) {
            const parsed = JSON.parse(raw) as Partial<EchoMemoryState>;
            state = {
                notes: Array.isArray(parsed.notes) ? parsed.notes : [],
                helps: Array.isArray(parsed.helps) ? parsed.helps : [],
                dismissed: parsed.dismissed && typeof parsed.dismissed === 'object' ? parsed.dismissed : {},
                energy: parsed.energy ?? null,
            };
            listeners.forEach(listener => listener());
        }
    } catch { /* starts empty */ }
    return state;
}

// ------------------------------------------------------------------- notes

const clean = (text: string) => text.replace(/\s+/g, ' ').trim().slice(0, 200);

export async function addNote(kind: NoteKind, text: string, source: 'you' | 'echo' = 'you', extra: { evidence?: string; key?: string } = {}): Promise<MemoryNote | null> {
    await loadMemory();
    const body = clean(text);
    if (!body) return null;
    if (extra.key && state.notes.some(note => note.key === extra.key)) return null;
    const note: MemoryNote = { id: newId(), kind, text: body, source, createdAt: new Date().toISOString(), ...extra };
    await commit({ ...state, notes: [note, ...state.notes].slice(0, MAX_NOTES) });
    return note;
}

/** Changing a note makes it the person's own: they have now said it. */
export async function updateNote(id: string, text: string): Promise<void> {
    await loadMemory();
    const body = clean(text);
    if (!body) return removeNote(id);
    await commit({ ...state, notes: state.notes.map(note => note.id === id ? { ...note, text: body, source: 'you', evidence: undefined } : note) });
}

export async function removeNote(id: string): Promise<void> {
    await loadMemory();
    await commit({ ...state, notes: state.notes.filter(note => note.id !== id) });
}

/** Forget everything Echo remembers. */
export async function forgetAll(): Promise<void> {
    await commit(EMPTY_MEMORY);
}

// ------------------------------------------------------------- help tried

export async function recordHelp(type: HelpType, item: string, day: string): Promise<HelpTried> {
    await loadMemory();
    const help: HelpTried = { id: newId(), type, item, day };
    await commit({ ...state, helps: [...state.helps, help].slice(-MAX_HELPS) });
    return help;
}

/**
 * Fills in outcomes that are now known: done if the item was finished on the
 * day it was tried or the next. Pure, so it is easy to trust.
 */
export function resolveHelps(helps: HelpTried[], doneOn: (item: string, day: string) => boolean, today: string): HelpTried[] {
    return helps.map(help => {
        if (help.outcome) return help;
        const next = nextDay(help.day);
        if (doneOn(help.item, help.day) || doneOn(help.item, next)) return { ...help, outcome: 'done' };
        // Only call it "not" once the next day is over.
        return next < today ? { ...help, outcome: 'not' } : help;
    });
}

export async function settleHelps(doneOn: (item: string, day: string) => boolean, today: string): Promise<void> {
    await loadMemory();
    const next = resolveHelps(state.helps, doneOn, today);
    if (next.some((help, index) => help !== state.helps[index])) await commit({ ...state, helps: next });
}

/**
 * How often each kind of help was followed by the thing getting done, with a
 * gentle prior so one try does not decide anything. Highest first.
 */
export function helpRanking(helps: HelpTried[]): { type: HelpType; tries: number; done: number; score: number }[] {
    const types: HelpType[] = ['two_minute', 'five_minute', 'plan'];
    return types
        .map(type => {
            const known = helps.filter(help => help.type === type && help.outcome);
            const done = known.filter(help => help.outcome === 'done').length;
            return { type, tries: known.length, done, score: (done + 1) / (known.length + 2) };
        })
        .sort((a, b) => b.score - a.score || b.tries - a.tries);
}

// ------------------------------------------------------- dismissed, energy

export async function dismissInsight(id: string, until: string): Promise<void> {
    await loadMemory();
    await commit({ ...state, dismissed: { ...state.dismissed, [id]: until } });
}

export async function setEnergy(day: string, level: Energy): Promise<void> {
    await loadMemory();
    await commit({ ...state, energy: { day, level } });
}

export const energyToday = (memory: EchoMemoryState, today: string): Energy | null =>
    memory.energy?.day === today ? memory.energy.level : null;

function nextDay(day: string): string {
    const [y, m, d] = day.split('-').map(Number);
    const date = new Date(y, m - 1, d + 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
