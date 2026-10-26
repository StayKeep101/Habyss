/**
 * Goal parser.
 *
 * Turns a goal written in plain language into something calculable: a numeric
 * target, a unit, a time window and a direction. A goal that cannot be reduced
 * to those four things is not saved as a vague wish — the parser says which
 * field is missing and asks one specific question.
 *
 * This is deterministic and local, not a model call. The app's only AI is an
 * optional on-device 1B model behind a large download; a goal you cannot create
 * offline, or that parses differently each time, would be worse than none. The
 * contract below is the same either way, so a model could be swapped in later
 * for the free-text cases without changing any caller.
 */

export type GoalType = 'frequency' | 'volume' | 'limit' | 'target_value' | 'consistency' | 'peak';
/** `max`: the best single day, for goals reached in one go (lib/peakPlan.ts). */
export type Aggregation = 'count_days' | 'sum' | 'latest' | 'completion_rate' | 'max';
export type Direction = 'at_least' | 'at_most' | 'reach';

export type GoalWindow =
    | { kind: 'recurring'; period: 'day' | 'week' | 'month' }
    | { kind: 'fixed'; start: string; end: string };

/**
 * The three kinds of goal, and how each is measured.
 *
 * - number: reach an amount ("2000 calls by Dec 1"). What is left is spread over
 *   the days left, so a missed day raises the daily figure rather than being
 *   forgotten.
 * - complete: finish a project ("Launch Habyss by Jan 1"). Measured as its
 *   tasks done out of all its tasks.
 * - time: put in hours ("100 hours of piano"). A number goal counted in minutes.
 */
import { isPeakGoal, raceDistance } from './peakPlan';
import { findDate, findDeadline } from './dateWords';
import { NUMBER_WORD, toNumber } from './phrases';

export type GoalKind = 'number' | 'complete' | 'time';

export interface GoalSpec {
    /** Absent on goals made before kinds existed; see `goalKind`. */
    kind?: GoalKind;
    /** Shared cover photo URL; see lib/goalCover. */
    cover?: string;
    title: string;
    type: GoalType | null;
    metric_unit: string | null;
    aggregation: Aggregation | null;
    direction: Direction | null;
    target: number | null;
    baseline: number | null;
    /**
     * For "lose 5 kg": the amount to move from the baseline, since the target
     * weight is not known until the user says what they weigh now.
     */
    delta_from_baseline: number | null;
    window: GoalWindow | null;
    linked_habits: string[];
    suggested_habit: { name: string; unit: string } | null;
}

export interface GoalParseResult {
    status: 'complete' | 'needs_clarification';
    goal: GoalSpec;
    missing_fields: string[];
    clarifying_question: string | null;
}

export interface HabitRef { id: string; name: string; unit?: string }

export interface ParseOptions {
    today: Date;
    habits?: HabitRef[];
}

export const ALLOWED_UNITS = [
    'sessions', 'minutes', 'hours', 'pages', 'km', 'mi', 'steps',
    'm', 'ml', 'books', 'chapters', 'sets', 'laps', 'lessons', 'tasks', 'projects',
    'kg', 'lb', 'glasses', 'liters', 'dollars', 'euros', 'gbp', 'words', 'reps', 'percent',
] as const;

/** Spoken unit -> allowed unit, with a multiplier where the unit changes. */
const UNIT_MAP: { pattern: RegExp; unit: string; factor?: number }[] = [
    { pattern: /\b(hours?|hrs?|h)\b/i, unit: 'minutes', factor: 60 },
    { pattern: /\b(minutes?|mins?)\b/i, unit: 'minutes' },
    { pattern: /\b(books?)\b/i, unit: 'books' },
    { pattern: /\b(chapters?)\b/i, unit: 'chapters' },
    { pattern: /\b(sets?)\b/i, unit: 'sets' },
    { pattern: /\b(laps?)\b/i, unit: 'laps' },
    { pattern: /\b(lessons?)\b/i, unit: 'lessons' },
    { pattern: /\b(tasks?)\b/i, unit: 'tasks' },
    { pattern: /\b(projects?)\b/i, unit: 'projects' },
    { pattern: /\b(meters?|metres?|m)\b/i, unit: 'm' },
    { pattern: /\b(milliliters?|millilitres?|ml)\b/i, unit: 'ml' },
    { pattern: /\b(euros?|eur)\b/i, unit: 'euros' },
    { pattern: /\b(gbp)\b/i, unit: 'gbp' },
    { pattern: /\b(pages?|pgs?)\b/i, unit: 'pages' },
    { pattern: /\b(kilometers?|kilometres?|kms?|km)\b/i, unit: 'km' },
    { pattern: /\b(miles?|mi)\b/i, unit: 'mi' },
    { pattern: /\b(steps?)\b/i, unit: 'steps' },
    { pattern: /\b(kilos?|kilograms?|kgs?|kg)\b/i, unit: 'kg' },
    { pattern: /\b(pounds?|lbs?|lb)\b/i, unit: 'lb' },
    { pattern: /\b(glasses|glass)\b/i, unit: 'glasses' },
    { pattern: /\b(liters?|litres?|l)\b/i, unit: 'liters' },
    { pattern: /\b(dollars?|usd|bucks?)\b/i, unit: 'dollars' },
    { pattern: /\b(words?)\b/i, unit: 'words' },
    { pattern: /\b(reps?|repetitions?)\b/i, unit: 'reps' },
    { pattern: /\b(percent|%)\b/i, unit: 'percent' },
    { pattern: /\b(sessions?|times?|workouts?|x)\b/i, unit: 'sessions' },
];

