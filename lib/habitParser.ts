import type { Habit } from './habitsSQLite';
import { findDeadline, findDifficulty, findPriority, findTimeRange, findTiming, readDate } from './dateWords';
import { localDateKey } from './habitSchedule';
import { NUMBER, TAKEN, shield, tidyTaken, toNumber } from './phrases';
import { serialiseRecurrence, type Recurrence } from './recurrence';

/**
 * Quick add: turn one line of plain text into a habit.
 *
 * "Gym Monday, Wednesday, Friday at 6, 45 minutes"
 *   -> Gym, Mon/Wed/Fri, 18:00, 45 minutes
 *
 * Deterministic and local. No model is involved, so it works offline and gives
 * the same answer every time. Anything the parser had to guess is reported in
 * `assumptions` so the UI can show it and let the user correct it, rather than
 * silently creating the wrong habit.
 */

export interface ParsedHabit {
    name: string;
    taskDays: string[];
    /** "HH:MM", 24 hour. */
    startTime?: string;
    durationMinutes?: number;
    targetValue?: number;
    targetUnit?: string;
    trackingMethod: 'boolean' | 'numeric';
    /** YYYY-MM-DD it stops: "until Dec 1", "due by Friday", "for 30 days". */
    endDate?: string;
    /** YYYY-MM-DD it begins: "starting January 1, 2027", "from Monday". */
    startDate?: string;
    /** A schedule beyond weekdays: "4 times a week", "every other day", "the last Sunday of each month". */
    recurrence?: Recurrence;
    /** 'quit' for something to stay away from: "Avoid…", "No sugar…", "Quit smoking". */
    habitType?: 'build' | 'quit';
    /** "high priority", "no rush". */
    priority?: 1 | 2 | 3;
    /** "hard", "easy one". */
    difficulty?: 1 | 2 | 3;
    /** "at 7 sharp" (false) or "flexible" (true), when it says. */
    flexible?: boolean;
    /** Human-readable notes about anything inferred rather than stated. */
    assumptions: string[];
    /** Which parts of the input were recognised, for highlighting. */
    matched: { days: boolean; time: boolean; duration: boolean; target: boolean };
}

const DAY_WORDS: Record<string, string> = {
    sunday: 'sun', sun: 'sun',
    monday: 'mon', mon: 'mon',
    tuesday: 'tue', tue: 'tue', tues: 'tue',
    wednesday: 'wed', wed: 'wed', weds: 'wed',
    thursday: 'thu', thu: 'thu', thur: 'thu', thurs: 'thu',
    friday: 'fri', fri: 'fri',
    saturday: 'sat', sat: 'sat',
};

const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri'];
const WEEKEND = ['sat', 'sun'];
const DAY_ORDER = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

/** Units we recognise as a countable target rather than a duration. */
const COUNT_UNITS = [
    'pages', 'page', 'glasses', 'glass', 'reps', 'rep', 'sets', 'set', 'steps', 'words', 'chapters', 'chapter',
    'km', 'kilometres', 'kilometers', 'miles', 'mile', 'litres', 'liters', 'litre', 'liter', 'l', 'ml', 'cups', 'cup', 'bottles',
    'servings', 'serving', 'push-ups', 'pushups', 'push ups', 'pull-ups', 'pullups', 'sit-ups', 'situps', 'squats', 'lunges', 'burpees', 'planks',
    'flashcards', 'cards', 'problems', 'questions', 'lessons', 'lesson', 'pomodoros', 'calories', 'grams', 'g',
];

const DURATION_UNITS = ['minutes', 'minute', 'mins', 'min', 'hours', 'hour', 'hrs', 'hr'];

const DAY_NAMES = 'sunday|monday|tuesday|wednesday|thursday|friday|saturday';
const MONTH_NAMES = 'january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec';
/** Where a part of the day starts, when no hour was said. */
const PART_HOURS: Record<string, string> = { morning: '08:00', afternoon: '14:00', evening: '19:00', night: '21:00' };

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// A joining word left dangling once the days are taken out ("Run Monday and Wednesday" → "Run").
const clean = (value: string) => value.replace(/\s+/g, ' ').replace(/\s+,/g, ',').replace(/(,\s*)+,/g, ',').replace(/^[,\s./-]+|[,\s./-]+$/g, '').replace(/\s+(?:and|&|or)$/i, '').trim();

