import { NUMBER, toNumber } from './phrases';

/**
 * The settings a sentence can set beyond its date and time, read the way
 * people say them (the full list is in docs/parsing-vocabulary.md):
 *
 *   Link       "right after work", "just before my class", "after lunch",
 *              "as soon as I finish Gym", "before my 9am meeting"
 *   Reminder   "remind me 10 min before", "remind me at 8pm", "with a heads-up",
 *              "remind me to…", "no reminder"
 *   Tracking   "from Apple Health", "with my Watch", "on Strava", "on Libby",
 *              "at the gym", "auto-track it"
 *   Subtasks   "Groceries: milk, eggs, bread", "steps: draft, edit and send"
 *
 * Each returns the words to take out of the name, so "Gym right after work"
 * becomes a habit called Gym, linked to work. Read before the clock and the
 * lengths, so "remind me 10 min before" is never a 10-minute habit. Pure.
 */

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Words that can't be what something is linked to: times, dates, pronouns. */
const NOT_AN_ANCHOR = /^(?:\d|noon|midnight|midday|tonight|today|tomorrow|morning|afternoon|evening|night|bed|bedtime|sleep|sleeping|waking|i|it|that|this|then|them|you|due|the deadline|deadline|sunday|monday|tuesday|wednesday|thursday|friday|saturday|january|february|march|april|may|june|july|august|september|october|november|december|next|end|eod|eow|work\s+is\s+due)\b/i;
/** Where a linked name stops: the next setting in the sentence. */
const NAME_STOP = /\s+(?:at|on|every|each|daily|for|from|until|till|by|with|and then|then|remind|starting|weekly|weekdays?|weekends?)\b|[,.;!?(]|\s+\d/i;

const tidyAnchor = (raw: string) => {
    const cut = raw.search(NAME_STOP);
    const name = (cut >= 0 ? raw.slice(0, cut) : raw).replace(/^(?:my|the|each|every|a|an|our)\s+/i, '').trim();
    return name.split(/\s+/).slice(0, 4).join(' ');
};

export interface FoundAnchor { side: 'before' | 'after'; to: string; phrase: string }

/**
 * A link to something else in the day: right before or right after a habit,
 * a task, a class, a meal or an event. Needs a word that makes it a link
 * ("right", "just", "my", "the", "as soon as I finish"), or a name the app
 * knows (`known`: today's events, meals, habits and tasks), so "before 9 AM"
 * and "after Friday" are never read as one.
 */
export function findAnchor(text: string, known: string[] = []): FoundAnchor | null {
    const BEFORE = String.raw`before|ahead of|prior to|in front of`;
    const AFTER = String.raw`after|following|once\s+(?:i(?:'ve|\s+have)?\s+)?(?:finish(?:ed)?|done\s+with|get\s+out\s+of|get\s+back\s+from|leave)|as\s+soon\s+as\s+(?:i\s+)?(?:finish|get\s+out\s+of|get\s+back\s+from|leave|am\s+done\s+with)|when\s+i\s+(?:finish|get\s+out\s+of|get\s+back\s+from|leave|am\s+done\s+with)|post`;
    const side = (word: string): 'before' | 'after' => (new RegExp(`^(?:${BEFORE})$`, 'i').test(word.trim()) ? 'before' : 'after');
    const tries: RegExp[] = [
        // "right after work", "just before my class", "straight after Gym".
        new RegExp(String.raw`\b(?:right|just|straight|directly|immediately|first\s+thing)\s+(${BEFORE}|${AFTER})\s+([A-Za-z][^,.;!?]*)`, 'i'),
        // "as soon as I finish Gym", "once I'm done with work".
        new RegExp(String.raw`\b((?:once|as\s+soon\s+as|when)\s+(?:i(?:'m|\s+am|'ve|\s+have)?\s+)?(?:finish(?:ed)?|done\s+with|get\s+out\s+of|get\s+back\s+from|leave|am\s+done\s+with))\s+([A-Za-z][^,.;!?]*)`, 'i'),
        // "after my class", "before the meeting", "after each meal".
        new RegExp(String.raw`\b(${BEFORE}|${AFTER})\s+((?:my|the|each|every|our)\s+[A-Za-z][^,.;!?]*)`, 'i'),
    ];
    for (const pattern of tries) {
        const match = text.match(pattern);
        if (!match) continue;
        const to = tidyAnchor(match[2]);
        if (!to || NOT_AN_ANCHOR.test(to)) continue;
        const said = match[0].slice(0, match[0].length - match[2].length) + match[2].slice(0, match[2].indexOf(to) + to.length);
        const isAfter = /^(?:once|as soon as|when)/i.test(match[1]) || side(match[1]) === 'after';
        return { side: isAfter ? 'after' : 'before', to: to.charAt(0).toUpperCase() + to.slice(1), phrase: said };
    }
    // "after lunch", "before Accounting": a name the day already has.
    for (const name of [...known].sort((a, b) => b.length - a.length)) {
        if (!name.trim()) continue;
        const match = text.match(new RegExp(String.raw`\b(${BEFORE}|after|following)\s+(?:my\s+|the\s+)?(${escape(name.trim())})\b`, 'i'));
        if (match) return { side: side(match[1]), to: name.trim(), phrase: match[0] };
    }
    return null;
}

export interface FoundReminder {
    /** Minutes before it starts. */
    alerts?: number[];
    /** "HH:MM", a clock time. */
    at?: string;
    /** "no reminder", "don't remind me". */
    none?: boolean;
    phrase: string;
}

/** "8", "8am", "8:30 pm", "20:00", "noon": a clock time, or null. */
export function clockTime(raw: string): string | null {
    const text = raw.trim().toLowerCase();
    if (/^(?:noon|midday)$/.test(text)) return '12:00';
    if (text === 'midnight') return '00:00';
    const match = text.match(/^(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?$/);
    if (!match) return null;
    let hour = Number(match[1]);
    const minute = Number(match[2] ?? 0);
    const meridiem = match[3]?.replace(/\./g, '');
    if (minute > 59 || hour > 23) return null;
    if (meridiem === 'pm' && hour < 12) hour += 12;
    if (meridiem === 'am' && hour === 12) hour = 0;
    if (!meridiem && hour >= 1 && hour <= 6) hour += 12;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/**
 * A reminder, in any of the ways it is asked for: "remind me 10 min before",
 * "notify me an hour ahead", "remind me at 8pm", "with a 15 minute heads-up",
 * "reminder at 7", "remind me" on its own (10 minutes before), "Remind me to
 * …" at the start, or "no reminder".
 */
export function findReminder(text: string): FoundReminder | null {
    const none = text.match(/\b(?:no\s+(?:reminders?|notifications?|alerts?)|don'?t\s+(?:remind|notify|ping)\s+me|without\s+(?:a\s+)?reminder)\b/i);
    if (none) return { none: true, phrase: none[0] };
    const ASK = String.raw`(?:remind|notify|alert|ping|nudge|buzz|warn)\s+me`;
    const AMOUNT = String.raw`(${NUMBER}|an?|half\s+an?)`;
    const UNIT = String.raw`(minutes?|mins?|min|m|hours?|hrs?|hr|h)\b`;
    const minutesOf = (amount: string, unit: string) => {
        const n = /^half/i.test(amount) ? 0.5 : /^an?$/i.test(amount) ? 1 : toNumber(amount) ?? 0;
        return Math.round(/^h/i.test(unit) ? n * 60 : n);
    };
    const lead = text.match(new RegExp(String.raw`,?\s*(?:and\s+)?${ASK}\s+${AMOUNT}[\s-]*${UNIT}\s*(?:before(?:hand)?|ahead|early|earlier|in\s+advance|prior)?`, 'i'))
        ?? text.match(new RegExp(String.raw`,?\s*with\s+an?\s+${AMOUNT}[\s-]*${UNIT}\s+(?:reminder|heads[\s-]?up|warning|notice|alert)`, 'i'));
    if (lead) {
        const minutes = minutesOf(lead[1], lead[2]);
        if (minutes > 0 && minutes <= 24 * 60) return { alerts: [minutes], phrase: lead[0] };
    }
    const at = text.match(new RegExp(String.raw`,?\s*(?:(?:and\s+)?${ASK}|(?:with\s+a\s+|set\s+a\s+)?reminder)\s+at\s+(noon|midnight|midday|\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.)?)`, 'i'));
    if (at) {
        const time = clockTime(at[1]);
        if (time) return { at: time, phrase: at[0] };
    }
    // "Remind me to drink water…": the ask is a reminder, the rest is the name.
    const lead_in = text.match(new RegExp(String.raw`^\s*(?:please\s+)?${ASK}\s+to\s+`, 'i'));
    if (lead_in) return { alerts: [10], phrase: lead_in[0] };
    const bare = text.match(new RegExp(String.raw`,?\s*(?:and\s+)?(?:${ASK}|with\s+a\s+(?:reminder|heads[\s-]?up)|set\s+a\s+reminder)\b`, 'i'));
    if (bare) return { alerts: [10], phrase: bare[0] };
    return null;
}

export type FoundTracking =
    | { kind: 'health'; phrase: string }
    | { kind: 'app'; app: string; phrase: string }
    | { kind: 'place'; place: string; phrase: string }
    | { kind: 'auto'; phrase: string };

const HEALTH_APPS = 'apple\\s+health|health\\s+app|apple\\s+watch|my\\s+watch|the\\s+watch|strava|bevel|oura|whoop|garmin|fitbit|nike\\s+run\\s+club|runna|hevy|strong|fitbod|peloton|zwift|fitness\\+|apple\\s+fitness';
const TIME_APPS = 'libby|kindle|audible|apple\\s+books|books\\s+app|goodreads|duolingo|babbel|busuu|memrise|headspace|calm|insight\\s+timer|coursera|brilliant|khan\\s+academy|simply\\s+piano|yousician|chess\\.com|chess|instagram|tiktok|youtube|x|twitter|reddit|facebook|snapchat|netflix';
const PLACES = 'gym|pool|library|park|office|church|mosque|temple|synagogue|studio|dojo|track|court|field|school|campus|class';

/**
 * How it should count itself, when the sentence says: from Apple Health (or an
 * app that saves to it: Strava, Bevel, Oura, the Watch…), from time in an app
 * (Libby, Kindle, Duolingo…), from time at a place (the gym, the library…), or
 * just "auto-track it".
 */
export function findTracking(text: string): FoundTracking | null {
    const health = text.match(new RegExp(String.raw`,?\s*(?:(?:tracked?|counted|logged|synced|measured)\s+)?(?:from|with|using|via|through|on|in|by)\s+(?:my\s+)?(${HEALTH_APPS})\b`, 'i'));
    if (health) return { kind: 'health', phrase: health[0] };
    const app = text.match(new RegExp(String.raw`,?\s*(?:(?:tracked?|counted|timed)\s+)?(?:on|in|using|with|via|through)\s+(?:the\s+)?(${TIME_APPS})(?:\s+app)?\b`, 'i'))
        ?? text.match(/,?\s*(?:track(?:ed)?\s+(?:my\s+)?(?:screen\s+)?time\s+(?:on|in)|on|in)\s+the\s+([A-Za-z][\w.]*)\s+app\b/i);
    if (app) {
        const name = app[1].replace(/\s+/g, ' ');
        return { kind: 'app', app: name.charAt(0).toUpperCase() + name.slice(1), phrase: app[0] };
    }
    const place = text.match(new RegExp(String.raw`,?\s*(?:when\s+i(?:'m|\s+am)?\s+)?(?:at|in)\s+(?:the\s+|my\s+)?(${PLACES})\b`, 'i'));
    if (place) return { kind: 'place', place: `the ${place[1].toLowerCase()}`, phrase: place[0] };
    const auto = text.match(/,?\s*(?:auto[\s-]?track(?:ed|ing)?(?:\s+it)?|track\s+it\s+(?:automatically|for\s+me|by\s+itself)|tracks?\s+itself)\b/i);
    if (auto) return { kind: 'auto', phrase: auto[0] };
    return null;
}

/**
 * Steps inside a task: "Groceries: milk, eggs and bread", "Trip — book flights,
 * pack, get cash", "with steps: draft, edit, send", "checklist: a; b; c".
 * Two steps or more, each a few words; a time ("at 5:30") is never a list.
 */
export function findSubtasks(text: string): { subtasks: string[]; phrase: string } | null {
    const split = (list: string) => list.split(/\s*(?:,|;|\band\b|&|\+|\bthen\b)\s*/i).map(item => item.trim().replace(/[.!]+$/, '')).filter(Boolean);
    const fits = (items: string[]) => items.length >= 2 && items.every(item => item.split(/\s+/).length <= 6);
    const labelled = text.match(/\s*,?\s*(?:with\s+)?(?:sub-?tasks?|steps?|checklist|to-?dos?|items?)\s*:\s*(.+)$/i);
    if (labelled) {
        const items = split(labelled[1]);
        if (fits(items)) return { subtasks: items, phrase: labelled[0] };
    }
    const colon = text.match(/^([^:\d]*[A-Za-z][^:]*?)\s*(?::|\s[—–-]\s)\s*(.+)$/);
    if (colon && !/\d$/.test(colon[1])) {
        const items = split(colon[2]);
        if (fits(items)) return { subtasks: items, phrase: text.slice(colon[1].length) };
    }
    return null;
}
