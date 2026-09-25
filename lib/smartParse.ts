import { z } from 'zod';
import { askForObject } from './onDeviceAI';
import { parseHabitText, type ParsedHabit } from './habitParser';
import { ALLOWED_UNITS, parseGoalText, type GoalParseResult, type HabitRef } from './goalParser';
import type { TaskPriority } from './tasks';
import { localDateKey } from './habitSchedule';

/**
 * Natural language, understood by the on-device model.
 *
 * The rule-based parsers answer instantly and always; the model is asked
 * afterwards and, when it answers in time, its reading replaces theirs. Every
 * field the model returns is checked the same way a typed value would be (a
 * real weekday, a real clock time, a date that exists, a unit Habyss tracks),
 * and anything that fails is dropped in favour of the rule-based value, so a
 * wrong answer can make a result less clever but never invalid.
 */

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const describeToday = (today: Date) =>
    `Today is ${today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} (${localDateKey(today)}).`;

const cleanName = (value: unknown, max = 60): string | null => {
    if (typeof value !== 'string') return null;
    const trimmed = value.replace(/\s+/g, ' ').trim().slice(0, max);
    return trimmed ? trimmed.charAt(0).toUpperCase() + trimmed.slice(1) : null;
};

const validDate = (value: unknown, today: Date): string | null => {
    if (typeof value !== 'string' || !DATE.test(value)) return null;
    const [y, m, d] = value.split('-').map(Number);
    const date = new Date(y, m - 1, d, 12);
    if (localDateKey(date) !== value) return null;
    const from = new Date(today); from.setDate(from.getDate() - 1);
    const to = new Date(today); to.setFullYear(to.getFullYear() + 5);
    return date >= from && date <= to ? value : null;
};

const inRange = (value: unknown, min: number, max: number): number | null =>
    typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : null;

/* ------------------------------------------------------------------ habits */

const HabitSchema = z.object({
    name: z.string().describe('The habit itself, short, without days, times or amounts. E.g. "Gym", "Read".'),
    days: z.array(z.enum(DAYS)).describe('Days it happens. Empty means every day.'),
    time: z.string().nullable().describe('Start time as 24-hour HH:MM, or null.'),
    durationMinutes: z.number().nullable().describe('How long each time, in minutes, or null.'),
    target: z.number().nullable().describe('A count per time, e.g. 20 for "20 pages", or null.'),
    unit: z.string().nullable().describe('Unit of the count, e.g. "pages", "km", "glasses", or null.'),
});

export async function smartParseHabit(text: string): Promise<ParsedHabit | null> {
    if (!text.trim()) return null;
    const answer = await askForObject(
        HabitSchema,
        'You turn one sentence into a recurring habit. Only use what the sentence says; never invent days, times or amounts.',
        `Sentence: "${text.trim()}"`,
    );
    if (!answer) return null;

    const base = parseHabitText(text);
    const days = [...new Set(answer.days.filter(day => (DAYS as readonly string[]).includes(day)))];
    const time = answer.time && TIME.test(answer.time) ? answer.time : base.startTime;
    const duration = inRange(answer.durationMinutes, 1, 600) ?? base.durationMinutes;
    const target = inRange(answer.target, 0.1, 100000) ?? base.targetValue;
    const unit = target ? (cleanName(answer.unit, 20)?.toLowerCase() ?? base.targetUnit) : base.targetUnit;

    return {
        name: cleanName(answer.name) ?? base.name,
        taskDays: days.length ? days : base.taskDays,
        startTime: time,
        durationMinutes: duration ?? undefined,
        targetValue: target ?? undefined,
        targetUnit: unit ?? undefined,
        trackingMethod: target || duration ? 'numeric' : base.trackingMethod,
        assumptions: [],
        matched: {
            days: days.length > 0 || base.matched.days,
            time: !!time,
            duration: !!duration,
            target: !!target,
        },
    };
}

/* ------------------------------------------------------------------- tasks */

const TaskSchema = z.object({
    title: z.string().describe('What must be done, as a short imperative. No dates or times.'),
    dueDate: z.string().nullable().describe('YYYY-MM-DD, resolved from words like "tomorrow" or "friday", or null.'),
    dueTime: z.string().nullable().describe('24-hour HH:MM, or null.'),
    estimatedMinutes: z.number().nullable().describe('How long it will take, in minutes, or null.'),
    priority: z.enum(['high', 'normal', 'low']).describe('high only if the sentence says urgent/important/asap.'),
});

export interface ParsedTask {
    title: string;
    dueDate?: string;
    dueTime?: string;
    estimatedMinutes?: number;
    priority: TaskPriority;
}

const PRIORITY: Record<'high' | 'normal' | 'low', TaskPriority> = { high: 1, normal: 2, low: 3 };

export async function smartParseTask(text: string, today = new Date()): Promise<ParsedTask | null> {
    if (!text.trim()) return null;
    const answer = await askForObject(
        TaskSchema,
        `You turn one sentence into a one-off task. ${describeToday(today)} Resolve relative dates against today. Only use what the sentence says.`,
        `Sentence: "${text.trim()}"`,
    );
    if (!answer) return null;
    const title = cleanName(answer.title, 120);
    if (!title) return null;
    return {
        title,
        dueDate: validDate(answer.dueDate, today) ?? undefined,
        dueTime: answer.dueTime && TIME.test(answer.dueTime) ? answer.dueTime : undefined,
        estimatedMinutes: inRange(answer.estimatedMinutes, 1, 24 * 60) ?? undefined,
        priority: PRIORITY[answer.priority] ?? 2,
    };
}

/* ------------------------------------------------------------------- goals */

const GoalSchema = z.object({
    action: z.string().describe('The verb and object, e.g. "Save", "Run", "Read", "Launch my app".'),
    target: z.number().nullable().describe('The number to reach, e.g. 10000 for "10k". null if none was given.'),
    unit: z.enum(ALLOWED_UNITS).nullable().describe('What is counted, from the allowed list, or null.'),
    per: z.enum(['day', 'week', 'month']).nullable().describe('If it repeats every day/week/month, else null.'),
    deadline: z.string().nullable().describe('YYYY-MM-DD when it must be done by, resolved against today, or null.'),
});

/**
 * The model restates the goal in the plain form the goal parser reads best
 * ("Save 10000 dollars by 2026-12-31"), and the parser does the rest. The
 * structure of a goal therefore always comes from one place, and the model
 * only has to understand the sentence, which is what it is good at.
 */
export async function smartParseGoal(text: string, options: { today?: Date; habits?: HabitRef[] } = {}): Promise<GoalParseResult | null> {
    const today = options.today ?? new Date();
    if (!text.trim()) return null;
    const answer = await askForObject(
        GoalSchema,
        `You read one sentence describing a goal. ${describeToday(today)} Only use what the sentence says; never invent a number.`,
        `Sentence: "${text.trim()}"`,
    );
    if (!answer) return null;

    const action = cleanName(answer.action, 60);
    if (!action) return null;
    const target = inRange(answer.target, 0.01, 1e9);
    const deadline = validDate(answer.deadline, today);
    const amount = target !== null ? ` ${target}${answer.unit ? ` ${answer.unit}` : ''}` : '';
    const when = answer.per ? ` per ${answer.per}` : deadline ? ` by ${deadline}` : '';
    const restated = parseGoalText(`${action}${amount}${when}`, { today, habits: options.habits });
    const original = parseGoalText(text, { today, habits: options.habits });

    // Keep whichever reading is more complete; ties go to the model's.
    return restated.missing_fields.length <= original.missing_fields.length ? restated : original;
}
