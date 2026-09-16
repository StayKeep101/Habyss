import type { Habit } from './habitsSQLite';

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
    'pages', 'page', 'glasses', 'glass', 'reps', 'rep', 'sets', 'set',
    'times', 'time', 'steps', 'words', 'chapters', 'chapter', 'km', 'miles', 'mile',
];

const DURATION_UNITS = ['minutes', 'minute', 'mins', 'min', 'hours', 'hour', 'hrs', 'hr'];

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const clean = (value: string) => value.replace(/\s+/g, ' ').replace(/^[,\s./-]+|[,\s./-]+$/g, '').trim();

/** Capitalise the first letter only, so "gym" becomes "Gym" but "HIIT" survives. */
const tidyName = (value: string): string => {
    const trimmed = clean(value);
    if (!trimmed) return '';
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
};

export function parseHabitText(input: string): ParsedHabit {
    const assumptions: string[] = [];
    const matched = { days: false, time: false, duration: false, target: false };
    let rest = ` ${input} `;
    const strike = (pattern: RegExp) => { rest = rest.replace(pattern, ' '); };

    /* ----------------------------------------------------------------- days */
    let taskDays: string[] = [];

    if (/\b(every ?day|daily|each day)\b/i.test(rest)) {
        matched.days = true;
        strike(/\b(every ?day|daily|each day)\b/gi);
    } else if (/\bweek ?days?\b/i.test(rest)) {
        taskDays = [...WEEKDAYS];
        matched.days = true;
        strike(/\b(on )?week ?days?\b/gi);
    } else if (/\bweek ?ends?\b/i.test(rest)) {
        taskDays = [...WEEKEND];
        matched.days = true;
        strike(/\b(on )?week ?ends?\b/gi);
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
            strike(dayPattern);
            strike(/\b(on|every)\b/gi);
        }
    }

    /* ------------------------------------------------------------- duration */
    let durationMinutes: number | undefined;
    const durationMatch = rest.match(
        new RegExp(String.raw`\b(?:for\s+)?(\d{1,3})\s*(${DURATION_UNITS.join('|')})\b`, 'i'),
    );
    if (durationMatch) {
        const amount = Number(durationMatch[1]);
        durationMinutes = /^h/i.test(durationMatch[2]) ? amount * 60 : amount;
        matched.duration = true;
        strike(new RegExp(escapeRegex(durationMatch[0]), 'i'));
    }

    /* --------------------------------------------------------------- target */
    // Counted targets are taken before times so "10 pages" can never be read as
    // ten o'clock.
    let targetValue: number | undefined;
    let targetUnit: string | undefined;
    const countMatch = rest.match(
        new RegExp(String.raw`\b(\d{1,4})\s*(${COUNT_UNITS.join('|')})\b`, 'i'),
    );
    if (countMatch) {
        targetValue = Number(countMatch[1]);
        targetUnit = countMatch[2].toLowerCase();
        matched.target = true;
        strike(new RegExp(escapeRegex(countMatch[0]), 'i'));
    }

    /* ----------------------------------------------------------------- time */
    // Each pattern needs a real signal — "at", a colon, or am/pm — so a leftover
    // number never silently becomes a start time.
    let startTime: string | undefined;
    const timePatterns: { regex: RegExp; hasMinutes: boolean; bare?: boolean }[] = [
        { regex: /\bat\s+(\d{1,2})[:.](\d{2})\s*(am|pm)?\b/i, hasMinutes: true },
        { regex: /\b(\d{1,2})[:.](\d{2})\s*(am|pm)?\b/i, hasMinutes: true },
        { regex: /\bat\s+(\d{1,2})\s*(am|pm)\b/i, hasMinutes: false },
        { regex: /\b(\d{1,2})\s*(am|pm)\b/i, hasMinutes: false },
        { regex: /\bat\s+(\d{1,2})\b/i, hasMinutes: false, bare: true },
    ];

    for (const pattern of timePatterns) {
        const match = rest.match(pattern.regex);
        if (!match) continue;

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
        strike(new RegExp(escapeRegex(match[0]), 'i'));
        break;
    }

    /* ----------------------------------------------------------------- name */
    strike(/\b(a day|per day|each|every|of)\b/gi);
    const name = tidyName(rest);

    // A duration with no explicit count becomes the target, so "45 minutes"
    // tracks as 45 min rather than a yes/no tick.
    if (targetValue === undefined && durationMinutes !== undefined) {
        targetValue = durationMinutes;
        targetUnit = 'min';
    }

    if (!matched.days) assumptions.push('No days found, so this repeats every day');

    return {
        name,
        taskDays,
        startTime,
        durationMinutes,
        targetValue,
        targetUnit,
        trackingMethod: targetValue !== undefined ? 'numeric' : 'boolean',
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
        type: 'build',
        frequency: 'daily',
        goalPeriod: 'daily',
        category: 'personal',
        icon: 'ellipse-outline',
        startDate,
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