/** Units that measure a body/state value rather than accumulated effort. */
const MEASUREMENT_UNITS = ['kg', 'lb'];

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july',
    'august', 'september', 'october', 'november', 'december'];

/** Contexts where "5k" means five kilometres rather than five thousand. */
const DISTANCE_CONTEXT = /\b(run|running|ran|jog|jogging|walk|walking|cycle|cycling|ride|riding|swim|swimming|marathon|race)\b/i;

/**
 * Expands "10k" to 10000, except where the sentence is about distance.
 *
 * "Make 10k dollars" is ten thousand; "run a 5k" is five kilometres. Guessing
 * wrong either way produces a target that is off by a factor of a thousand, so
 * the surrounding words decide.
 */
function expandThousands(text: string): string {
    if (!/\b\d+(?:\.\d+)?k\b/i.test(text)) return text;
    if (DISTANCE_CONTEXT.test(text)) {
        return text.replace(/\b(\d+(?:\.\d+)?)k\b/gi, '$1 km');
    }
    return text.replace(/\b(\d+(?:\.\d+)?)k\b/gi, (_match, amount) => String(Math.round(Number(amount) * 1000)));
}

const VAGUE = /\b(get (fit|healthy|in shape|better)|be healthier|read more|exercise more|do more|eat better|sleep better|lose weight|get strong(er)?|be more productive)\b/i;

const dateKey = (date: Date): string =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const endOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0);
const addDays = (date: Date, days: number) => {
    const next = new Date(date);
    next.setDate(date.getDate() + days);
    return next;
};

const titleCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

/** Words that never belong in a goal's subject. */
const STOP_WORDS = new Set([
    'i', 'want', 'to', 'a', 'an', 'the', 'my', 'me', 'of', 'on', 'in', 'at', 'for',
    'this', 'that', 'per', 'each', 'every', 'and', 'get', 'down', 'do', 'go', 'goal',
    'more', 'than', 'no', 'less', 'under', 'max', 'maximum', 'least', 'most', 'by',
    'days', 'day', 'week', 'weeks', 'month', 'months', 'year', 'years', 'time', 'times',
    'next', 'want', 'like', 'would',
]);

/** Unit words, which belong in the target rather than the subject. */
const UNIT_WORDS = new Set([
    'hour', 'hours', 'hr', 'hrs', 'minute', 'minutes', 'min', 'mins',
    'page', 'pages', 'pg', 'pgs', 'kilometer', 'kilometers', 'kilometre', 'kilometres',
    'km', 'kms', 'mile', 'miles', 'mi', 'step', 'steps', 'kilo', 'kilos',
    'kilogram', 'kilograms', 'kg', 'kgs', 'pound', 'pounds', 'lb', 'lbs',
    'glass', 'glasses', 'liter', 'liters', 'litre', 'litres', 'l',
    'dollar', 'dollars', 'usd', 'buck', 'bucks', 'word', 'words',
    'rep', 'reps', 'repetition', 'repetitions', 'percent', 'session', 'sessions',
    'workout', 'workouts', 'x',
    'm', 'meter', 'meters', 'metre', 'metres', 'ml', 'milliliter', 'milliliters',
    'millilitre', 'millilitres', 'book', 'books', 'chapter', 'chapters', 'set', 'sets',
    'lap', 'laps', 'lesson', 'lessons', 'task', 'tasks', 'project', 'projects', 'euro', 'euros', 'eur', 'gbp',
]);

