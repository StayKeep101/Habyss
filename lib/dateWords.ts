import { localDateKey } from './habitSchedule';

/**
 * Dates as people type them, for every quick-add sentence (tasks, habits,
 * goals): "tomorrow", "Friday", "next Tuesday", "in 3 weeks", "in 2 months",
 * "Dec 5", "5th of December", "12/5", "2026-12-05", "end of the month",
 * "next week", "Christmas".
 *
 * And the deadline form: "due by Friday", "due Friday", "by Dec 5", "before
 * next week", "deadline Monday", "no later than the 20th". Deterministic and
 * local, so it reads the same way every time with no model.
 */

const WEEKDAYS: Record<string, number> = {
    sunday: 0, sun: 0, monday: 1, mon: 1, tuesday: 2, tue: 2, tues: 2,
    wednesday: 3, wed: 3, weds: 3, thursday: 4, thu: 4, thur: 4, thurs: 4,
    friday: 5, fri: 5, saturday: 6, sat: 6,
};
const MONTHS: Record<string, number> = {
    january: 0, jan: 0, february: 1, feb: 1, march: 2, mar: 2, april: 3, apr: 3,
    may: 4, june: 5, jun: 5, july: 6, jul: 6, august: 7, aug: 7,
    september: 8, sep: 8, sept: 8, october: 9, oct: 9, november: 10, nov: 10,
    december: 11, dec: 11,
};
const WEEKDAY = 'sunday|sun|monday|mon|tuesday|tues|tue|wednesday|weds|wed|thursday|thurs|thur|thu|friday|fri|saturday|sat';
const MONTH = 'january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sept|sep|october|oct|november|nov|december|dec';
const ORD = '(?:st|nd|rd|th)?';

/** Every date shape, as one pattern (no capture groups of its own). */
const DATE = [
    'the day after tomorrow', 'today', 'tonight', 'tomorrow', 'tmr',
    `in\\s+(?:a|an|one|two|three|four|\\d{1,3})\\s*(?:days?|weeks?|months?)`,
    `(?:the\\s+)?end\\s+of\\s+(?:the\\s+|this\\s+|next\\s+)?(?:week|month|year)`,
    `(?:next|this)\\s+(?:week|month)`,
    `(?:(?:next|this|on)\\s+)?(?:${WEEKDAY})\\b`,
    `(?:${MONTH})\\.?\\s+\\d{1,2}${ORD}(?:,?\\s*\\d{4})?`,
    `(?:the\\s+)?\\d{1,2}${ORD}\\s+(?:of\\s+)?(?:${MONTH})(?:,?\\s*\\d{4})?`,
    `\\d{4}-\\d{2}-\\d{2}`,
    `\\d{1,2}/\\d{1,2}(?:/\\d{2,4})?`,
    `the\\s+\\d{1,2}${ORD}`,
    'christmas|xmas',
].join('|');

const DEADLINE = new RegExp(
    `\\b(?:due(?:\\s+(?:by|on|before))?|by|before|until|till|deadline(?:\\s+(?:is|of|on))?|no\\s+later\\s+than|has\\s+to\\s+be\\s+done\\s+by)\\s+(${DATE})(?![a-z])`, 'i');
const ANY_DATE = new RegExp(`\\b(${DATE})(?![a-z])`, 'i');

const NUMBER_WORDS: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4 };
const noon = (date: Date) => { const copy = new Date(date); copy.setHours(12, 0, 0, 0); return copy; };
const addDays = (date: Date, days: number) => { const copy = noon(date); copy.setDate(copy.getDate() + days); return copy; };

