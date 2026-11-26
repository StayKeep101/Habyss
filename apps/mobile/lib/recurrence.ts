/**
 * How often something comes round.
 *
 * The sheet used to offer a row of weekday toggles and little else, so a habit
 * that genuinely repeats "every second month on the third Sunday" had nowhere
 * to be written down. This is the grammar for saying it.
 *
 * Two rules shape everything below. An interval is always counted from the
 * habit's start date, so "every 2 weeks" means the same weeks forever rather
 * than drifting with the calendar; and, as in iCalendar (RFC 5545, DTSTART),
 * that start is the series' first occurrence (lib/habitSchedule.ts firstDueDay),
 * with weeks from Monday (WKST=MO). And every rule can describe itself in
 * English, because a rule the user cannot read back is a rule they cannot
 * trust.
 */

export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

/** 1st through 5th, or -1 for the last one in the month. */
export type Ordinal = 1 | 2 | 3 | 4 | 5 | -1;

/** What "the third ___" counts: a weekday, any day, or a kind of day. */
export type DaySelector = Weekday | 'day' | 'weekday' | 'weekend';

export type Recurrence =
    | { kind: 'hourly'; every: number }
    | { kind: 'daily'; every: number }
    | { kind: 'weekly'; every: number; weekdays: Weekday[] }
    | { kind: 'monthly'; every: number; dates: number[] }
    | { kind: 'monthly'; every: number; ordinal: Ordinal; day: DaySelector }
    | { kind: 'yearly'; every: number; months: number[] }
    | { kind: 'yearly'; every: number; months: number[]; ordinal: Ordinal; day: DaySelector }
    /**
     * "3 times a week", "once a month": that many times in each week (Monday
     * to Sunday) or month, on whichever days. Offered every day until the
     * period's count is reached; see lib/habitSchedule.ts habitRequirement
     * for when a day is actually due, and when one counts as missed.
     */
    | { kind: 'quota'; every: number; times: number; period: 'week' | 'month' };

export const WEEKDAYS: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
export const WEEKDAY_NAME: Record<Weekday, string> = {
    mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday',
    fri: 'Friday', sat: 'Saturday', sun: 'Sunday',
};
const WORKDAYS: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri'];
const WEEKEND: Weekday[] = ['sat', 'sun'];

const MONTH_NAME = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
const ORDINAL_NAME: Record<Ordinal, string> = {
    1: 'first', 2: 'second', 3: 'third', 4: 'fourth', 5: 'fifth', [-1]: 'last',
};

/* --------------------------------------------------------------- presets */

export const DAILY: Recurrence = { kind: 'daily', every: 1 };
export const WEEKDAYS_ONLY: Recurrence = { kind: 'weekly', every: 1, weekdays: WORKDAYS };
export const WEEKENDS_ONLY: Recurrence = { kind: 'weekly', every: 1, weekdays: WEEKEND };

/* ------------------------------------------------------------- calendar */

/** Sunday is 0 in JavaScript; the app counts weeks from Monday. */
const weekdayOf = (date: Date): Weekday => WEEKDAYS[(date.getDay() + 6) % 7];
const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
/** Whole days between two dates, ignoring the clock. */
const daysBetween = (from: Date, to: Date) =>
    Math.round((Date.UTC(to.getFullYear(), to.getMonth(), to.getDate())
        - Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())) / 86400000);
const monthsBetween = (from: Date, to: Date) =>
    (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());

/** Whether a day is one the selector counts (a Thursday, any weekday, …). */
function dayMatches(day: Date, selector: DaySelector): boolean {
    const weekday = weekdayOf(day);
    if (selector === 'day') return true;
    if (selector === 'weekday') return WORKDAYS.includes(weekday);
    if (selector === 'weekend') return WEEKEND.includes(weekday);
    return weekday === selector;
}

/** Whether a date is the nth matching day of its month. */
function isNth(date: Date, ordinal: Ordinal, selector: DaySelector): boolean {
    const matches = (day: Date) => dayMatches(day, selector);
    if (!matches(date)) return false;

    const year = date.getFullYear();
    const month = date.getMonth();
    const last = daysInMonth(year, month);

    if (ordinal === -1) {
        // Nothing matching may come after it.
        for (let day = date.getDate() + 1; day <= last; day++) {
            if (matches(new Date(year, month, day))) return false;
        }
        return true;
    }

    let seen = 0;
    for (let day = 1; day <= date.getDate(); day++) {
        if (matches(new Date(year, month, day))) seen++;
    }
    return seen === ordinal;
}

