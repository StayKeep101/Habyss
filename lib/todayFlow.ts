import { flowDay, flowInputs, type DayFlow } from './dayFlow';

/**
 * Today's timeline worked out outside any screen, from the same pieces the
 * Roadmap uses (habits, tasks, meals, calendar, waking day, what was already
 * placed), for things that run without the Roadmap open — the Live Activity.
 */
export async function todayFlow(now = new Date()): Promise<DayFlow> {
    const { getHabits, getCompletions, isHabitScheduledForDate } = require('./habitsSQLite') as typeof import('./habitsSQLite');
    const { getTasks, tasksForDay } = require('./tasks') as typeof import('./tasks');
    const { localDateKey } = require('./habitSchedule') as typeof import('./habitSchedule');
    const { getDayWindow, minutesOf } = require('./echo') as typeof import('./echo');
    const { loadMeals, loadMealsFlexible, mealSlots } = require('./meals') as typeof import('./meals');
    const { eventsFor } = require('./calendarEvents') as typeof import('./calendarEvents');
    const { loadMemory } = require('./dayMemory') as typeof import('./dayMemory');
    const today = localDateKey(now);
    const [habits, tasks, done, day, meals, flexible, events, memory] = await Promise.all([
        getHabits(), getTasks(), getCompletions(today), getDayWindow(), loadMeals(), loadMealsFlexible(), eventsFor(today).catch(() => []), loadMemory(),
    ]);
    const items = flowInputs({
        habits: habits.filter(habit => !habit.isGoal && !habit.isArchived && isHabitScheduledForDate(habit, now)),
        tasks: tasksForDay(tasks, today, today), done, meals: mealSlots(meals), events, today, flexibleMeals: flexible,
        kept: memory.day === today ? memory.slots : undefined,
    });
    return flowDay(items, now.getHours() * 60 + now.getMinutes(), { wake: minutesOf(day.wake), sleep: minutesOf(day.sleep) });
}

/** Where each open habit and task starts and ends today, in minutes from midnight. */
export type TodayTimes = Record<string, { start: number; end: number }>;

/** The Roadmap's own timeline, the freshest truth, while it is from today. */
let latest: { day: string; flow: DayFlow } | null = null;
export function rememberTodayFlow(day: string, flow: DayFlow) { latest = { day, flow }; }

/**
 * Today's start and end for every open habit and task on the timeline: what
 * reminders, Echo's nudges and the Live Activity are timed from, so they follow
 * the auto-schedule rather than a time set once.
 */
export async function todayTimes(now = new Date()): Promise<TodayTimes> {
    const { localDateKey } = require('./habitSchedule') as typeof import('./habitSchedule');
    const day = localDateKey(now);
    const flow = latest?.day === day ? latest.flow : await todayFlow(now).catch(() => null);
    if (!flow) return {};
    return Object.fromEntries(flow.timeline
        .filter(item => !item.fixed && !item.done && (item.kind === 'habit' || item.kind === 'task'))
        .map(item => [item.id, { start: item.start, end: item.end }]));
}