/** One date phrase (as matched above) as a day, or null when it names no real day. */
export function readDate(phrase: string, today: Date = new Date()): Date | null {
    const text = phrase.toLowerCase().trim().replace(/\s+/g, ' ');
    const base = noon(today);
    if (text === 'today' || text === 'tonight') return base;
    if (text === 'tomorrow' || text === 'tmr') return addDays(base, 1);
    if (text === 'the day after tomorrow') return addDays(base, 2);
    if (text === 'christmas' || text === 'xmas') {
        const year = base.getMonth() === 11 && base.getDate() > 25 ? base.getFullYear() + 1 : base.getFullYear();
        return new Date(year, 11, 25, 12);
    }
    let match = text.match(/^in (a|an|one|two|three|four|\d{1,3}) ?(days?|weeks?|months?)$/);
    if (match) {
        const amount = NUMBER_WORDS[match[1]] ?? Number(match[1]);
        if (match[2].startsWith('month')) { const date = noon(base); date.setMonth(date.getMonth() + amount); return date; }
        return addDays(base, match[2].startsWith('week') ? amount * 7 : amount);
    }
    match = text.match(/end of (?:the |this |(next) )?(week|month|year)$/);
    if (match) {
        const later = !!match[1];
        if (match[2] === 'week') return addDays(base, ((7 - base.getDay()) % 7) + (later ? 7 : 0));
        if (match[2] === 'month') return new Date(base.getFullYear(), base.getMonth() + (later ? 2 : 1), 0, 12);
        return new Date(base.getFullYear() + (later ? 1 : 0), 11, 31, 12);
    }
    match = text.match(/^(next|this) (week|month)$/);
    if (match) {
        if (match[2] === 'week') return addDays(base, match[1] === 'next' ? 7 : (5 - base.getDay() + 7) % 7);
        return match[1] === 'next' ? new Date(base.getFullYear(), base.getMonth() + 1, 1, 12) : new Date(base.getFullYear(), base.getMonth() + 1, 0, 12);
    }
    match = text.match(new RegExp(`^(?:(next|this|on) )?(${WEEKDAY})$`));
    if (match) {
        let ahead = (WEEKDAYS[match[2]] - base.getDay() + 7) % 7;
        // The coming one; "next Friday" on a Friday is a week away, never today.
        if (ahead === 0) ahead = 7;
        return addDays(base, ahead);
    }
    const dayMonth = (day: number, month: number, year?: number) => {
        if (day < 1 || day > 31 || month < 0 || month > 11) return null;
        let date = new Date(year ?? base.getFullYear(), month, day, 12);
        if (date.getMonth() !== month) return null;
        // Gone already this year: next year, the way a calendar reads it.
        if (!year && date < base) date = new Date(base.getFullYear() + 1, month, day, 12);
        return date;
    };
    match = text.match(new RegExp(`^(${MONTH})\\.? (\\d{1,2})${ORD}(?:,? ?(\\d{4}))?$`));
    if (match) return dayMonth(Number(match[2]), MONTHS[match[1]], match[3] ? Number(match[3]) : undefined);
    match = text.match(new RegExp(`^(?:the )?(\\d{1,2})${ORD} (?:of )?(${MONTH})(?:,? ?(\\d{4}))?$`));
    if (match) return dayMonth(Number(match[1]), MONTHS[match[2]], match[3] ? Number(match[3]) : undefined);
    match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
        const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
        return localDateKey(date) === text ? date : null;
    }
    match = text.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
    if (match) {
        // Month first, as North American phones write it.
        const year = match[3] ? (match[3].length === 2 ? 2000 + Number(match[3]) : Number(match[3])) : undefined;
        return dayMonth(Number(match[2]), Number(match[1]) - 1, year);
    }
    match = text.match(new RegExp(`^the (\\d{1,2})${ORD}$`));
    if (match) {
        const day = Number(match[1]);
        if (day < 1 || day > 31) return null;
        let date = new Date(base.getFullYear(), base.getMonth(), day, 12);
        if (date.getDate() !== day) return null;
        if (date < base) date = new Date(base.getFullYear(), base.getMonth() + 1, day, 12);
        return date.getDate() === day ? date : null;
    }
    return null;
}

/** The deadline in a sentence ("due by Friday"), with the words to take out of the title. */
export function findDeadline(text: string, today: Date = new Date()): { date: string; phrase: string } | null {
    const match = text.match(DEADLINE);
    const date = match ? readDate(match[1], today) : null;
    return match && date ? { date: localDateKey(date), phrase: match[0] } : null;
}

/** The first date in a sentence, with the words to take out. */
export function findDate(text: string, today: Date = new Date()): { date: string; phrase: string } | null {
    const match = text.match(ANY_DATE);
    const date = match ? readDate(match[1], today) : null;
    return match && date ? { date: localDateKey(date), phrase: match[0] } : null;
}

/**
 * How hard, when the sentence says so — "it's hard", "hard task", "easy one",
 * "difficulty: medium", or the word on its own at the very end — but never a
 * word inside the name ("Fix the hard drive" stays a name).
 */
