import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * One real question a day, and the answer remembered.
 *
 * Echo asks something only you can answer — in the morning, what would make
 * today a win; in the evening, what got in the way or what went well — and
 * brings the answer back the next day (lib/echoHuman.ts callbackLine). Being
 * heard, and then remembered, is what makes it feel like someone rather than
 * something. What got in the way is also kept as a note in "What Echo
 * remembers", where it can be read and deleted.
 *
 * Asked at most once a day, never again that day once answered or waved away.
 * On this phone only.
 */

export interface TalkQuestion { id: 'win' | 'blocker' | 'wentWell'; text: string; placeholder: string }
export interface TalkEntry { day: string; question: string; questionId: TalkQuestion['id']; answer: string }
interface TalkState { askedDay?: string; entries: TalkEntry[] }

const KEY = 'habyss_echo_talk';
const KEEP = 30;

export const TALK_QUESTIONS: Record<TalkQuestion['id'], TalkQuestion> = {
    win: { id: 'win', text: 'What’s the one thing that would make today a win?', placeholder: 'Finish the essay draft' },
    blocker: { id: 'blocker', text: 'What got in the way today?', placeholder: 'Too tired after work' },
    wentWell: { id: 'wentWell', text: 'What went well today?', placeholder: 'Got the run in early' },
};

let state: TalkState = { entries: [] };
let loaded = false;

async function load(): Promise<TalkState> {
    if (loaded) return state;
    loaded = true;
    try {
        const parsed = JSON.parse((await AsyncStorage.getItem(KEY)) ?? 'null') as TalkState | null;
        if (parsed && Array.isArray(parsed.entries)) state = parsed;
    } catch { /* nothing yet */ }
    return state;
}

async function save(next: TalkState): Promise<void> {
    state = next;
    await AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => undefined);
}

/**
 * The question for now, or null: mornings (before noon) ask for the day's win;
 * evenings (from 6 pm) ask what got in the way, or on alternate days what went
 * well. Never twice in a day. Pure.
 */
export function questionFor(hour: number, day: string, askedDay?: string): TalkQuestion | null {
    if (askedDay === day) return null;
    if (hour >= 6 && hour < 12) return TALK_QUESTIONS.win;
    if (hour >= 18 && hour < 23) {
        const date = Number(day.slice(-2));
        return date % 2 ? TALK_QUESTIONS.blocker : TALK_QUESTIONS.wentWell;
    }
    return null;
}

export async function dueQuestion(now: Date, day: string): Promise<TalkQuestion | null> {
    const current = await load();
    return questionFor(now.getHours(), day, current.askedDay);
}

/** Asked today: it will not be asked again until tomorrow, answered or not. */
export async function markAsked(day: string): Promise<void> {
    const current = await load();
    await save({ ...current, askedDay: day });
}

export async function saveAnswer(day: string, question: TalkQuestion, answer: string): Promise<void> {
    const text = answer.trim().slice(0, 200);
    if (!text) return;
    const current = await load();
    const entries = [{ day, question: question.text, questionId: question.id, answer: text }, ...current.entries.filter(entry => entry.day !== day || entry.questionId !== question.id)].slice(0, KEEP);
    await save({ askedDay: day, entries });
    // What got in the way is worth remembering beyond tomorrow: it is the person's own obstacle.
    if (question.id === 'blocker') {
        const { addNote } = require('./echoMemory') as typeof import('./echoMemory');
        await addNote('obstacle', text).catch(() => null);
    }
}

/** What they answered yesterday, for Echo to bring back today. Pure. */
export function answerFrom(entries: TalkEntry[], yesterday: string): { question: string; answer: string } | undefined {
    const entry = entries.find(item => item.day === yesterday);
    return entry ? { question: entry.question, answer: entry.answer } : undefined;
}

export async function yesterdayAnswer(yesterday: string): Promise<{ question: string; answer: string } | undefined> {
    return answerFrom((await load()).entries, yesterday);
}

export function resetTalkForTests() { state = { entries: [] }; loaded = false; }

const SEEN_KEY = 'habyss_echo_last_seen';
let seenToday: { day: string; away: number } | null = null;

/**
 * Whole days since Habyss was last opened before today (0 when it was opened
 * yesterday or earlier today). Read once per day: the first open of the day
 * records it, so Echo can say "haven't seen you since Tuesday" just the once.
 */
export async function daysAwayBefore(today: string): Promise<number> {
    if (seenToday?.day === today) return seenToday.away;
    let last: string | null = null;
    try { last = await AsyncStorage.getItem(SEEN_KEY); } catch { last = null; }
    const { daysBetween } = require('./echoHuman') as typeof import('./echoHuman');
    const away = last && last < today ? Math.max(0, daysBetween(last, today) - 1) : 0;
    seenToday = { day: today, away };
    await AsyncStorage.setItem(SEEN_KEY, today).catch(() => undefined);
    return away;
}
