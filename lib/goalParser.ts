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

export type GoalType = 'frequency' | 'volume' | 'limit' | 'target_value' | 'consistency';
export type Aggregation = 'count_days' | 'sum' | 'latest' | 'completion_rate';
export type Direction = 'at_least' | 'at_most' | 'reach';

export type GoalWindow =
    | { kind: 'recurring'; period: 'day' | 'week' | 'month' }
    | { kind: 'fixed'; start: string; end: string };

export interface GoalSpec {
    title: string;
    type: GoalType | null;
    metric_unit: string | null;
    aggregation: Aggregation | null;
    direction: Direction | null;
    target: number | null;
    baseline: number | null;
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
    'kg', 'lb', 'glasses', 'liters', 'dollars', 'words', 'reps', 'percent',
] as const;

/** Spoken unit -> allowed unit, with a multiplier where the unit changes. */
const UNIT_MAP: { pattern: RegExp; unit: string; factor?: number }[] = [
    { pattern: /\b(hours?|hrs?|h)\b/i, unit: 'minutes', factor: 60 },
    { pattern: /\b(minutes?|mins?)\b/i, unit: 'minutes' },
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
]);

const subjectFrom = (text: string): string => {
    const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
    const kept = words.filter(word => !STOP_WORDS.has(word) && !/^\d+$/.test(word));
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

export function parseGoalText(input: string, options: ParseOptions): GoalParseResult {
    const { today, habits = [] } = options;
    const raw = (input ?? '').trim();
    // "50km" has no word boundary between the digit and the unit, so \bkm\b
    // would never match. Splitting them first keeps every unit pattern simple.
    const text = ` ${raw.toLowerCase().replace(/(\d)\s*([a-z])/g, '$1 $2')} `;

    const missing: string[] = [];
    const spec: GoalSpec = {
        title: raw ? titleCase(raw) : '',
        type: null, metric_unit: null, aggregation: null, direction: null,
        target: null, baseline: null, window: null, linked_habits: [], suggested_habit: null,
    };

    const incomplete = (question: string | null): GoalParseResult => ({
        status: 'needs_clarification', goal: spec, missing_fields: missing, clarifying_question: question,
    });

    if (!raw) {
        missing.push('target', 'metric_unit', 'window');
        return incomplete('What would you like to achieve? For example: run 50 km this month, or meditate 5 times a week.');
    }

    /* ------------------------------------------------------------- direction */
    const isLimit = /\b(no more than|less than|under|at most|max|maximum|limit)\b/i.test(text);
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
    if (/\b(a|per|each|every)\s*day\b|\bdaily\b/i.test(text)) window = { kind: 'recurring', period: 'day' };
    else if (/\b(a|per|each|every)\s*week\b|\bweekly\b/i.test(text)) window = { kind: 'recurring', period: 'week' };
    else if (/\b(a|per|each|every)\s*month\b|\bmonthly\b/i.test(text)) window = { kind: 'recurring', period: 'month' };
    else if (/\bthis month\b/i.test(text)) window = { kind: 'fixed', start: dateKey(today), end: dateKey(endOfMonth(today)) };
    else if (/\bthis week\b/i.test(text)) window = { kind: 'fixed', start: dateKey(today), end: dateKey(addDays(today, 6 - today.getDay())) };
    else if (/\bthis year\b/i.test(text)) window = { kind: 'fixed', start: dateKey(today), end: `${today.getFullYear()}-12-31` };
    else {
        const inDays = text.match(/\bin\s+(\d{1,3})\s*days?\b/i);
        const byChristmas = /\b(christmas|xmas)\b/i.test(text);
        const byMonthDay = text.match(new RegExp(`\\bby\\s+(${MONTHS.join('|')}|${MONTHS.map(m => m.slice(0, 3)).join('|')})\\.?\\s*(\\d{1,2})?\\b`, 'i'));

        if (inDays) {
            window = { kind: 'fixed', start: dateKey(today), end: dateKey(addDays(today, Number(inDays[1]))) };
        } else if (byChristmas) {
            const year = today.getMonth() === 11 && today.getDate() > 25 ? today.getFullYear() + 1 : today.getFullYear();
            window = { kind: 'fixed', start: dateKey(today), end: `${year}-12-25` };
        } else if (byMonthDay) {
            const name = byMonthDay[1].toLowerCase();
            const monthIndex = MONTHS.findIndex(month => month.startsWith(name.slice(0, 3)));
            if (monthIndex >= 0) {
                const day = byMonthDay[2] ? Number(byMonthDay[2]) : undefined;
                const year = monthIndex < today.getMonth() ? today.getFullYear() + 1 : today.getFullYear();
                const end = day
                    ? new Date(year, monthIndex, day)
                    : endOfMonth(new Date(year, monthIndex, 1));
                window = { kind: 'fixed', start: dateKey(today), end: dateKey(end) };
            }
        }
    }

    /* ---------------------------------------------------------------- amount */
    // "3x a week" and "3 times a week" both give 3 sessions.
    const frequencyMatch = text.match(/\b(\d{1,3})\s*(x|times?)\b/i);
    const percentMatch = text.match(/\b(\d{1,3})\s*%|\b(\d{1,3})\s*percent\b/i);
    const amountMatch = text.match(/\b(\d+(?:\.\d+)?)\s*(hours?|hrs?|minutes?|mins?|pages?|kilometers?|kilometres?|kms?|km|miles?|mi|steps?|kilos?|kilograms?|kgs?|kg|pounds?|lbs?|lb|glasses|glass|liters?|litres?|dollars?|words?|reps?)\b/i);

    let target: number | null = null;
    if (percentMatch) {
        target = Number(percentMatch[1] ?? percentMatch[2]) / 100;
    } else if (amountMatch) {
        target = Number(amountMatch[1]) * unitFactor;
    } else if (frequencyMatch) {
        target = Number(frequencyMatch[1]);
    } else {
        const bare = text.match(/\b(\d+(?:\.\d+)?)\b/);
        if (bare) target = Number(bare[1]);
    }

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
    } else if (isTargetValue && unit && MEASUREMENT_UNITS.includes(unit)) {
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

    spec.metric_unit = unit;
    spec.target = target;
    spec.window = window;

    /* -------------------------------------------------------- subject + links */
    const subject = subjectFrom(raw);
    spec.linked_habits = linkHabits(subject, unit, habits);
    if (spec.linked_habits.length === 0 && subject && unit) {
        spec.suggested_habit = { name: titleCase(subject), unit };
    }

    /* ----------------------------------------------------------------- title */
    spec.title = buildTitle(raw, spec, subject, today);

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
    if (spec.target === null) missing.push('target');
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
        case 'baseline':
            return `What's your current ${spec.metric_unit === 'lb' ? 'weight in lb' : `${spec.metric_unit}`}? I need it to track your progress toward ${spec.target}${spec.metric_unit ? ` ${spec.metric_unit}` : ''}.`;
        case 'target':
            return 'How much are you aiming for? Give me a number, for example 50 km, 300 pages, or 3 sessions.';
        case 'metric_unit':
            return 'What should I count? For example minutes, pages, km or sessions.';
        case 'window':
        default:
            return 'Over what period? For example each day, each week, this month, or by a specific date.';
    }
}