export function findDifficulty(text: string): { difficulty: 1 | 2 | 3; phrase: string } | null {
    const said = (words: string) => new RegExp(
        `(?:\\b(?:it'?s|its|is|difficulty|effort)\\s*:?\\s*(?:really\\s+|very\\s+|pretty\\s+)?(?:${words})\\b`
        + `|\\b(?:${words})\\s+(?:one|task|habit|goal|difficulty|effort)\\b`
        + `|[,(]\\s*(?:${words})\\s*(?=[,)])`
        + `|(?:[,(-]|\\s)\\s*(?:${words})\\s*\\)?\\s*$)`, 'i');
    const hard = text.match(said('hard|difficult|tough|challenging')) ?? text.match(/\b(?:high\s+effort|(?:difficulty|effort)\s*:?\s*(?:high|3))\b/i);
    if (hard) return { difficulty: 3, phrase: hard[0] };
    const easy = text.match(said('easy|simple|light')) ?? text.match(/\b(?:low\s+effort|(?:difficulty|effort)\s*:?\s*(?:low|1))\b/i);
    if (easy) return { difficulty: 1, phrase: easy[0] };
    const medium = text.match(said('medium|moderate|normal'));
    if (medium) return { difficulty: 2, phrase: medium[0] };
    return null;
}

/** Exact or flexible, when the sentence says: "at 3pm sharp", "exactly at 9", "flexible", "anytime". */
export function findTiming(text: string): { flexible: boolean; phrase: string } | null {
    const exact = text.match(/\b(?:sharp|exactly|on the dot|fixed time|exact time|not flexible)\b/i);
    if (exact) return { flexible: false, phrase: exact[0] };
    const loose = text.match(/\b(?:flexible|flexibly|any\s?time|whenever i can|roughly|around)\b/i);
    if (loose) return { flexible: true, phrase: loose[0] };
    return null;
}

/** Priority words: "urgent", "important", "high priority" / "low priority", "no rush". */
export function findPriority(text: string): { priority: 1 | 2 | 3; phrase: string } | null {
    // "Not urgent" before "urgent", so the "urgent" inside it is not read as high.
    const low = text.match(/\b(?:low\s+(?:priority|urgency)|(?:urgency|priority)\s*:?\s*low|not\s+(?:very\s+|that\s+|really\s+)?(?:urgent|important)|no\s+rush|no\s+hurry|sometime|whenever|eventually|p3)\b/i);
    if (low) return { priority: 3, phrase: low[0] };
    const high = text.match(/\b(?:(?:very\s+|super\s+|really\s+)?urgent|urgently|asap|important|critical|high\s+(?:priority|urgency)|(?:urgency|priority)\s*:?\s*high|top\s+priority|must\s+do|p1)\b/i);
    if (high) return { priority: 1, phrase: high[0] };
    const normal = text.match(/\b(?:(?:normal|medium)\s+(?:priority|urgency)|(?:urgency|priority)\s*:?\s*(?:normal|medium)|p2)\b/i);
    if (normal) return { priority: 2, phrase: normal[0] };
    return null;
}

/** "from 2 to 4pm", "2-3:30pm", "9am to 11am": a start and a length. */
export function findTimeRange(text: string): { start: string; minutes: number; phrase: string } | null {
    const match = text.match(/\b(?:from\s+)?(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?\s*(?:-|–|to|till|until)\s*(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)\b/i)
        ?? text.match(/\bfrom\s+(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?\s*(?:-|–|to|till|until)\s*(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?\b/i);
    if (!match) return null;
    const endMeridiem = match[6]?.toLowerCase();
    const startMeridiem = match[3]?.toLowerCase() ?? endMeridiem;
    const toMinutes = (hour: number, minute: number, meridiem?: string) => {
        if (hour > 24 || minute > 59) return null;
        let h = hour;
        if (meridiem === 'pm' && h < 12) h += 12;
        if (meridiem === 'am' && h === 12) h = 0;
        if (!meridiem && h >= 1 && h <= 6) h += 12;
        return h < 24 ? h * 60 + minute : null;
    };
    let start = toMinutes(Number(match[1]), Number(match[2] ?? 0), startMeridiem);
    const end = toMinutes(Number(match[4]), Number(match[5] ?? 0), endMeridiem);
    if (start === null || end === null) return null;
    // "11 to 1pm": the start was the morning.
    if (start >= end && !match[3] && start >= 12 * 60) start -= 12 * 60;
    if (end <= start || end - start > 12 * 60) return null;
    const clock = `${String(Math.floor(start / 60)).padStart(2, '0')}:${String(start % 60).padStart(2, '0')}`;
    return { start: clock, minutes: end - start, phrase: match[0] };
}
