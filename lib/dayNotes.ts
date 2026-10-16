import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * A word about someone's day.
 *
 * Reactions say "I saw this". A note is for the other half of it — "how was the
 * long run", "same time tomorrow?" — which five emoji cannot carry.
 *
 * Kept on the device, like reactions, and for the same reason: `feed_comments`
 * is written in `supabase/migrations/20260927000100_feed_reactions_and_proof.sql` and
 * has not been applied, so there is nowhere on the server to put one yet. The
 * shape here is the shape of that table, so when it runs this becomes the
 * local half of a sync rather than something to throw away.
 */

export interface DayNote {
    id: string;
    /** The feed card it belongs to: a friend's id, or your own. */
    cardId: string;
    /** The day it is about, not the day it was written — they are the same today. */
    date: string;
    text: string;
    at: number;
    /** Written by you: only your own can be taken back. */
    mine: boolean;
    /** Not on the server yet. Sent on the next visit, then dropped from here. */
    pending?: boolean;
    /** Whose name to put on it, when it is not yours. */
    authorName?: string;
}

export const NOTE_LIMIT = 240;
/** Enough to hold a conversation, few enough that a card stays a card. */
export const NOTES_PER_CARD = 20;

const key = (date: string) => `feed_notes_${date}`;

/**
 * What is worth saving out of what was typed.
 *
 * Trimmed, with runs of whitespace collapsed so a note pasted out of a message
 * does not arrive with the shape of another app, and capped. Null means there
 * was nothing there — which is what an empty send should do: nothing.
 */
export function cleanNote(raw: string): string | null {
    const text = raw.replace(/\s+/g, ' ').trim();
    if (!text) return null;
    return text.length > NOTE_LIMIT ? text.slice(0, NOTE_LIMIT).trimEnd() : text;
}

async function read(date: string): Promise<Record<string, DayNote[]>> {
    try {
        const raw = await AsyncStorage.getItem(key(date));
        const parsed = raw ? JSON.parse(raw) : null;
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
        const notes: Record<string, DayNote[]> = {};
        for (const [cardId, list] of Object.entries(parsed)) {
            if (!Array.isArray(list)) continue;
            // Rebuilt rather than trusted: a note is drawn on screen, and a
            // stored object is only ever as good as the version that wrote it.
            notes[cardId] = list
                .filter(note => note && typeof note.text === 'string' && typeof note.id === 'string')
                .map((note): DayNote => ({
                    id: note.id, cardId, date,
                    text: String(note.text).slice(0, NOTE_LIMIT),
                    at: Number.isFinite(note.at) ? note.at : 0,
                    mine: note.mine !== false,
                    // Anything still on the device has not reached the server;
                    // once it has, it is deleted from here rather than marked.
                    pending: true,
                }))
                .slice(-NOTES_PER_CARD);
        }
        return notes;
    } catch {
        return {};
    }
}

export const getNotes = read;

/** In the order they were written, which is the order a conversation reads in. */
export async function addNote(date: string, cardId: string, raw: string): Promise<DayNote | null> {
    const text = cleanNote(raw);
    if (!text) return null;
    const note: DayNote = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, cardId, date, text, at: Date.now(), mine: true, pending: true };
    const all = await read(date);
    all[cardId] = [...(all[cardId] ?? []), note].slice(-NOTES_PER_CARD);
    try { await AsyncStorage.setItem(key(date), JSON.stringify(all)); } catch { return note; }
    return note;
}

export async function removeNote(date: string, cardId: string, id: string): Promise<void> {
    const all = await read(date);
    if (!all[cardId]) return;
    all[cardId] = all[cardId].filter(note => note.id !== id);
    if (!all[cardId].length) delete all[cardId];
    try { await AsyncStorage.setItem(key(date), JSON.stringify(all)); } catch { /* nothing to do */ }
}

/** "3 notes" for the bubble, or nothing when there are none. */
export const noteCount = (notes?: DayNote[]): number => notes?.length ?? 0;

/**
 * What a card shows: what the server has, then what has not reached it.
 *
 * In that order because the server's rows are older by definition — anything
 * still pending was written after the last successful send — and because a
 * conversation reads forwards.
 */
export function mergeNotes(fromServer: DayNote[] = [], pending: DayNote[] = []): DayNote[] {
    const seen = new Set(fromServer.map(note => note.id));
    return [...fromServer, ...pending.filter(note => !seen.has(note.id))].slice(-NOTES_PER_CARD);
}

/** Everything waiting to be sent, flattened, oldest first. */
export async function pendingNotes(date: string): Promise<DayNote[]> {
    const all = await read(date);
    return Object.values(all).flat().filter(note => note.pending).sort((a, b) => a.at - b.at);
}
