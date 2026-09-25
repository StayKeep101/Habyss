import { localDateKey } from './habitSchedule';
import type { TaskPriority } from './tasks';

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
    /** Which parts of the sentence were recognised, for the preview. */
    matched: { date: boolean; time: boolean; estimate: boolean; priority: boolean };
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

const tidyTitle = (value: string): string => {
    const cleaned = value
        .replace(/\s+/g, ' ')
        .replace(/\s*[,;:]\s*$/g, '')
        .replace(/^\s*[,;:-]\s*/g, '')
        .replace(/\b(on|at|by|for|in|this|next)\s*$/i, '')
        .trim();
    return cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : '';
};

const addDays = (from: Date, days: number): Date => {
    const date = new Date(from);
    date.setDate(date.getDate() + days);
    return date;
};

export function parseTaskText(input: string, today: Date = new Date()): ParsedTaskText {
    const matched = { date: false, time: false, estimate: false, priority: false };
    let rest = ` ${(input ?? '').trim()} `;
    const strike = (pattern: RegExp) => { rest = rest.replace(pattern, ' '); };
    const base = new Date(today);
    base.setHours(12, 0, 0, 0);

    /* ------------------------------------------------------------- priority */
    let priority: TaskPriority = 2;
    if (/\b(urgent|asap|important|critical|priority)\b/i.test(rest)) {
        priority = 1;
        matched.priority = true;
        strike(/\b(urgent|asap|important|critical|high priority|priority)\b/gi);
    } else if (/\b(sometime|whenever|no rush|low priority|eventually)\b/i.test(rest)) {
        priority = 3;
        matched.priority = true;
        strike(/\b(sometime|whenever|no rush|low priority|eventually)\b/gi);
    }

    /* ------------------------------------------------------------- estimate */
    let estimatedMinutes: number | undefined;
    const estimate = rest.match(/\b(?:for\s+|takes\s+)?(\d{1,3})\s*(minutes?|mins?|m|hours?|hrs?|h)\b/i);
    if (estimate) {
        const amount = Number(estimate[1]);
        const minutes = /^h/i.test(estimate[2]) ? amount * 60 : amount;
        if (minutes > 0 && minutes <= 24 * 60) {
            estimatedMinutes = minutes;
            matched.estimate = true;
            strike(new RegExp(escapeRegex(estimate[0]), 'i'));
        }
    }

    /* ----------------------------------------------------------------- date */
    let due: Date | undefined;

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
        if (localDateKey(candidate) === `${year}-${month}-${day}`) { due = candidate; strike(new RegExp(escapeRegex(isoDate[0]))); }
    } else if (named) {
        const word = named[1].toLowerCase();
        due = word.startsWith('today') || word === 'tonight' ? base
            : word === 'the day after tomorrow' ? addDays(base, 2)
                : addDays(base, 1);
        strike(new RegExp(escapeRegex(named[0]), 'i'));
        // "Tonight" is a time as much as a date.
        if (word === 'tonight') matched.time = true;
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
        strike(new RegExp(escapeRegex(match[0]), 'i'));
    } else if (monthFirst || dayFirst) {
        const month = MONTHS[(monthFirst ? monthFirst[1] : dayFirst![2]).toLowerCase()];
        const day = Number(monthFirst ? monthFirst[2] : dayFirst![1]);
        if (day >= 1 && day <= 31) {
            let candidate = new Date(base.getFullYear(), month, day, 12);
            // A date already gone means next year, the way a calendar does it.
            if (candidate < base) candidate = new Date(base.getFullYear() + 1, month, day, 12);
            if (candidate.getMonth() === month) { due = candidate; strike(new RegExp(escapeRegex((monthFirst ?? dayFirst)![0]), 'i')); }
        }
    } else if (nextWeek) {
        due = addDays(base, 7);
        strike(/\bnext\s+week\b/i);
    }

    if (due) matched.date = true;

    /* ----------------------------------------------------------------- time */
    let dueTime: string | undefined;
    const wordTimes: { pattern: RegExp; time: string }[] = [
        { pattern: /\b(at\s+)?noon\b/i, time: '12:00' },
        { pattern: /\b(at\s+)?midnight\b/i, time: '00:00' },
        { pattern: /\bmorning\b/i, time: '09:00' },
        { pattern: /\bafternoon\b/i, time: '14:00' },
        { pattern: /\b(evening|tonight)\b/i, time: '19:00' },
    ];
    const clockPatterns: { regex: RegExp; hasMinutes: boolean; bare?: boolean }[] = [
        { regex: /\bat\s+(\d{1,2})[:.](\d{2})\s*(am|pm)?\b/i, hasMinutes: true },
        { regex: /\b(\d{1,2})[:.](\d{2})\s*(am|pm)\b/i, hasMinutes: true },
        { regex: /\bat\s+(\d{1,2})\s*(am|pm)\b/i, hasMinutes: false },
        { regex: /\b(\d{1,2})\s*(am|pm)\b/i, hasMinutes: false },
        { regex: /\bat\s+(\d{1,2})\b/i, hasMinutes: false, bare: true },
    ];

    for (const pattern of clockPatterns) {
        const match = rest.match(pattern.regex);
        if (!match) continue;
        let hour = Number(match[1]);
        const minute = pattern.hasMinutes ? Number(match[2]) : 0;
        const meridiem = (pattern.hasMinutes ? match[3] : match[2])?.toLowerCase();
        if (hour > 24 || minute > 59) continue;
        if (meridiem === 'pm' && hour < 12) hour += 12;
        if (meridiem === 'am' && hour === 12) hour = 0;
        // A bare hour of 1-6 reads as the afternoon, which is how people say it.
        if (pattern.bare && hour >= 1 && hour <= 6) hour += 12;
        if (hour >= 24) continue;
        dueTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
        matched.time = true;
        strike(new RegExp(escapeRegex(match[0]), 'i'));
        break;
    }

    if (!dueTime) {
        for (const word of wordTimes) {
            const match = rest.match(word.pattern);
            if (!match) continue;
            dueTime = word.time;
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

    /* ---------------------------------------------------------------- title */
    strike(/\b(due|on|by)\b/gi);
    const title = tidyTitle(rest);

    return {
        title,
        dueDate: due ? localDateKey(due) : undefined,
        dueTime,
        estimatedMinutes,
        priority,
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
    return `${when}${parsed.dueTime ? ` at ${parsed.dueTime}` : ''}${parsed.estimatedMinutes ? ` · ${parsed.estimatedMinutes} min` : ''}`;
}
