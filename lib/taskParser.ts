import { localDateKey } from './habitSchedule';
import { formatDuration } from './habitMeasurement';
import type { TaskPriority } from './tasks';
import { findDeadline, findDifficulty, findPriority, findTimeRange, findTiming } from './dateWords';
import { NUMBER, TAKEN, afterCorrection, shield, tidyTaken, toNumber } from './phrases';

/**
 * Task parser.
 *
 * One line in, a task out: what it is, when it is due, what time, how long and
 * how urgent. The same idea as the habit parser, and the same rules — it is
 * deterministic and local, so adding a task works with no model, on a plane,
 * and reads the same way every time.
 *
 * Every phrase it understands is taken out of the title, because a task called
 * "Call the bank tomorrow at 2pm" that is already due tomorrow at 2pm reads
 * like a mistake. Anything it is unsure of is left in the title rather than
 * guessed at: a wrong date is worse than no date, since a wrong one hides the
 * task until the day it was never meant for.
 */

export interface ParsedTaskText {
    title: string;
    /** YYYY-MM-DD. */
    dueDate?: string;
    /** HH:MM, 24 hour. */
    dueTime?: string;
    estimatedMinutes?: number;
    priority: TaskPriority;
    /** YYYY-MM-DD: "due by Friday", when it must be done by (the day to do it is `dueDate`). */
    deadline?: string;
    /** "hard", "easy one", "difficulty: medium". */
    difficulty?: 1 | 2 | 3;
    /** "at 3pm sharp" (false) or "flexible" (true), when it says. */
    flexible?: boolean;
    /** Which parts of the sentence were recognised, for the preview. */
    matched: { date: boolean; time: boolean; estimate: boolean; priority: boolean; deadline?: boolean; difficulty?: boolean; timing?: boolean };
}

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

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The title once its phrases are out: tidied only where they were (lib/phrases.ts). */
const tidyTitle = (value: string): string => {
    const cleaned = tidyTaken(value);
    if (!cleaned) return '';
    // A link stays exactly as written.
    return /^(https?:|www\.)/i.test(cleaned) ? cleaned : cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
};

const addDays = (from: Date, days: number): Date => {
    const date = new Date(from);
    date.setDate(date.getDate() + days);
    return date;
};

/** Clock hours and minutes said in words ("at four thirty"). */
const WORD_HOURS: Record<string, number> = {
    one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
};
const WORD_MINUTES: Record<string, string> = { fifteen: '15', thirty: '30', fortyfive: '45' };