/** Capitalise the first letter only, so "gym" becomes "Gym" but "HIIT" survives. */
const tidyName = (value: string): string => {
    const trimmed = clean(value);
    if (!trimmed) return '';
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
};

export function parseHabitText(input: string, today: Date = new Date()): ParsedHabit {
    const assumptions: string[] = [];
    const matched = { days: false, time: false, duration: false, target: false };
    // Links, "Monday's", "about Saturday": not schedule words (lib/phrases.ts).
    const shielded = shield((input ?? '').trim());
    let rest = ` ${shielded.text} `;
    const strike = (pattern: RegExp) => { rest = rest.replace(pattern, TAKEN); };
    const take = (phrase: string) => { rest = rest.replace(phrase, TAKEN); };
    const N = `(${NUMBER}|once|twice|thrice)`;
    const timesOf = (word: string) => /^once$/i.test(word) ? 1 : /^twice$/i.test(word) ? 2 : /^thrice$/i.test(word) ? 3 : toNumber(word);

    // Something to stay away from: "Avoid my phone…", "Quit smoking", "No
    // sugar on weekdays", "Limit takeout to once a week". Tracked as a quit
    // habit: a tick means you kept clean that day. Its words are its name,
    // so "the first 30 minutes" is never read as a 30-minute timer.
    const quit = /^\s*(?:avoid|quit|stop|no|don'?t|do not|never|limit|cut out|cut back on|give up|resist|stay off|abstain from)\b/i.test(shielded.text)
        || /\bzero as the (?:daily )?target\b/i.test(shielded.text);
    if (quit) strike(/,?\s*with\s+zero\s+as\s+the\s+(?:daily\s+)?target\b/i);

    /* ------------------------------------------------------- when it stops */
    // Read first: "until Friday" names a last day, not a day it repeats on.
    let endDate: string | undefined;
    const until = findDeadline(rest, today);
    const forSpan = rest.match(new RegExp(String.raw`\bfor\s+(?:the\s+next\s+)?(${NUMBER})\s*(days?|weeks?|months?)\b`, 'i'));
    if (until) { endDate = until.date; take(until.phrase); }
    else if (forSpan) {
        const amount = toNumber(forSpan[1]);
        const end = amount ? readDate(`in ${amount} ${forSpan[2]}`, today) : null;
        if (end) { end.setDate(end.getDate() - 1); endDate = localDateKey(end); take(forSpan[0]); }
    }

    /* ------------------------------------------------------ when it begins */
    // "starting January 1, 2027", "from next Monday", "beginning tomorrow": a
    // setting, never part of the name.
    let startDate: string | undefined;
    const begins = rest.match(new RegExp(String.raw`\b(?:starting|beginning|from|as of)\s+(?:on\s+)?(today|tomorrow|next\s+(?:week|month|${DAY_NAMES})|(?:this\s+)?(?:${DAY_NAMES})|(?:${MONTH_NAMES})\.?\s*\d{1,2}(?:st|nd|rd|th)?(?:\s*,?\s*\d{4})?|\d{4}-\d{2}-\d{2})\b`, 'i'));
    if (begins) {
        const when = readDate(begins[1], today) ?? readDate(begins[1].replace(/(\d)(st|nd|rd|th)\b/i, '$1'), today);
        if (when) { startDate = localDateKey(when); take(begins[0]); }
    }

    /* ------------------------------------------- priority, difficulty, timing */
    const urgency = findPriority(rest);
    if (urgency) take(urgency.phrase);
    const hardness = findDifficulty(rest);
    if (hardness) take(hardness.phrase);
    const timing = findTiming(rest);
    if (timing) take(timing.phrase);

    // "at the end of each day": the evening, every day (read before "each day" alone).
    let endOfDayTime: string | undefined;
    const endOfDay = quit ? null : rest.match(/\bat\s+the\s+end\s+of\s+(?:the|each|every)\s+day\b/i);
    if (endOfDay) { endOfDayTime = PART_HOURS.evening; matched.days = true; matched.time = true; take(endOfDay[0]); }

    /* ------------------------------------------------------- how often */
    let taskDays: string[] = [];
    let recurrence: Recurrence | undefined;
    let perDay: number | undefined;

    // Several times a day: "eight times a day", "twice daily", "morning and night".
    const many = rest.match(new RegExp(String.raw`\b${N}\s*(?:times?\s*|x\s*)?(?:a|per|each|every)\s+(day|workday|weekday)\b|\b${N}\s+(?:times?\s+)?daily\b`, 'i'));
    const twoParts = rest.match(/\b(?:every\s+|each\s+)?(?:morning|mornings)\s+and\s+(?:night|nights|evening|evenings)\b/i);
    if (many) {
        const times = timesOf(many[1] ?? many[3]);
        if (times && times > 1) {
            perDay = times;
            matched.days = true;
            // "four times per workday": on workdays.
            if (/work|week/i.test(many[2] ?? '')) taskDays = [...WEEKDAYS];
            take(many[0]);
        }
    }
    if (twoParts) { perDay = Math.max(perDay ?? 0, 2); matched.days = true; take(twoParts[0]); }

    // So many times a week or month, any days: "4 times a week", "twice per
    // week", "five days a week", "once a month", "three times weekly".
    // An amount per week ("Read 100 pages per week", "Complete 100 squats per
    // week", "Learn one new recipe per week"): once a week, the amount kept
    // in the name, since one tick a day of 100 pages was never the habit.
    let weeklyAmount = false;
    const spread = rest.match(new RegExp(String.raw`\b${N}\s+((?:[\w-]+\s+){1,3}?)(?:a|per|each|every)\s+(week|month)\b(?:\s+rather\s+than\s+daily)?`, 'i'));
    const plain = /^(?:times?|x|days?|evenings?|mornings?|nights?|sessions?|workouts?|runs?)\s*$/i;
    const quota = spread && !plain.test(spread[2]) ? null : rest.match(new RegExp(String.raw`\b${N}\s*(?:times?|x|days?|evenings?|mornings?|nights?|sessions?|workouts?|runs?)?\s*(?:a|per|each|every|in\s+a)\s+(week|month|workweek)\b|\b${N}\s*(?:times?|x)?\s+(weekly|monthly)\b`, 'i'));
    if (spread && !quota) {
        const times = timesOf(spread[1]);
        const period: 'week' | 'month' = spread[3].toLowerCase() === 'month' ? 'month' : 'week';
        const words = spread[2].trim().split(/\s+/);
        const last = words[words.length - 1].toLowerCase();
        // A count of things done one at a time ("3 blog posts a week") is that many times; an amount is once.
        const many = times && times >= 2 && times <= (period === 'week' ? 7 : 31) && !COUNT_UNITS.includes(last);
        recurrence = { kind: 'quota', every: 1, times: many ? times! : 1, period };
        weeklyAmount = true;
        matched.days = true;
        take(spread[0].slice(spread[0].search(/\b(?:a|per|each|every)\s+(?:week|month)\b/i)));
    }
    if (quota) {
        const times = timesOf(quota[1] ?? quota[3]);
        const word = (quota[2] ?? quota[4]).toLowerCase();
        const period: 'week' | 'month' = word.startsWith('month') ? 'month' : 'week';
        if (times && times >= 1 && times <= (period === 'week' ? 7 : 31)) {
            recurrence = { kind: 'quota', every: 1, times, period };
            matched.days = true;
            take(quota[0]);
        }
    }

    if (!recurrence) {
        const ordinals: Record<string, number> = { first: 1, '1st': 1, second: 2, '2nd': 2, third: 3, '3rd': 3, fourth: 4, '4th': 4, last: -1 };
        const nthOfMonth = rest.match(new RegExp(String.raw`\b(?:on\s+)?the\s+(first|1st|second|2nd|third|3rd|fourth|4th|last)\s+(${DAY_NAMES})\s+of\s+(?:each|every|the)\s+month\b`, 'i'));
        const dateOfMonth = rest.match(/\b(?:on\s+)?the\s+(\d{1,2})(?:st|nd|rd|th)?\s+(?:day\s+)?(?:of\s+)?(?:each|every)\s+month\b|\b(?:on\s+)?the\s+(first|last)\s+(?:day\s+)?of\s+(?:each|every|the)\s+month\b/i);
        const everyOtherDay = rest.match(new RegExp(String.raw`\bevery\s+(?:other|second|2nd|(${NUMBER}))\s+days?\b`, 'i'));
        const everyOtherWeekday = rest.match(new RegExp(String.raw`\bevery\s+(?:other|second|2nd|alternate)\s+(${DAY_NAMES})s?\b`, 'i'));
        const alternateWeeks = rest.match(/\b(?:on\s+)?(?:alternat(?:e|ing)\s+weeks|every\s+(?:other|second|2nd)\s+week)\b/i);
        const monthly = rest.match(/\b(?:once\s+a\s+month|every\s+month|each\s+month|monthly)\b/i);
        const weekly = rest.match(/\b(?:once\s+a\s+week|every\s+week|each\s+week)\b/i);
        // "Set a weekly spending limit": once a week, and "weekly" stays in the name.
        const weeklyWord = !weekly && /\bweekly\b/i.test(rest) && !/\b(sundays?|mondays?|tuesdays?|wednesdays?|thursdays?|fridays?|saturdays?)\b/i.test(rest);
        if (nthOfMonth) {
            recurrence = { kind: 'monthly', every: 1, ordinal: ordinals[nthOfMonth[1].toLowerCase()] as 1, day: DAY_WORDS[nthOfMonth[2].toLowerCase()] as never };
            take(nthOfMonth[0]);
        } else if (dateOfMonth) {
            const date = dateOfMonth[1] ? Number(dateOfMonth[1]) : dateOfMonth[2]?.toLowerCase() === 'last' ? 31 : 1;
            if (date >= 1 && date <= 31) { recurrence = { kind: 'monthly', every: 1, dates: [date] }; take(dateOfMonth[0]); }
        } else if (everyOtherDay) {
            const every = everyOtherDay[1] ? toNumber(everyOtherDay[1]) : 2;
            if (every && every >= 2 && every <= 30) { recurrence = { kind: 'daily', every }; take(everyOtherDay[0]); }
        } else if (everyOtherWeekday) {
            recurrence = { kind: 'weekly', every: 2, weekdays: [DAY_WORDS[everyOtherWeekday[1].toLowerCase()] as never] };
            take(everyOtherWeekday[0]);
        } else if (monthly) {
            recurrence = { kind: 'quota', every: 1, times: 1, period: 'month' };
            take(monthly[0]);
        } else if (weekly || weeklyWord) {
            recurrence = { kind: 'quota', every: 1, times: 1, period: 'week' };
            if (weekly) take(weekly[0]);
        }
        if (recurrence) matched.days = true;
        if (alternateWeeks && !recurrence) {
            recurrence = { kind: 'weekly', every: 2, weekdays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] };
            matched.days = true;
            take(alternateWeeks[0]);
        }
    }

    if (!recurrence && !matched.days) {
        if (/\b(every ?day|daily|each day|a day|per day)\b/i.test(rest)) {
            matched.days = true;
            strike(/\b(every ?day|daily|each day|per day)\b/i);
        } else if (/\b(?:week ?days?|weeknights?|work ?days?)\b/i.test(rest)) {
            taskDays = [...WEEKDAYS];
            matched.days = true;
            strike(/\b(?:on\s+|every\s+)?(?:week ?days?|weeknights?|work ?days?)\b/gi);
        } else if (/\bweek ?ends?\b/i.test(rest)) {
            taskDays = [...WEEKEND];
            matched.days = true;
            strike(/\b(?:on\s+|every\s+)?week ?ends?\b/gi);
        } else {
            const dayPattern = /\b(sundays?|sun|mondays?|mon|tuesdays?|tues|tue|wednesdays?|weds|wed|thursdays?|thurs|thur|thu|fridays?|fri|saturdays?|sat)\b/gi;
            const found = new Set<string>();
            for (const match of rest.matchAll(dayPattern)) {
                const key = match[1].toLowerCase().replace(/s$/, '');
                const day = DAY_WORDS[key] ?? DAY_WORDS[key.slice(0, 3)];
                if (day) found.add(day);
            }
            if (found.size) {
                taskDays = DAY_ORDER.filter(day => found.has(day));
                matched.days = true;
                // "every Monday, Wednesday and Friday": the days, and the words joining them.
                rest = rest.replace(/\b(?:on|every|each)\s+(?=(?:sundays?|sun|mondays?|mon|tuesdays?|tues|tue|wednesdays?|weds|wed|thursdays?|thurs|thur|thu|fridays?|fri|saturdays?|sat)\b)/gi, TAKEN);
                strike(dayPattern);
            }
        }
    }

    /* ------------------------------------------------- "from 7 to 8am" */
    let startTime: string | undefined = endOfDayTime;
    let durationMinutes: number | undefined;
    const range = quit ? null : findTimeRange(rest);
    if (range) {
        startTime = range.start;
        durationMinutes = range.minutes;
        matched.time = true;
        matched.duration = true;
        take(range.phrase);
    }

    /* ------------------------------------------------------------- duration */
    // "20 minutes", "one hour", "a 90-minute session". Not for a quit habit,
    // whose minutes are part of what it avoids.
    const durationMatch = durationMinutes !== undefined || quit || weeklyAmount ? null : rest.match(
        new RegExp(String.raw`\b(?:for\s+)?(${NUMBER}|an|a)(?:\s+|-)(${DURATION_UNITS.join('|')})\b`, 'i'),
    );
    if (durationMatch) {
        const amount = /^an?$/i.test(durationMatch[1]) ? 1 : toNumber(durationMatch[1]);
        if (amount && amount > 0) {
            durationMinutes = /^h/i.test(durationMatch[2]) ? amount * 60 : amount;
            matched.duration = true;
            take(durationMatch[0]);
        }
    }

    /* --------------------------------------------------------------- target */
    // Counted targets are taken before times so "10 pages" can never be read as
    // ten o'clock; "8,000 steps" and "two servings" are numbers too.
    let targetValue: number | undefined;
    let targetUnit: string | undefined;
    const countMatch = quit || weeklyAmount ? null : rest.match(
        new RegExp(String.raw`\b(?:at\s+least\s+)?(${NUMBER})\s*(${COUNT_UNITS.join('|')})\b(?:\s+of\s+([a-z]+))?`, 'i'),
    );
    // "five new Spanish words": counted, and the words describing them stay in the name.
    const describedCount = quit || weeklyAmount || countMatch ? null : rest.match(
        new RegExp(String.raw`\b(${NUMBER})\s+(?:[a-z-]+\s+){1,2}?(${COUNT_UNITS.join('|')})\b`, 'i'),
    );
    if (describedCount) {
        const amount = toNumber(describedCount[1]);
        if (amount && amount > 1) { targetValue = amount; targetUnit = describedCount[2].toLowerCase(); matched.target = true; }
    }
    if (countMatch) {
        const amount = toNumber(countMatch[1]);
        if (amount && amount > 0) {
            targetValue = amount;
            targetUnit = countMatch[2].toLowerCase();
            matched.target = true;
            // "two servings of fruit": the amount goes, the fruit stays.
            take(countMatch[3] ? countMatch[0].replace(new RegExp(String.raw`\s+of\s+${countMatch[3]}$`, 'i'), '') : countMatch[0]);
            if (countMatch[3]) rest = rest.replace(new RegExp(String.raw`${TAKEN}\s*of\s+`), `${TAKEN} `);
        }
    }

    /* ----------------------------------------------------------------- time */
    // Each pattern needs a real signal: "at", a colon, or am/pm. "Before 9
    // AM", "by 11 PM" and "after 9 PM" are limits, not start times, and stay
    // in the name where they mean something.
    const timePatterns: { regex: RegExp; hasMinutes: boolean; bare?: boolean }[] = [
        { regex: /\bat\s+(\d{1,2})[:.](\d{2})\s*(am|pm)?\b/i, hasMinutes: true },
        { regex: /\b(?:at\s+)?(\d{1,2})[:.](\d{2})\s*(am|pm)?\b/i, hasMinutes: true },
        { regex: /\bat\s+(\d{1,2})\s*(am|pm)\b/i, hasMinutes: false },
        { regex: /\b(\d{1,2})\s*(am|pm)\b/i, hasMinutes: false },
        { regex: /\bat\s+(\d{1,2})\b/i, hasMinutes: false, bare: true },
    ];
    const limitWords = /\b(before|by|after|until|till|no later than)\s*$/i;
    for (const pattern of startTime || quit ? [] : timePatterns) {
        const match = rest.match(pattern.regex);
        if (!match || match.index === undefined) continue;
        if (limitWords.test(rest.slice(0, match.index))) continue;

        let hour = Number(match[1]);
        const minute = pattern.hasMinutes ? Number(match[2]) : 0;
        const meridiem = (pattern.hasMinutes ? match[3] : match[2])?.toLowerCase();
        if (hour > 24 || minute > 59) continue;

        if (meridiem === 'pm' && hour < 12) hour += 12;
        if (meridiem === 'am' && hour === 12) hour = 0;

        if (pattern.bare && hour <= 12) {
            // A bare hour is ambiguous. 1-6 read as afternoon, which is how
            // people usually mean "at 6"; the rest stay as typed.
            if (hour >= 1 && hour <= 6) hour += 12;
            assumptions.push(`Read "${match[1]}" as ${String(hour).padStart(2, '0')}:00 — tap the time to change it`);
        }

        if (hour >= 24) continue;
        startTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
        matched.time = true;
        take(match[0]);
        break;
    }

    /* ------------------------------------------------------- part of the day */
    // "each morning", "every night", "in the evening": a time, and with
    // every/each, every day. Only a starting hour when none was given; never
    // the "night" in "late-night".
    const part = quit ? null : rest.match(new RegExp(String.raw`(?:^|[^\w-])((?:(every|each)\s+|in\s+the\s+|this\s+|(?=${TAKEN}))${TAKEN}?\s*(morning|afternoon|evening|night)s?)\b`, 'i'));
    if (part) {
        if (part[2]) matched.days = true;
        if (!startTime) {
            startTime = PART_HOURS[part[3].toLowerCase()];
            matched.time = true;
            assumptions.push(`Read "${part[3].toLowerCase()}" as ${startTime} — tap the time to change it`);
        }
        take(part[1]);
    }

    /* ----------------------------------------------------------------- name */
    let name = tidyName(tidyTaken(shielded.restore(rest)));
    if (/^(?:do|complete|perform|make|get|hit)$/i.test(name) && targetUnit && targetUnit !== 'min') name = `${name} ${targetUnit}`;
    name = name.replace(/^(spend)\s+(?!time\b|an?\b|the\b|my\b|more\b|quality\b)(?=\w+ing\b|outdoors\b|outside\b)/i, '$1 time ');

    // Several times a day is a count of times: "eight times a day" is 8.
    if (perDay && targetValue === undefined) { targetValue = perDay; targetUnit = 'times'; matched.target = true; }
    // A duration with no explicit count becomes the target, so "45 minutes"
    // tracks as 45 min rather than a yes/no tick.
    if (targetValue === undefined && durationMinutes !== undefined) {
        targetValue = durationMinutes;
        targetUnit = 'min';
    }
    // One of something is a yes or a no.
    if (targetValue === 1 && targetUnit !== 'min') { targetValue = undefined; targetUnit = undefined; }

    if (!matched.days) assumptions.push('No days found, so this repeats every day');

    return {
        name,
        taskDays,
        startTime,
        durationMinutes,
        targetValue,
        targetUnit,
        trackingMethod: targetValue !== undefined ? 'numeric' : 'boolean',
        endDate,
        startDate,
        recurrence,
        habitType: quit ? 'quit' : 'build',
        priority: urgency?.priority,
        difficulty: hardness?.difficulty,
        flexible: timing?.flexible,
        assumptions,
        matched,
    };
}