/** Whether a date is the nth matching day of its year (no month given): "the last Friday of the year". */
function isNthOfYear(date: Date, ordinal: Ordinal, selector: DaySelector): boolean {
    if (!dayMatches(date, selector)) return false;
    const year = date.getFullYear();
    const target = daysBetween(new Date(year, 0, 1), date);
    const total = daysBetween(new Date(year, 0, 1), new Date(year, 11, 31));
    if (ordinal === -1) {
        for (let at = target + 1; at <= total; at++) if (dayMatches(new Date(year, 0, 1 + at), selector)) return false;
        return true;
    }
    let seen = 0;
    for (let at = 0; at <= target; at++) if (dayMatches(new Date(year, 0, 1 + at), selector)) seen++;
    return seen === ordinal;
}

/* -------------------------------------------------------------- matching */

/**
 * Whether the rule asks for this date, counting intervals from `start`.
 *
 * Hourly is deliberately treated as daily here: a date either is or is not a
 * day the habit runs, and how many times within it is the reminder's business
 * rather than the calendar's.
 */
export function matches(rule: Recurrence, date: Date, start: Date): boolean {
    const every = Math.max(1, Math.floor(rule.every));
    if (daysBetween(start, date) < 0) return false;

    switch (rule.kind) {
        case 'hourly':
            return true;

        case 'quota':
            // Any day may count toward it; whether one is due is decided with
            // the history (habitRequirement), not by the calendar alone.
            return true;

        case 'daily':
            return daysBetween(start, date) % every === 0;

        case 'weekly': {
            if (rule.weekdays.length === 0) return false;
            if (!rule.weekdays.includes(weekdayOf(date))) return false;
            // Counted in whole weeks from the Monday of the start's week, so
            // every rule in a fortnight agrees about which fortnight it is.
            const startMonday = daysBetween(new Date(2000, 0, 3), start); // a Monday
            const dateMonday = daysBetween(new Date(2000, 0, 3), date);
            return (Math.floor(dateMonday / 7) - Math.floor(startMonday / 7)) % every === 0;
        }

        case 'monthly': {
            if (monthsBetween(start, date) % every !== 0) return false;
            if ('dates' in rule) {
                const last = daysInMonth(date.getFullYear(), date.getMonth());
                // A 31st in a 30-day month lands on its last day rather than
                // being skipped, which is what people mean by "the 31st".
                return rule.dates.some(day => date.getDate() === Math.min(day, last));
            }
            return isNth(date, rule.ordinal, rule.day);
        }

        case 'yearly': {
            if ((date.getFullYear() - start.getFullYear()) % every !== 0) return false;
            // RFC 5545: with an ordinal but no month, "the last Friday" is of the year;
            // with no ordinal and no month, the year's one day is the start's month and day.
            if ('ordinal' in rule) {
                if (!rule.months.length) return isNthOfYear(date, rule.ordinal, rule.day);
                return rule.months.includes(date.getMonth()) && isNth(date, rule.ordinal, rule.day);
            }
            const months = rule.months.length ? rule.months : [start.getMonth()];
            if (!months.includes(date.getMonth())) return false;
            return date.getDate() === Math.min(start.getDate(), daysInMonth(date.getFullYear(), date.getMonth()));
        }
    }
}

/* ------------------------------------------------------------ describing */

const list = (parts: string[]): string => {
    if (parts.length === 0) return '';
    if (parts.length === 1) return parts[0];
    return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
};

const ordinalNumber = (value: number): string => {
    const tens = value % 100;
    if (tens >= 11 && tens <= 13) return `${value}th`;
    return `${value}${['th', 'st', 'nd', 'rd'][value % 10] ?? 'th'}`;
};

const dayName = (selector: DaySelector): string =>
    selector === 'day' ? 'day'
        : selector === 'weekday' ? 'weekday'
            : selector === 'weekend' ? 'weekend day'
                : WEEKDAY_NAME[selector];

