import type { ExpoSpeechRecognitionOptions, ExpoSpeechRecognitionResultEvent } from 'expo-speech-recognition';

/**
 * How Habyss listens, the same for every microphone (holding +, a text field's
 * mic, the brain dump).
 *
 * - Your phone's language and region (en-CA hears "Rogers" and "colour" the
 *   way you say them), not a fixed US English.
 * - Continuous: a pause to think does not end it. The caller stops it (you
 *   let go, tap again, or stay quiet for a moment).
 * - The words you are likely to say are handed to the recogniser as hints:
 *   your habits' and tasks' names, months, units, and Habyss's own
 *   words, so "Habyss" is not heard as "abyss" and "Learn AI Engineering" is
 *   not "learn a engineering".
 * - Apple's dictation tuning and its voice processing (cleaner in a noisy room).
 */
const VOCABULARY = [
    'Habyss', 'Echo', 'brain dump', 'focus', 'habit', 'task', 'deadline', 'urgent', 'not urgent',
    'every day', 'every morning', 'every night', 'weekdays', 'weekends', 'starting', 'until', 'by',
    'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December',
    'minutes', 'hours', 'pages', 'books', 'kilometres', 'km', 'miles', 'reps', 'sets', 'steps', 'glasses of water',
];

/** At most this many hints: Apple advises keeping the list short. */
const MAX_HINTS = 100;

export function deviceLanguage(): string {
    try {
        const tag = Intl.DateTimeFormat().resolvedOptions().locale;
        return /^[a-z]{2,3}(-[A-Z]{2})?$/.test(tag) ? tag : (tag.split(/[-_]/).slice(0, 2).join('-') || 'en-US');
    } catch {
        return 'en-US';
    }
}

/** The names you have given things, freshest first, then the fixed words. */
export function hintsFrom(names: string[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const word of [...names, ...VOCABULARY]) {
        const clean = word.trim();
        const key = clean.toLowerCase();
        if (!clean || clean.length > 60 || seen.has(key)) continue;
        seen.add(key);
        out.push(clean);
        if (out.length >= MAX_HINTS) break;
    }
    return out;
}

export async function speechOptions(input: { punctuation: boolean; levels?: boolean }): Promise<ExpoSpeechRecognitionOptions> {
    let names: string[] = [];
    try {
        const { getHabits } = require('./habitsSQLite') as typeof import('./habitsSQLite');
        const { getData } = require('./dataStore') as typeof import('./dataStore');
        const habits = await getHabits();
        names = [
            ...habits.map(habit => habit.name),
            ...getData().tasks.filter(task => task.status !== 'done').map(task => task.title),
        ];
    } catch { /* hints are a help, never required */ }
    return {
        lang: deviceLanguage(),
        interimResults: true,
        continuous: true,
        addsPunctuation: input.punctuation,
        contextualStrings: hintsFrom(names),
        iosTaskHint: 'dictation',
        iosVoiceProcessingEnabled: true,
        ...(input.levels ? { volumeChangeEventOptions: { enabled: true, intervalMillis: 80 } } : null),
    };
}

/**
 * Everything heard in one session. Phones send a segment at a time: its words
 * grow while you speak, then it is final and the next segment starts empty.
 * Finished segments are kept, so nothing said before a pause is lost.
 */
export class Transcript {
    private done = '';
    private current = '';
    reset(): void { this.done = ''; this.current = ''; }
    push(event: Pick<ExpoSpeechRecognitionResultEvent, 'results' | 'isFinal'>): string {
        const heard = (event.results[0]?.transcript ?? '').trim();
        if (event.isFinal) {
            // Some phones repeat the whole session in the final result: keep it once.
            this.done = heard.toLowerCase().startsWith(this.done.toLowerCase()) && this.done ? heard : [this.done, heard].filter(Boolean).join(' ');
            this.current = '';
        } else {
            this.current = heard;
        }
        return this.text;
    }
    get text(): string {
        if (!this.current) return this.done;
        if (this.done && this.current.toLowerCase().startsWith(this.done.toLowerCase())) return this.current;
        return [this.done, this.current].filter(Boolean).join(' ');
    }
}
