import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Your few words about the day, for your day card: what happened, how it went.
 * Asked for when your day drops: the first time you open the app after your
 * post time (a pop-up on Home, components/Echo/DayNotePopup.tsx), and a
 * notification at that time; sent with the card (lib/dayCard.ts `note`), shown on the pack's last
 * card with what did not get done. Kept on this phone by day, a week back.
 */
const KEY = 'habyss_day_notes';
const ASKED = 'habyss_day_note_asked';
const KEEP_DAYS = 7;

let notes: Record<string, string> = {};
let asked: string | null = null;
let loaded = false;
const listeners = new Set<() => void>();
const publish = () => listeners.forEach(listener => listener());

export async function loadDayNotes(): Promise<void> {
    if (loaded) return;
    loaded = true;
    try {
        const [raw, seen] = await Promise.all([AsyncStorage.getItem(KEY), AsyncStorage.getItem(ASKED)]);
        if (raw) notes = JSON.parse(raw) as Record<string, string>;
        asked = seen;
        publish();
    } catch { /* none yet */ }
}

export const dayNote = (day: string): string => notes[day] ?? '';
/** Whether today's prompt was answered or put away ("Not today"). */
export const noteAsked = (day: string): boolean => asked === day || !!notes[day];

export function subscribeDayNotes(listener: () => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}

export async function setDayNote(day: string, text: string): Promise<void> {
    const words = text.trim().slice(0, 600);
    const next = { ...notes };
    if (words) next[day] = words; else delete next[day];
    // Only the last week is kept.
    const floor = new Date(`${day}T12:00:00`);
    floor.setDate(floor.getDate() - KEEP_DAYS);
    const oldest = floor.toISOString().slice(0, 10);
    for (const key of Object.keys(next)) if (key < oldest) delete next[key];
    notes = next;
    publish();
    await AsyncStorage.setItem(KEY, JSON.stringify(notes)).catch(() => undefined);
}

/** "Not today": the prompt goes away until tomorrow. */
export async function skipDayNote(day: string): Promise<void> {
    asked = day;
    publish();
    await AsyncStorage.setItem(ASKED, day).catch(() => undefined);
}

const NOTIFICATION_ID = 'habyss-day-note';
const TIME = 'habyss_day_note_time';

/** Your post time ("21:00"), kept here so Home can ask without the network; null with daily posts off. */
export async function dayNoteTime(): Promise<string | null> {
    try { return await AsyncStorage.getItem(TIME); } catch { return null; }
}

/** Whether to ask now: your day is up (past your post time) and today is not answered or put away. */
export function shouldAskDayNote(time: string | null, now: Date, day: string): boolean {
    if (!time) return false;
    const [hour, minute] = time.split(':').map(Number);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return false;
    return now.getHours() * 60 + now.getMinutes() >= hour * 60 + minute && !noteAsked(day);
}

/**
 * Every day at your sharing time ("21:00"), as your day drops: "Your day is
 * up. How did it go?", opening Home, where the card asks. Off with daily posts.
 */
export async function scheduleDayNotePrompt(time: string | null, enabled: boolean): Promise<void> {
    await (enabled && time ? AsyncStorage.setItem(TIME, time) : AsyncStorage.removeItem(TIME)).catch(() => undefined);
    try {
        const Notifications = require('expo-notifications') as typeof import('expo-notifications');
        await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_ID).catch(() => undefined);
        if (!enabled || !time) return;
        const [hour, minute] = time.split(':').map(Number);
        if (!Number.isFinite(hour) || !Number.isFinite(minute)) return;
        await Notifications.scheduleNotificationAsync({
            identifier: NOTIFICATION_ID,
            content: { title: 'Your day is up', body: 'How did it go? Add a few words to your card.', sound: 'default',
                data: { kind: 'day-note', url: '/(root)/(tabs)/home' } },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute },
        });
    } catch { /* no notifications on this build */ }
}