export function parseTaskText(input: string, today: Date = new Date()): ParsedTaskText {
    const matched: ParsedTaskText['matched'] = { date: false, time: false, estimate: false, priority: false };
    // "Monday's meeting", "about Saturday", links: not dates (lib/phrases.ts).
    const shielded = shield((input ?? '').trim());
    let rest = ` ${shielded.text} `;
    const strike = (pattern: RegExp) => { rest = rest.replace(pattern, TAKEN); };
    const take = (phrase: string) => { rest = rest.replace(phrase, TAKEN); };
    // "Meeting on Tuesday, wait, they moved it to Thursday": the date meant is the last one.
    const corrected = afterCorrection(rest);
    const base = new Date(today);
    base.setHours(12, 0, 0, 0);

    /* ------------------------------------------------------------- deadline */
    // "due by Friday", "by Dec 5", "before next week": when it must be done by.
    const due_by = findDeadline(rest, today);
    if (due_by) { matched.deadline = true; take(due_by.phrase); }

    /* ---------------------------------------------------- difficulty, timing */
    const hardness = findDifficulty(rest);
    if (hardness) { matched.difficulty = true; take(hardness.phrase); }
    const timing = findTiming(rest);
    if (timing) { matched.timing = true; take(timing.phrase); }

    /* ------------------------------------------------------------- priority */
    let priority: TaskPriority = 2;
    const urgency = findPriority(rest);
    if (urgency) {
        priority = urgency.priority;
        matched.priority = true;
        take(urgency.phrase);
    } else if (/\bpriority\b/i.test(rest)) {
        priority = 1;
        matched.priority = true;
        strike(/\bpriority\b/gi);
    }

    /* ------------------------------------------------- "from 2 to 4pm" */
    let rangeStart: string | undefined;
    let estimatedMinutes: number | undefined;
    const range = findTimeRange(rest);
    if (range) {
        rangeStart = range.start;
        estimatedMinutes = range.minutes;
        matched.time = true;
        matched.estimate = true;
        take(range.phrase);
    }

    /* ------------------------------------------------------------- estimate */
    // "30 minutes", "takes one hour", "a 90-minute session", "2h". A bare
    // "14 h" is a clock time in French, not a length, so "h" needs no space.
    const estimate = estimatedMinutes === undefined
        ? rest.match(new RegExp(`\\b(?:for\\s+|takes?\\s+(?:only\\s+|about\\s+|around\\s+)?|estimated\\s+(?:to\\s+take\\s+|at\\s+)?)?(${NUMBER})(?:\\s+|-)(minutes?|mins?|hours?|hrs?)\\b`, 'i'))
            ?? rest.match(/\b(\d{1,3})(m|h)\b/i)
        : null;
    if (estimate) {
        const amount = toNumber(estimate[1]) ?? NaN;
        const minutes = /^h/i.test(estimate[2]) ? amount * 60 : amount;
        if (minutes > 0 && minutes <= 200 * 60) {
            estimatedMinutes = minutes;
            matched.estimate = true;
            strike(new RegExp(escapeRegex(estimate[0]), 'i'));
        }
    }

    /* ----------------------------------------------------------------- date */
    let due: Date | undefined;
    // Read from the whole sentence: "due tonight" may already be taken as the deadline.
    let saidTonight = /\b(tonight|this evening|in the evening)\b/i.test(shielded.text);

    // After a correction, the date meant is in the words that follow it; the
    // one before it is dropped too.
    const scope = corrected && /\b(today|tonight|tomorrow|sunday|monday|tuesday|wednesday|thursday|friday|saturday|january|february|march|april|may|june|july|august|september|october|november|december|\d{1,2}\/\d{1,2})\b/i.test(corrected) ? corrected : null;
    if (scope) {
        const before = rest.slice(0, rest.length - scope.length);
        const cleared = before.replace(/\b(?:on\s+|this\s+|next\s+)?(today|tomorrow|sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/gi, TAKEN)
            .replace(/\b(?:wait|actually|no wait|correction|i mean|scratch that)\b[,:]?/gi, TAKEN);
        rest = cleared + scope.replace(/\b(?:i think\s+)?(?:they\s+)?(?:moved|changed)\s+it\s+to\b/gi, TAKEN);
    }
    const named = rest.match(/\b(today|tonight|tomorrow|tmr|the day after tomorrow)\b/i);
    const relative = rest.match(/\bin\s+(\d{1,3})\s*(days?|weeks?)\b/i);
    const nextWeekday = rest.match(/\b(?:next|this|on|by)\s+(sunday|sun|monday|mon|tuesday|tues|tue|wednesday|weds|wed|thursday|thurs|thur|thu|friday|fri|saturday|sat)\b/i);
    const bareWeekday = rest.match(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i);
    const monthFirst = rest.match(/\b(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sept|sep|october|oct|november|nov|december|dec)\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b/i);
    const dayFirst = rest.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sept|sep|october|oct|november|nov|december|dec)\b/i);
    const isoDate = rest.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
    const nextWeek = rest.match(/\bnext\s+week\b/i);

    if (isoDate) {
        const [, year, month, day] = isoDate;
        const candidate = new Date(Number(year), Number(month) - 1, Number(day), 12);
        // A full date already gone is still to be done: today.
        if (localDateKey(candidate) === `${year}-${month}-${day}`) {
            due = localDateKey(candidate) < localDateKey(base) ? new Date(base.getFullYear(), base.getMonth(), base.getDate(), 12) : candidate;
            strike(new RegExp(escapeRegex(isoDate[0])));
        }
    } else if (named) {
        const word = named[1].toLowerCase();
        due = word.startsWith('today') || word === 'tonight' ? base
            : word === 'the day after tomorrow' ? addDays(base, 2)
                : addDays(base, 1);
        strike(new RegExp(escapeRegex(named[0]), 'i'));
        // "Tonight" is a time as much as a date.
        if (word === 'tonight') { matched.time = true; saidTonight = true; }
    } else if (relative) {
        const amount = Number(relative[1]);
        due = addDays(base, /^w/i.test(relative[2]) ? amount * 7 : amount);
        strike(new RegExp(escapeRegex(relative[0]), 'i'));
    } else if (nextWeekday || bareWeekday) {
        const match = (nextWeekday ?? bareWeekday)!;
        const wanted = WEEKDAYS[match[1].toLowerCase()];
        // The next one that has not happened yet; "next Friday" on a Friday
        // means the Friday coming, not today.
        let ahead = (wanted - base.getDay() + 7) % 7;
        if (ahead === 0) ahead = 7;
        due = addDays(base, ahead);
        // "Buy ingredients for Sunday dinner": the day describes the dinner,
        // so it sets the date and stays in the name.
        const after = rest.slice((match.index ?? 0) + match[0].length).match(/^\s+([a-z]+)/i)?.[1]?.toLowerCase();
        const describes = !!after && /^(dinner|lunch|breakfast|brunch|meeting|class|lecture|service|party|game|match|plans?|shift|school|session|call|practice|rehearsal|market|night|show|brunch)$/.test(after);
        if (!describes) strike(new RegExp(escapeRegex(match[0]), 'i'));
    } else if (monthFirst || dayFirst) {
        const month = MONTHS[(monthFirst ? monthFirst[1] : dayFirst![2]).toLowerCase()];
        const day = Number(monthFirst ? monthFirst[2] : dayFirst![1]);
        if (day >= 1 && day <= 31) {
            let candidate = new Date(base.getFullYear(), month, day, 12);
            // A date gone by: only just (within half a year) and it is still to
            // be done, so today, never a day already gone; long ago ("Jan 5" in
            // November) means next year, the way a calendar does it.
            const sixMonthsAgo = new Date(base.getFullYear(), base.getMonth() - 6, base.getDate(), 12);
            if (candidate < base && localDateKey(candidate) !== localDateKey(base)) {
                candidate = candidate >= sixMonthsAgo ? new Date(base.getFullYear(), base.getMonth(), base.getDate(), 12)
                    : new Date(base.getFullYear() + 1, month, day, 12);
            }
            // February 29: the next year that has one.
            for (let ahead = 1; ahead <= 4 && month === 1 && day === 29 && candidate.getMonth() !== month; ahead++) {
                candidate = new Date(base.getFullYear() + ahead, 1, 29, 12);
            }
            if (candidate.getMonth() === month || localDateKey(candidate) === localDateKey(base)) { due = candidate; strike(new RegExp(escapeRegex((monthFirst ?? dayFirst)![0]), 'i')); }
        }
    } else if (nextWeek) {
        due = addDays(base, 7);
        strike(/\bnext\s+week\b/i);
    }

    if (due) matched.date = true;

    /* ----------------------------------------------------------------- time */
    let dueTime: string | undefined = rangeStart;
    // A clock time said ("at 4", "from 2 to 4pm", "at noon") is a time to keep;
    // "this afternoon" or "tonight" is only roughly when.
    let exactTime = !!rangeStart;
    const wordTimes: { pattern: RegExp; time: string }[] = [
        { pattern: /\b(at\s+)?noon\b/i, time: '12:00' },
        // Midnight is the end of the day it is due, never 00:00 that morning.
        { pattern: /\b(?:at\s+|before\s+|by\s+)?midnight\b/i, time: '23:59' },
        { pattern: /\bmorning\b/i, time: '09:00' },
        { pattern: /\bafternoon\b/i, time: '14:00' },
        { pattern: /\b(evening|tonight)\b/i, time: '19:00' },
    ];
    // A clock time said in words reads as one in figures: "at four" is "at 4",
    // "at four thirty pm" "at 4:30 pm"; "o'clock" says nothing more. Only when
    // what follows is time talk, so "dinner at Four Seasons" keeps its name.
    rest = rest.replace(
        new RegExp(`\\bat\\s+(${Object.keys(WORD_HOURS).join('|')})(?:\\s+(fifteen|thirty|forty[\\s-]five))?(?=\\s*(?:o'?clock\\b|am\\b|pm\\b|[,.!;]|$|${escapeRegex(TAKEN.trim())}|\\s(?:today|tomorrow|tonight|for|on|this|next|every|and|then)\\b))`, 'gi'),
        (_whole, hour: string, minutes?: string) => `at ${WORD_HOURS[hour.toLowerCase()]}${minutes ? `:${WORD_MINUTES[minutes.toLowerCase().replace(/[\s-]/, '')]}` : ''}`,
    ).replace(/\b(at\s+\d{1,2}(?:[:.]\d{2})?)\s*o'?clock\b/gi, '$1');
    const clockPatterns: { regex: RegExp; hasMinutes: boolean; bare?: boolean }[] = [
        { regex: /\bat\s+(\d{1,2})[:.](\d{2})\s*(am|pm)?\b/i, hasMinutes: true, bare: true },
        { regex: /\b(\d{1,2})[:.](\d{2})\s*(am|pm)\b/i, hasMinutes: true },
        { regex: /\bat\s+(\d{1,2})\s*(am|pm)\b/i, hasMinutes: false },
        { regex: /\b(\d{1,2})\s*(am|pm)\b/i, hasMinutes: false },
        { regex: /\bat\s+(\d{1,2})\b/i, hasMinutes: false, bare: true },
    ];

    for (const pattern of rangeStart ? [] : clockPatterns) {
        const match = rest.match(pattern.regex);
        if (!match) continue;
        let hour = Number(match[1]);
        const minute = pattern.hasMinutes ? Number(match[2]) : 0;
        const meridiem = (pattern.hasMinutes ? match[3] : match[2])?.toLowerCase();
        if (hour > 24 || minute > 59) continue;
        if (meridiem === 'pm' && hour < 12) hour += 12;
        // "Due at 12:00 AM" is the end of that day, not the morning already gone.
        const endOfDay = meridiem === 'am' && hour === 12;
        if (meridiem === 'am' && hour === 12) hour = 0;
        // "Tonight at 11:59": the evening one.
        if (!meridiem && saidTonight && hour >= 1 && hour < 12) hour += 12;
        // A bare hour of 1-6 reads as the afternoon, which is how people say it.
        else if (pattern.bare && hour >= 1 && hour <= 6) hour += 12;
        if (hour >= 24) continue;
        dueTime = endOfDay && minute === 0 ? '23:59' : `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
        exactTime = !endOfDay;
        matched.time = true;
        strike(new RegExp(escapeRegex(match[0]), 'i'));
        break;
    }

    if (!dueTime && saidTonight) { dueTime = '19:00'; matched.time = true; }
    if (!dueTime) {
        for (const word of wordTimes) {
            const match = rest.match(word.pattern);
            if (!match) continue;
            dueTime = word.time;
            exactTime = word.time === '12:00';
            matched.time = true;
            strike(new RegExp(escapeRegex(match[0]), 'i'));
            break;
        }
    }

    // A time with no day means the next time that hour comes round.
    if (dueTime && !due) {
        due = base;
        matched.date = true;
    }

    // A deadline with no day of its own to do it: start today. A deadline on
    // (or before) the day it is planned is just its day.
    let deadline = due_by?.date;
    if (deadline && !due) { due = base; matched.date = true; }
    if (deadline && due && deadline <= localDateKey(due)) {
        due = new Date(`${deadline}T12:00:00`);
        deadline = undefined;
    }

    /* ---------------------------------------------------------------- title */
    const title = tidyTitle(shielded.restore(rest));

    return {
        title,
        dueDate: due ? localDateKey(due) : undefined,
        dueTime,
        estimatedMinutes,
        priority,
        deadline,
        difficulty: hardness?.difficulty,
        // Said how it is ("flexible", "sharp"), else fixed when a clock time was said.
        flexible: timing?.flexible ?? (exactTime ? false : undefined),
        matched,
    };
}

/** One line describing what will be created, for the preview under the field. */
export function describeParsedTask(parsed: ParsedTaskText, today: Date = new Date()): string {
    if (!parsed.dueDate) return 'No date — it will sit in today until you give it one';
    const date = new Date(`${parsed.dueDate}T12:00:00`);
    const todayKey = localDateKey(today);
    const tomorrowKey = localDateKey(addDays(today, 1));
    const when = parsed.dueDate === todayKey ? 'Today'
        : parsed.dueDate === tomorrowKey ? 'Tomorrow'
            : date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
    return `${when}${parsed.dueTime ? ` at ${parsed.dueTime}` : ''}${parsed.estimatedMinutes ? ` · ${formatDuration(parsed.estimatedMinutes * 60, true)}` : ''}`;
}

/**
 * Whether a task names a count or a time to reach: "Call 25 leads", "Write
 * 1500 words", "Study 2 hours". Read only from a verb, a number and a noun at
 * the start, so "Call the bank at 2pm" stays a done-or-not task.
 */
export function readTaskMeasure(text: string): { measure: 'count' | 'time'; target: number; unit?: string } | null {
    const clean = text.trim();
    // "Complete calculus questions 1–20": twenty questions.
    const range = clean.match(/^[a-z]+\s+(?:[a-z]+\s+){0,3}?([a-z]+)\s+(\d{1,4})\s*[–-]\s*(\d{1,4})\b/i);
    if (range && Number(range[3]) > Number(range[2])) return { measure: 'count', target: Number(range[3]) - Number(range[2]) + 1, unit: range[1].toLowerCase() };
    const head = clean.match(new RegExp(`^[a-z]+\\s+(${NUMBER})\\s*([a-z][a-z-]*)((?:\\s+[a-z][a-z-]*){0,3})`, 'i'));
    if (!head) return null;
    const amount = toNumber(head[1]);
    if (amount === null || !Number.isFinite(amount) || amount <= 0) return null;
    const word = head[2].toLowerCase();
    if (/^(h|hr|hrs|hour|hours)$/.test(word)) return { measure: 'time', target: Math.round(amount * 60) };
    if (/^(m|min|mins|minute|minutes)$/.test(word)) return { measure: 'time', target: Math.round(amount) };
    if (/^(am|pm|st|nd|rd|th)$/.test(word) || amount < 2) return null;
    // The thing counted is the last word before a joining word: "30 new
    // customer leads for the launch" counts leads, not "new".
    const words = [word, ...head[3].trim().split(/\s+/).filter(Boolean).map(item => item.toLowerCase())];
    const stop = words.findIndex((item, index) => index > 0 && /^(for|to|from|with|in|on|at|by|about|and|of|the|a|an|before|after|this|next|every|each|per)$/.test(item));
    const nouns = stop === -1 ? words : words.slice(0, stop);
    return { measure: 'count', target: amount, unit: nouns[nouns.length - 1] };
}