function buildTitle(raw: string, spec: GoalSpec, subject: string, today: Date): string {
    const name = subject ? titleCase(subject) : titleCase(raw);
    if (spec.target === null || !spec.metric_unit) return titleCase(raw);

    const amount = spec.metric_unit === 'percent'
        ? `${Math.round((spec.target ?? 0) * 100)}%`
        : `${spec.target} ${spec.metric_unit}`;

    let when = '';
    if (spec.window?.kind === 'recurring') {
        when = ` per ${spec.window.period}`;
    } else if (spec.window?.kind === 'fixed') {
        const end = new Date(`${spec.window.end}T12:00:00`);
        const sameMonth = end.getFullYear() === today.getFullYear() && end.getMonth() === today.getMonth();
        when = sameMonth
            ? ` in ${MONTHS[end.getMonth()].replace(/^./, char => char.toUpperCase())}`
            : ` by ${MONTHS[end.getMonth()].replace(/^./, char => char.toUpperCase())} ${end.getDate()}`;
    }

    if (spec.type === 'limit') return `Max ${amount} of ${name}${when}`;
    if (spec.type === 'target_value') return `Reach ${amount}${when}`;
    if (spec.type === 'consistency') return `${name} ${amount} of days${when}`;
    return `${name} ${amount}${when}`;
}