/** "Every 2 months on the third Sunday" — what the chip above the keyboard says. */
export function describe(rule: Recurrence): string {
    const every = Math.max(1, Math.floor(rule.every));
    const nth = (unit: string) => (every === 1 ? '' : `every ${every} ${unit}s`);

    switch (rule.kind) {
        case 'hourly':
            return every === 1 ? 'Every hour' : `Every ${every} hours`;

        case 'quota': {
            const times = rule.times === 1 ? 'Once' : rule.times === 2 ? 'Twice' : `${rule.times} times`;
            return `${times} a ${rule.period}`;
        }

        case 'daily':
            return every === 1 ? 'Every day' : `Every ${every} days`;

        case 'weekly': {
            const days = [...rule.weekdays].sort((a, b) => WEEKDAYS.indexOf(a) - WEEKDAYS.indexOf(b));
            if (days.length === 0) return 'No days chosen';
            const named = days.length === 7 ? 'every day'
                : days.length === 5 && WORKDAYS.every(day => days.includes(day)) ? 'weekdays'
                    : days.length === 2 && WEEKEND.every(day => days.includes(day)) ? 'weekends'
                        : list(days.map(day => WEEKDAY_NAME[day]));
            if (every === 1) return named.charAt(0).toUpperCase() + named.slice(1);
            return `${named.charAt(0).toUpperCase()}${named.slice(1)}, ${nth('week')}`;
        }

        case 'monthly': {
            const when = 'dates' in rule
                ? rule.dates.length
                    ? `on the ${list(rule.dates.slice().sort((a, b) => a - b).map(ordinalNumber))}`
                    : 'on no date'
                : `on the ${ORDINAL_NAME[rule.ordinal]} ${dayName(rule.day)}`;
            return every === 1 ? `Monthly ${when}` : `Every ${every} months ${when}`;
        }

        case 'yearly': {
            const months = rule.months.length
                ? list(rule.months.slice().sort((a, b) => a - b).map(month => MONTH_NAME[month]))
                : '';
            const when = 'ordinal' in rule
                ? ` on the ${ORDINAL_NAME[rule.ordinal]} ${dayName(rule.day)}`
                : '';
            const head = every === 1 ? 'Yearly' : `Every ${every} years`;
            return months ? `${head} in ${months}${when}` : `${head}${when}`;
        }
    }
}

/* ------------------------------------------------------------- storage */

/** Narrow, so a hand-edited or out-of-date value cannot crash a schedule. */
export function parseRecurrence(raw: string | null | undefined): Recurrence | null {
    if (!raw) return null;
    try {
        const value = JSON.parse(raw);
        if (!value || typeof value !== 'object') return null;
        const every = Number(value.every);
        if (!Number.isFinite(every) || every < 1 || every > 999) return null;

        switch (value.kind) {
            case 'hourly':
            case 'daily':
                return { kind: value.kind, every };
            case 'quota': {
                const times = Number(value.times);
                if (!Number.isInteger(times) || times < 1 || times > 31) return null;
                return value.period === 'week' || value.period === 'month' ? { kind: 'quota', every: 1, times, period: value.period } : null;
            }
            case 'weekly': {
                const weekdays = Array.isArray(value.weekdays)
                    ? value.weekdays.filter((day: unknown): day is Weekday => WEEKDAYS.includes(day as Weekday))
                    : [];
                return weekdays.length ? { kind: 'weekly', every, weekdays } : null;
            }
            case 'monthly': {
                if (Array.isArray(value.dates)) {
                    const dates = value.dates.filter((day: unknown) => Number.isInteger(day) && (day as number) >= 1 && (day as number) <= 31);
                    return dates.length ? { kind: 'monthly', every, dates } : null;
                }
                return isOrdinal(value.ordinal) && isSelector(value.day)
                    ? { kind: 'monthly', every, ordinal: value.ordinal, day: value.day }
                    : null;
            }
            case 'yearly': {
                const months = Array.isArray(value.months)
                    ? value.months.filter((month: unknown) => Number.isInteger(month) && (month as number) >= 0 && (month as number) <= 11)
                    : [];
                if (isOrdinal(value.ordinal) && isSelector(value.day)) {
                    return { kind: 'yearly', every, months, ordinal: value.ordinal, day: value.day };
                }
                return { kind: 'yearly', every, months };
            }
            default:
                return null;
        }
    } catch {
        return null;
    }
}

const isOrdinal = (value: unknown): value is Ordinal =>
    value === 1 || value === 2 || value === 3 || value === 4 || value === 5 || value === -1;

const isSelector = (value: unknown): value is DaySelector =>
    value === 'day' || value === 'weekday' || value === 'weekend' || WEEKDAYS.includes(value as Weekday);

export const serialiseRecurrence = (rule: Recurrence): string => JSON.stringify(rule);