/**
 * What the goal is about, with the measurable parts taken out.
 *
 * The amount, its unit and the period all appear elsewhere in the title, so
 * leaving them here produced titles like "Save dollars 3000 dollars in
 * September". Anything numeric or unit-shaped is dropped.
 */
const subjectFrom = (text: string): string => {
    const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
    const kept = words.filter(word =>
        !STOP_WORDS.has(word)
        && !UNIT_WORDS.has(word)
        && !/^\d+(?:\.\d+)?$/.test(word));
    return kept.join(' ').trim();
};

/** Matches a goal to existing habits by meaning, requiring a compatible unit. */
function linkHabits(subject: string, unit: string | null, habits: HabitRef[]): string[] {
    if (!subject || habits.length === 0) return [];
    const subjectWords = subject.split(/\s+/).filter(word => word.length > 2);
    const stems = subjectWords.map(word => word.replace(/(ing|s)$/, ''));

    return habits.filter(habit => {
        if (unit && habit.unit && habit.unit !== unit) return false;
        const haystack = habit.name.toLowerCase();
        return stems.some(stem => stem.length > 2 && haystack.includes(stem));
    }).map(habit => habit.id);
}

const SPAN_NUMBERS: Record<string, number> = {
    a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12,
};
/** Month (0-based) and day each season starts, in the northern hemisphere. */
const SEASON_STARTS: Record<string, [number, number]> = { spring: [2, 20], summer: [5, 21], fall: [8, 22], autumn: [8, 22], winter: [11, 21] };

