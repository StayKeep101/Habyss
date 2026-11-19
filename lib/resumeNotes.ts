import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Where to pick up: one line left on a task or habit when it is put down
 * unfinished, shown the next time it comes up. Switching away from something
 * half done leaves part of the mind on it; a "ready to resume" note takes most
 * of that away (Leroy & Glomb 2018). One note per item, replaced each time,
 * gone once the item is done.
 */
const KEY = 'habyss_resume_notes';
export interface ResumeNote { text: string; at: number }

let notes: Record<string, ResumeNote> = {};
let loaded = false;
const listeners = new Set<() => void>();
const changed = () => listeners.forEach(listener => listener());

export async function loadResumeNotes(): Promise<Record<string, ResumeNote>> {
    if (loaded) return notes;
    try {
        const raw = JSON.parse((await AsyncStorage.getItem(KEY)) ?? '{}');
        notes = raw && typeof raw === 'object' ? raw : {};
    } catch { notes = {}; }
    loaded = true;
    changed();
    return notes;
}

const save = () => AsyncStorage.setItem(KEY, JSON.stringify(notes)).catch(() => undefined);

/** Leaves (or, empty, removes) the note on an item. */
export async function setResumeNote(id: string, text: string): Promise<void> {
    await loadResumeNotes();
    const clean = text.trim().slice(0, 140);
    if (clean) notes = { ...notes, [id]: { text: clean, at: Date.now() } };
    else { const { [id]: _gone, ...rest } = notes; notes = rest; }
    changed();
    await save();
}

/** The item is done: its note has nothing left to say. */
export async function clearResumeNote(id: string): Promise<void> {
    await loadResumeNotes();
    if (!notes[id]) return;
    const { [id]: _gone, ...rest } = notes;
    notes = rest;
    changed();
    await save();
}

export const resumeNoteOf = (id: string | null | undefined): string | null => (id ? notes[id]?.text ?? null : null);
export const currentResumeNotes = (): Record<string, ResumeNote> => notes;
export function subscribeResumeNotes(listener: () => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}