/** Shapes a parse result into the habit fields the store expects. */
export function parsedToHabit(parsed: ParsedHabit, startDate: string): Partial<Habit> {
    return {
        name: parsed.name,
        taskDays: parsed.taskDays,
        startTime: parsed.startTime,
        durationMinutes: parsed.durationMinutes,
        goalValue: parsed.targetValue ?? 1,
        unit: parsed.targetUnit ?? 'time',
        trackingMethod: parsed.trackingMethod,
        type: parsed.habitType ?? 'build',
        recurrence: parsed.recurrence ? serialiseRecurrence(parsed.recurrence) : undefined,
        frequency: parsed.recurrence?.kind === 'monthly' ? 'monthly' : 'daily',
        weekInterval: parsed.recurrence?.kind === 'weekly' ? parsed.recurrence.every : undefined,
        goalPeriod: 'daily',
        category: 'personal',
        icon: 'ellipse-outline',
        startDate: parsed.startDate ?? startDate,
        endDate: parsed.endDate,
        priority: parsed.priority,
        difficulty: parsed.difficulty,
        flexible: parsed.startTime && parsed.flexible !== undefined ? parsed.flexible : undefined,
        // Quick add never schedules a notification; reminders stay opt-in.
        reminders: [],
    };
}

/** One-line summary of what will be created, shown before saving. */
export function describeParsed(parsed: ParsedHabit): string {
    const parts: string[] = [];
    if (parsed.targetValue !== undefined) parts.push(`${parsed.targetValue} ${parsed.targetUnit}`);
    parts.push(parsed.taskDays.length === 0
        ? 'every day'
        : parsed.taskDays.map(day => day.charAt(0).toUpperCase() + day.slice(1)).join(', '));
    if (parsed.startTime) parts.push(`at ${parsed.startTime}`);
    return parts.join(' · ');
}
