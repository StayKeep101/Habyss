import AsyncStorage from '@react-native-async-storage/async-storage';
import { PERSONALITY_MODES, type PersonalityModeId } from '@/constants/AIPersonalities';

/**
 * Echo writing its own reminders, on the phone.
 *
 * Reminders are scheduled up to 64 at a time, so nothing may be generated
 * while they are being written: a 1B model answering sixty times would take
 * minutes. Instead the model fills a small pool of lines per habit in the
 * background, and scheduling only reads from that pool. Until the pool has
 * anything in it — no model on this phone, a fresh install, a voice just
 * changed — the written line bank answers, so a reminder is never missing and
 * never late.
 *
 * A generated line is only kept if it passes `acceptLine`. The model is not
 * given any history, so anything numeric in its answer would be invented; the
 * check throws those away rather than telling someone they are on a streak
 * they never had.
 */

const KEY = 'habyss_echo_written_lines';
/** Kept per habit, so the same reminder does not read the same all week. */
const PER_SUBJECT = 4;
/** Generated per refresh, so filling the pool is never felt. */
const MAX_PER_REFRESH = 3;

export interface SubjectLines {
    voice: PersonalityModeId;
    lines: string[];
}

export type LineStore = Record<string, SubjectLines>;

export interface Subject {
    /** Stable per thing being reminded about, e.g. `habit:abc`. */
    key: string;
    kind: 'habit' | 'task';
    name: string;
    /** The user's name, when they asked to be called by it. */
    person?: string;
}

/**
 * Whether a line the model wrote is fit to send.
 *
 * Anything with a number in it is refused: Echo is given no history here, so
 * a number can only be something it made up.
 */
/**
 * Whether a line talks *as* the person rather than *to* them.
 *
 * Told "their name is Sam", a small model will happily write "I'm Sam and I've
 * got this", which read on Sam's lock screen sounds like Sam's own voice. Echo
 * speaks to you; anything introducing itself as you, or written in your first
 * person about your habits, is dropped.
 */
export function speaksAsUser(line: string, name?: string): boolean {
    if (name) {
        const who = name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (who && new RegExp(`\\b(i am|i'm|im|this is|it's|its|me,?)\\s+${who}\\b|\\b${who}\\s+here\\b|^${who}\\s*:`, 'i').test(line)) return true;
    }
    // "I will finish my workout" is the user talking, not Echo.
    return /\b(i|i'll|i will|i'm going to|let me)\b[^.?!]*\bmy (habit|habits|workout|goal|goals|task|tasks|streak)\b/i.test(line);
}

export function acceptLine(raw: string | null | undefined, name?: string): string | null {
    if (!raw) return null;
    const line = raw.replace(/\s+/g, ' ').replace(/^["'“”\s]+|["'“”\s]+$/g, '').trim();
    if (line.length < 8 || line.length > 120) return null;
    if (/\d/.test(line)) return null;
    // Models like to narrate the task they were given.
    if (/^(sure|okay|ok|here|as an|i am an)\b/i.test(line) || /^reminder:/i.test(line)) return null;
    if (line.includes('{') || line.includes('}')) return null;
    if (speaksAsUser(line, name)) return null;
    return line;
}

/**
 * One of the lines written for this subject, or null to fall back.
 *
 * `rotation` moves through the pool so consecutive days differ, and lines
 * written in a voice the user has since changed are ignored.
 */
export function pickLine(store: LineStore, key: string, voice: PersonalityModeId, rotation: number): string | null {
    const entry = store[key];
    if (!entry || entry.voice !== voice || entry.lines.length === 0) return null;
    return entry.lines[Math.abs(rotation) % entry.lines.length];
}

export async function loadWrittenLines(): Promise<LineStore> {
    try {
        const raw = await AsyncStorage.getItem(KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        return parsed && typeof parsed === 'object' ? parsed as LineStore : {};
    } catch {
        return {};
    }
}

async function saveWrittenLines(store: LineStore): Promise<void> {
    try {
        await AsyncStorage.setItem(KEY, JSON.stringify(store));
    } catch {
        // A pool that could not be saved just gets written again later.
    }
}

/** Which subjects still need lines in the voice the user is using now. */
export function needsWriting(store: LineStore, subjects: Subject[], voice: PersonalityModeId): Subject[] {
    return subjects.filter(subject => {
        const entry = store[subject.key];
        return !entry || entry.voice !== voice || entry.lines.length < PER_SUBJECT;
    });
}

const promptFor = (subject: Subject, voice: PersonalityModeId): { system: string; prompt: string } => {
    const mode = PERSONALITY_MODES.find(item => item.id === voice) ?? PERSONALITY_MODES[1];
    return {
        system: `${mode.systemPrompt}

You are writing the text of a phone notification.

Rules:
- One sentence, at most twelve words.
- You are Echo, talking TO the user. Address them as "you". Never write as them, never introduce yourself by their name, never use "I" or "my" as if you were them.
- No numbers, no streaks, no claims about what they have or have not done.
- No quotation marks, no preamble, no explanation. Just the sentence.`,
        prompt: subject.kind === 'task'
            ? `It is time for this task: "${subject.name}".${subject.person ? ` The user you are writing to is called ${subject.person}; you may address them by that name once.` : ''} Write the notification.`
            : `It is time for their habit: "${subject.name}".${subject.person ? ` The user you are writing to is called ${subject.person}; you may address them by that name once.` : ''} Write the notification.`,
    };
};

/**
 * Tops the pool up in the background. Safe to call and forget: it writes at
 * most a few lines, never throws, and does nothing without a model.
 */
export async function topUpWrittenLines(subjects: Subject[], voice: PersonalityModeId): Promise<number> {
    try {
        const { askForLine, canWriteLines } = require('./onDeviceAI') as typeof import('./onDeviceAI');
        if (!canWriteLines()) return 0;

        const store = await loadWrittenLines();
        const pending = needsWriting(store, subjects, voice).slice(0, MAX_PER_REFRESH);
        if (pending.length === 0) return 0;

        let written = 0;
        for (const subject of pending) {
            const { system, prompt } = promptFor(subject, voice);
            const line = acceptLine(await askForLine(system, prompt), subject.person);
            if (!line) continue;

            const entry = store[subject.key];
            const lines = entry && entry.voice === voice ? entry.lines : [];
            if (lines.includes(line)) continue;
            store[subject.key] = { voice, lines: [...lines, line].slice(-PER_SUBJECT) };
            written++;
        }

        if (written > 0) await saveWrittenLines(store);
        return written;
    } catch {
        return 0;
    }
}

/** Forgets every written line, for when the user turns the on-device model off. */
export async function clearWrittenLines(): Promise<void> {
    try {
        await AsyncStorage.removeItem(KEY);
    } catch {
        // Nothing to do; they are only a cache.
    }
}