export function parseGoalText(input: string, options: ParseOptions): GoalParseResult {
    const { today, habits = [] } = options;
    const raw = (input ?? '').trim();
    // "50km" has no word boundary between the digit and the unit, so \bkm\b
    // would never match. Splitting them first keeps every unit pattern simple.
    // Expand "10k" before splitting digits from letters, which would otherwise
    // turn it into "10 k" and leave the k stranded.
    // "50,000 words" is fifty thousand, not 0.
    const lowered = raw.toLowerCase()
        .replace(/(\d),(?=\d{3}\b)/g, '$1')
        .replace(/(\d+(?:\.\d+)?)\s*million\b/g, (_all, amount: string) => String(Math.round(Number(amount) * 1_000_000)))
        // "five meaningful friendships", "three languages": numbers, for reading only.
        .replace(new RegExp(`\\b(${NUMBER_WORD})\\b`, 'gi'), word => String(toNumber(word) ?? word))
        // "before age 30" is when, not how much.
        .replace(/\b(?:before|by|until|at)\s+(?:the\s+)?age\s+(?:of\s+)?\d{1,3}\b/g, ' ');
    // "100-day streak", "30-day challenge", "1,000 consecutive days": every day, that many days.
    const streak = lowered.match(/\b(\d{1,4})[- ]days?\s+(?:[a-z]+\s+)?(?:streak|challenge|run)\b|\b(\d{1,4})\s+(?:consecutive|straight)\s+days\b|\b(\d{1,4})\s+days\s+in\s+a\s+row\b/);
    const text = ` ${expandThousands(lowered
        // "a 12-week bootcamp", "a six-month safety net": a length, not an amount.
        .replace(/\b\d+-(?:day|week|month|year|hour|minute)\b/g, ' '))
        .replace(/(\d)\s*([a-z])/g, '$1 $2')} `;

    const missing: string[] = [];
    const spec: GoalSpec = {
        title: raw ? titleCase(raw) : '',
        type: null, metric_unit: null, aggregation: null, direction: null,
        target: null, baseline: null, delta_from_baseline: null,
        window: null, linked_habits: [], suggested_habit: null,
    };

    const incomplete = (question: string | null): GoalParseResult => ({
        status: 'needs_clarification', goal: spec, missing_fields: missing, clarifying_question: question,
    });

    if (!raw) {
        missing.push('target', 'metric_unit', 'window');
        return incomplete('What would you like to achieve? For example: run 50 km this month, or meditate 5 times a week.');
    }

    /* ------------------------------------------------------------- direction */
    const isLimit = /\b(no more than|less than|under|at most|max|maximum|limit)\b/i.test(text) && raceDistance(text) === null;
    const isTargetValue = /\b(get down to|down to|get to|reach|weigh|hit)\b/i.test(text)
        || MEASUREMENT_UNITS.some(unit => new RegExp(`\\b${unit}\\b`).test(text));

    /* ------------------------------------------------------------------ unit */
    let unit: string | null = null;
    let unitFactor = 1;
    for (const candidate of UNIT_MAP) {
        if (candidate.pattern.test(text)) {
            unit = candidate.unit;
            unitFactor = candidate.factor ?? 1;
            break;
        }
    }

    /* ---------------------------------------------------------------- window */
    let window: GoalWindow | null = null;
    // The words that set the date, removed before reading the amount and the
    // subject: otherwise "by January 1, 2027" made the target 1 and put
    // "january" into the title.
    let datePhrase = '';
    // A span: "for 365 days", "for a year", "over the next 3 months", "within 6
    // weeks", "during the next 30 days". It runs from today to that far ahead
    // (365 days later is the end). "for/during/over" means doing it through the
    // span; "in/within" is a deadline.
    const spanMatch = text.match(new RegExp(String.raw`\b(for|over|during|within|in)\s+(?:the\s+)?(?:next\s+|coming\s+|following\s+|whole\s+|full\s+|entire\s+)?(${Object.keys(SPAN_NUMBERS).join('|')}|\d{1,4})\s*(days?|weeks?|months?|years?)\b`, 'i'));
    let span: { days: number; through: boolean } | null = null;
    if (spanMatch) {
        const amount = SPAN_NUMBERS[spanMatch[2].toLowerCase()] ?? Number(spanMatch[2]);
        const unitWord = spanMatch[3].toLowerCase();
        const end = new Date(today);
        if (unitWord.startsWith('day')) end.setDate(end.getDate() + amount);
        else if (unitWord.startsWith('week')) end.setDate(end.getDate() + amount * 7);
        else if (unitWord.startsWith('month')) end.setMonth(end.getMonth() + amount);
        else end.setFullYear(end.getFullYear() + amount);
        if (amount > 0 && amount <= 5000) {
            span = { days: Math.round((end.getTime() - today.getTime()) / 86400000), through: !/^(in|within)$/i.test(spanMatch[1]) };
            window = { kind: 'fixed', start: dateKey(today), end: dateKey(end) };
            datePhrase = spanMatch[0];
        }
    }
    // "every day this year", "daily this month": doing it through the rest of it.
    const throughRest = !window && /\b(a|per|each|every)\s*day\b|\bdaily\b/i.test(text)
        ? text.match(/\b(?:(?:for\s+|through\s+|until\s+the\s+end\s+of\s+)?(?:the\s+rest\s+of\s+)?)(this|next)\s+(week|month|year)\b/i) : null;
    if (throughRest) {
        const next = throughRest[1].toLowerCase() === 'next';
        const part = throughRest[2].toLowerCase();
        let start = new Date(today);
        let end: Date;
        if (part === 'year') { if (next) start = new Date(today.getFullYear() + 1, 0, 1); end = new Date(start.getFullYear(), 11, 31); }
        else if (part === 'month') { if (next) start = new Date(today.getFullYear(), today.getMonth() + 1, 1); end = endOfMonth(start); }
        else { if (next) start = addDays(today, 7 - today.getDay()); end = addDays(start, 6 - start.getDay()); }
        window = { kind: 'fixed', start: dateKey(start), end: dateKey(end) };
        span = { days: Math.round((end.getTime() - start.getTime()) / 86400000) + 1, through: true };
        datePhrase = throughRest[0];
    }
    // "before summer", "by winter": the season's first day, the next one to come.
    const season = !window ? text.match(/\b(?:by|before|until)\s+(?:the\s+)?(?:start\s+of\s+)?(spring|summer|fall|autumn|winter)\b/i) : null;
    if (season) {
        const [month, day] = SEASON_STARTS[season[1].toLowerCase()];
        let end = new Date(today.getFullYear(), month, day);
        if (dateKey(end) <= dateKey(today)) end = new Date(today.getFullYear() + 1, month, day);
        window = { kind: 'fixed', start: dateKey(today), end: dateKey(end) };
        datePhrase = season[0];
    }
    // "monthly revenue", "weekly review" describe; "every month", "monthly" at the end set the rhythm.
    const rhythm: 'day' | 'week' | 'month' | null = /\b(a|per|each|every)\s*(?:day|night)\b|\bdaily\b(?!\s+(?!for\b|until\b|by\b|this\b|in\b|on\b)[a-z])/i.test(text) ? 'day'
        : /\b(a|per|each|every)\s*week\b|\bweekly\b(?!\s+(?!for\b|until\b|by\b|this\b|in\b|on\b)[a-z])/i.test(text) ? 'week'
        : /\b(a|per|each|every)\s*month\b|\bmonthly\b(?!\s+(?!for\b|until\b|by\b|this\b|in\b|on\b)[a-z])/i.test(text) ? 'month' : null;
    const relative = window ? null : text.match(/\b(?:(?:a|per|each|every)\s*(?:day|night|week|month)|(?:daily|weekly|monthly)(?!\s+(?!for\b|until\b|by\b|this\b|in\b|on\b)[a-z])|(?:by\s+|before\s+|until\s+)?(?:the\s+end\s+of\s+)?(?:this|next)\s+(?:week|month|year))\b/i);
    if (relative) datePhrase = relative[0];
    if (window) { /* a span or a season, read above */ }
    else if (rhythm === 'day') window = { kind: 'recurring', period: 'day' };
    else if (rhythm === 'week') window = { kind: 'recurring', period: 'week' };
    else if (rhythm === 'month') window = { kind: 'recurring', period: 'month' };
    else if (/\bthis month\b/i.test(text)) window = { kind: 'fixed', start: dateKey(today), end: dateKey(endOfMonth(today)) };
    else if (/\bthis week\b/i.test(text)) window = { kind: 'fixed', start: dateKey(today), end: dateKey(addDays(today, 6 - today.getDay())) };
    else if (/\bthis year\b/i.test(text)) window = { kind: 'fixed', start: dateKey(today), end: `${today.getFullYear()}-12-31` };
    // "next month" runs over that month, so it starts then rather than today.
    else if (/\bnext month\b/i.test(text)) {
        const first = new Date(today.getFullYear(), today.getMonth() + 1, 1);
        window = { kind: 'fixed', start: dateKey(first), end: dateKey(endOfMonth(first)) };
    }
    else if (/\bnext week\b/i.test(text)) {
        const first = addDays(today, 7 - today.getDay());
        window = { kind: 'fixed', start: dateKey(first), end: dateKey(addDays(first, 6)) };
    }
    else if (/\bnext year\b/i.test(text)) {
        window = { kind: 'fixed', start: `${today.getFullYear() + 1}-01-01`, end: `${today.getFullYear() + 1}-12-31` };
    }
    else {
        const inDays = text.match(/\bin\s+(\d{1,3})\s*days?\b/i);
        const byChristmas = text.match(/\b(by\s+)?(christmas|xmas)\b/i);
        const isoDate = text.match(/\b(?:by|before|until|on)\s+(\d{4})-(\d{2})-(\d{2})\b/i);
        // "by january 1", "by jan 1 st, 2027", "before march 2027"
        const byMonthDay = text.match(new RegExp(
            `\\b(?:by|before|until|on)\\s+(${MONTHS.join('|')}|${MONTHS.map(m => m.slice(0, 3)).join('|')})\\.?`
            + `(?:\\s*(\\d{1,2})(?!\\d)(?:\\s*(?:st|nd|rd|th)\\b)?)?(?:\\s*,?\\s*(\\d{4}))?\\b`, 'i'));

        if (inDays) {
            window = { kind: 'fixed', start: dateKey(today), end: dateKey(addDays(today, Number(inDays[1]))) };
            datePhrase = inDays[0];
        } else if (byChristmas) {
            const year = today.getMonth() === 11 && today.getDate() > 25 ? today.getFullYear() + 1 : today.getFullYear();
            window = { kind: 'fixed', start: dateKey(today), end: `${year}-12-25` };
            datePhrase = byChristmas[0];
        } else if (isoDate) {
            const end = new Date(Number(isoDate[1]), Number(isoDate[2]) - 1, Number(isoDate[3]));
            if (dateKey(end) === `${isoDate[1]}-${isoDate[2]}-${isoDate[3]}`) {
                window = { kind: 'fixed', start: dateKey(today), end: dateKey(end) };
                datePhrase = isoDate[0];
            }
        } else if (byMonthDay) {
            const name = byMonthDay[1].toLowerCase();
            const monthIndex = MONTHS.findIndex(month => month.startsWith(name.slice(0, 3)));
            if (monthIndex >= 0) {
                const day = byMonthDay[2] ? Number(byMonthDay[2]) : undefined;
                const year = byMonthDay[3]
                    ? Number(byMonthDay[3])
                    : monthIndex < today.getMonth() ? today.getFullYear() + 1 : today.getFullYear();
                const end = day
                    ? new Date(year, monthIndex, day)
                    : endOfMonth(new Date(year, monthIndex, 1));
                window = { kind: 'fixed', start: dateKey(today), end: dateKey(end) };
                datePhrase = byMonthDay[0];
            }
        }
    }

    // Any other deadline: "due by Friday", "by the end of the month", "in 3
    // months", "before 12/5", "deadline next week".
    if (!window) {
        const due = findDeadline(text, today) ?? (() => {
            const inSpan = text.match(/\bin\s+(?:a|an|one|two|three|four|\d{1,3})\s*(?:weeks?|months?)\b/i);
            const date = inSpan ? findDate(inSpan[0], today) : null;
            return date ? { date: date.date, phrase: inSpan![0] } : null;
        })();
        if (due && due.date > dateKey(today)) {
            window = { kind: 'fixed', start: dateKey(today), end: due.date };
            datePhrase = due.phrase;
        }
    }

    const body = datePhrase ? text.replace(datePhrase, ' ') : text;

    /* ---------------------------------------------------------------- amount */
    // "3x a week" and "3 times a week" both give 3 sessions.
    const frequencyMatch = body.match(/\b(\d{1,3})\s*(x|times?)\b/i);
    const percentMatch = body.match(/\b(\d{1,3})\s*%|\b(\d{1,3})\s*percent\b/i);
    const amountMatch = body.match(/\b(\d+(?:\.\d+)?)\s*(hours?|hrs?|minutes?|mins?|pages?|kilometers?|kilometres?|kms?|km|miles?|mi|steps?|kilos?|kilograms?|kgs?|kg|pounds?|lbs?|lb|glasses|glass|liters?|litres?|dollars?|words?|reps?)\b/i);

    let target: number | null = null;
    // "$5,000", "€200": money is counted in its currency.
    const money = body.match(/([$€£])\s*(\d+(?:\.\d+)?)/);
    // "a half marathon" is 21.1 km.
    const race = raceDistance(text);
    // "Complete a marathon in under 4 hours": finishing is the goal; the time is how.
    const finishTime = race !== null && /\b(?:in\s+)?under\b|\bsub-?\s?\d/.test(text);
    if (race !== null && !amountMatch && !finishTime) { unit = 'km'; unitFactor = 1; }
    if (finishTime) {
        target = null;
        unit = null;
    } else if (race !== null && !amountMatch) {
        target = race;
    } else if (money && !amountMatch) {
        target = Number(money[2]);
        unit = money[1] === '$' ? 'dollars' : money[1] === '€' ? 'euros' : 'GBP';
    } else if (percentMatch) {
        target = Number(percentMatch[1] ?? percentMatch[2]) / 100;
    } else if (amountMatch) {
        target = Number(amountMatch[1]) * unitFactor;
    } else if (frequencyMatch) {
        target = Number(frequencyMatch[1]);
    } else {
        const bare = body.match(/\b(\d+(?:\.\d+)?)\b/);
        if (bare) target = Number(bare[1]);
        // What is counted: the noun after the number, past the words describing
        // it ("100 paying customers", "50 educational YouTube videos", "a 3.8 GPA").
        if (bare && !unit) {
            const after = body.slice((bare.index ?? 0) + bare[0].length).trim().split(/\s+/);
            // "a 10-song album" counts songs.
            const joined = after[0]?.match(/^-([a-z]+)$/);
            const stop = after.findIndex(word => /^(for|to|from|with|in|on|at|by|through|via|of|that|who|which|per|a|an|the|and|this|next|before|after|until|every|each|while|learn|get|become|reach)$/.test(word));
            const nouns = (stop === -1 ? after : after.slice(0, stop)).slice(0, 4).filter(word => /^[a-z][a-z'-]*$/.test(word));
            // The first plural ("20 people learn…", "50 educational YouTube videos"), else the last word.
            const noun = joined ? `${joined[1]}s` : nouns.find(word => /^(people|children|men|women|kids)$/.test(word) || (/s$/.test(word) && !/ss$/.test(word))) ?? nouns[nouns.length - 1];
            if (noun && !/^(days?|weeks?|months?|years?|times?|x|percent)$/.test(noun)) unit = noun.replace(/[^a-z-]/g, '');
        }
    }
    // A level you check rather than add up: a GPA, a score, a net worth, a weight.
    const level = /\b(gpa|grade|score|net worth|heart rate|resting|weight|rating|rank|level|salary|balance)\b/i.test(text) && target !== null;

    /* ------------------------------------------------------------------ type */
    const isConsistency = !!percentMatch && /\bdays?\b/i.test(text);

    if (isConsistency) {
        spec.type = 'consistency';
        spec.aggregation = 'completion_rate';
        spec.direction = 'at_least';
        unit = 'percent';
    } else if (isLimit) {
        spec.type = 'limit';
        spec.aggregation = 'sum';
        spec.direction = 'at_most';
    } else if (target !== null && isPeakGoal(text, unit, window?.kind === 'recurring')) {
        // Reached in one go: the best single effort counts, not the sum, and
        // the app plans the build-up from where you are now.
        spec.type = 'peak';
        spec.aggregation = 'max';
        spec.direction = 'reach';
    } else if ((isTargetValue || /\b(lose|losing|drop|shed|gain|gaining|put on)\b/i.test(text)) && unit && MEASUREMENT_UNITS.includes(unit)) {
        spec.type = 'target_value';
        spec.aggregation = 'latest';
        spec.direction = 'reach';

        // "Lose 5 kg" names how far to move, not where to land. The target is
        // only knowable once the user says what they weigh now, so the amount is
        // kept as a delta and the target stays null rather than claiming 5 kg is
        // the goal weight.
        if (/\b(lose|losing|drop|shed|cut)\b/i.test(text) && target !== null) {
            spec.delta_from_baseline = target;
            target = null;
        } else if (/\b(gain|gaining|put on|add)\b/i.test(text) && target !== null) {
            // "Gain 5 kg": five more than now, which is the start weight less minus five.
            spec.delta_from_baseline = -target;
            target = null;
        }
    } else if (level) {
        spec.type = 'target_value';
        spec.aggregation = 'latest';
        spec.direction = 'reach';
    } else if (frequencyMatch || (unit === 'sessions' && target !== null)) {
        spec.type = 'frequency';
        spec.aggregation = 'count_days';
        spec.direction = 'at_least';
        unit = 'sessions';
    } else {
        spec.type = 'volume';
        spec.aggregation = 'sum';
        spec.direction = 'at_least';
    }

    // A streak or a challenge: every day, that many days, from today.
    if (streak) {
        const days = Number(streak[1] ?? streak[2] ?? streak[3]);
        if (days > 0 && days <= 5000) {
            spec.type = 'frequency'; spec.aggregation = 'count_days'; spec.direction = 'at_least';
            unit = 'days'; target = days;
            if (!window) window = { kind: 'fixed', start: dateKey(today), end: dateKey(addDays(today, days - 1)) };
        }
    }

    // Doing it through a span: "journal for 365 days", "meditate daily for 30
    // days", "no sugar for 2 weeks" count the days it is done, out of the span;
    // "gym 3 times a week for 6 months" counts sessions, 3 for every week.
    if (span && spec.type !== 'limit' && spec.type !== 'target_value' && spec.type !== 'peak' && !percentMatch) {
        const perPeriod = frequencyMatch ? Number(frequencyMatch[1]) : null;
        if (rhythm === 'week' && perPeriod) {
            spec.type = 'frequency'; spec.aggregation = 'count_days'; spec.direction = 'at_least';
            unit = 'sessions'; target = perPeriod * Math.max(1, Math.round(span.days / 7));
        } else if (rhythm === 'month' && perPeriod) {
            spec.type = 'frequency'; spec.aggregation = 'count_days'; spec.direction = 'at_least';
            unit = 'sessions'; target = perPeriod * Math.max(1, Math.round(span.days / 30));
        } else if (rhythm === 'day' || (span.through && !amountMatch && !frequencyMatch && race === null)) {
            spec.type = 'frequency'; spec.aggregation = 'count_days'; spec.direction = 'at_least';
            unit = 'days'; target = span.days;
        }
    }

    // "Score 90%", "Automate 80% of my work": counted in percent.
    if (percentMatch && !unit && target !== null) unit = 'percent';

    spec.metric_unit = unit;
    spec.target = target;
    spec.window = window;

    /* -------------------------------------------------------- subject + links */
    const subject = subjectFrom(body);
    spec.linked_habits = linkHabits(subject, unit, habits);
    if (spec.linked_habits.length === 0 && subject && unit) {
        spec.suggested_habit = { name: titleCase(subject), unit };
    }

    /* ----------------------------------------------------------------- title */
    spec.title = buildTitle(raw, spec, subject, today, datePhrase);
    // "Go to the gym 3 times a week for 6 months": the rhythm is the goal's
    // wording, the span its dates; the session total is worked out, not named.
    if (span && unit === 'sessions' && rhythm && datePhrase) {
        spec.title = titleCase(raw.replace(new RegExp(datePhrase.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), ' ').replace(/\s{2,}/g, ' ').trim());
    }

    /* --------------------------------------------------- what is still needed */
    // A vague goal never produces a target the user did not state.
    if (VAGUE.test(text) && target === null) {
        spec.target = null;
        spec.metric_unit = null;
        spec.window = null;
        spec.suggested_habit = null;
        spec.title = titleCase(raw);
        missing.push('target', 'metric_unit', 'window');
        return incomplete('How do you want to measure it? For example: 20 pages a day, 30 minutes a day, or 4 reading sessions a week.');
    }

    if (spec.type === 'target_value' && spec.baseline === null) missing.push('baseline');
    // A delta goal already knows the amount; what it lacks is the baseline.
    if (spec.target === null && spec.delta_from_baseline === null) missing.push('target');
    if (!spec.metric_unit) missing.push('metric_unit');
    if (!spec.window) missing.push('window');

    if (missing.length === 0) {
        return { status: 'complete', goal: spec, missing_fields: [], clarifying_question: null };
    }

    // One question, about the most important missing field.
    const order = ['target', 'metric_unit', 'window', 'baseline'];
    const first = order.find(field => missing.includes(field)) ?? missing[0];
    return incomplete(questionFor(first, spec));
}

function questionFor(field: string, spec: GoalSpec): string {
    switch (field) {
        case 'baseline': {
            const where = spec.metric_unit === 'lb' ? 'weight in lb' : `${spec.metric_unit}`;
            if (spec.delta_from_baseline !== null) {
                return `What's your current ${where}? I'll set the target ${spec.delta_from_baseline} ${spec.metric_unit} below it.`;
            }
            return `What's your current ${where}? I need it to track your progress toward ${spec.target}${spec.metric_unit ? ` ${spec.metric_unit}` : ''}.`;
        }
        case 'target':
            return 'How much are you aiming for? Give me a number, for example 50 km, 300 pages, or 3 sessions.';
        case 'metric_unit':
            return 'What should I count? For example minutes, pages, km or sessions.';
        case 'window':
        default:
            return 'Over what period? For example each day, each week, this month, or by a specific date.';
    }
}

function buildTitle(raw: string, spec: GoalSpec, subject: string, today: Date, datePhrase = ''): string {
    // "Launch Habyss by Jan 1" is a deadline and a name, and the deadline has
    // already been read off. Leaving it in the title as well meant the goal was
    // called after the date it was due.
    const withoutDate = datePhrase
        ? raw.replace(new RegExp(datePhrase.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), ' ')
            .replace(/\s{2,}/g, ' ').trim()
        : raw;

    const name = subject ? titleCase(subject) : titleCase(withoutDate);
    if (spec.delta_from_baseline === null && (spec.target === null || !spec.metric_unit)) {
        return titleCase(withoutDate);
    }
    // Your own words when they already hold the amount: "Run a 5 km without
    // stopping" stays that, not "Run without stopping 5 km".
    // "10k" as 10000 (or "5K" run as 5 km), and a unit spaced from its number.
    const ownWords = expandThousands(withoutDate).replace(/(\d)(km|kms|kg|kgs|lbs?|mi|miles?|min|mins|hrs?|hours?|pages?)\b/gi, '$1 $2').replace(/\s{2,}/g, ' ').trim();
    // Any number in them at all ("100 hours", "five friendships", "1 million").
    if (/\d/.test(ownWords) || new RegExp(`\\b(${NUMBER_WORD})\\b`, 'i').test(ownWords)) {
        return titleCase(ownWords.replace(/\s+(?:every|each|per|a)\s+(?:day|night|week|month)$/i, ''));
    }
    // Days out of a span: the name is what is done ("Write a personal journal").
    if (spec.metric_unit === 'days') {
        return titleCase(withoutDate.replace(/\b(every ?day|daily|each day|a day|per day)\b/gi, ' ').replace(/\s{2,}/g, ' ').trim());
    }

    const amount = spec.metric_unit === 'percent'
        ? `${Math.round((spec.target ?? 0) * 100)}%`
        : `${spec.target} ${spec.metric_unit}`;

    // The deadline and the rhythm are the goal's settings, shown beside it;
    // the title is only what it is ("Read 24 books", not "… by December 31").
    void today;
    const when = '';

    if (spec.type === 'limit') return `Max ${amount} of ${name}${when}`;
    if (spec.type === 'target_value') {
        if (spec.delta_from_baseline !== null) {
            return `Lose ${spec.delta_from_baseline} ${spec.metric_unit}${when}`;
        }
        return `Reach ${amount}${when}`;
    }
    if (spec.type === 'consistency') return `${name} ${amount} of days${when}`;
    return `${name} ${amount}${when}`;
}
