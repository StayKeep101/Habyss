import { flowDay, flowInputs, type DayFlow } from './dayFlow';

/**
 * Today's timeline worked out outside any screen, from the same pieces the
 * Roadmap uses (habits, tasks, meals, calendar, waking day, what was already
 * placed), for things that run without the Roadmap open — the Live Activity.
 */
export async function todayFlow(now = new Date()): Promise<DayFlow> {
    const { getHabits, getCompletions, getCompletionTimes, isHabitScheduledForDate } = require('./habitsSQLite') as typeof import('./habitsSQLite');
    const { getTasks, tasksForDay } = require('./tasks') as typeof import('./tasks');
    const { localDateKey } = require('./habitSchedule') as typeof import('./habitSchedule');
    const { getDayWindow, minutesOf } = require('./echo') as typeof import('./echo');
    const { loadMeals, loadMealsFlexible, mealSlots } = require('./meals') as typeof import('./meals');
    const { eventsFor } = require('./calendarEvents') as typeof import('./calendarEvents');
    const { loadMemory } = require('./dayMemory') as typeof import('./dayMemory');
    const { loadTravel } = require('./eventTravel') as typeof import('./eventTravel');
    const today = localDateKey(now);
    const [habits, tasks, done, day, meals, flexible, events, memory, doneTimes] = await Promise.all([
        getHabits(), getTasks(), getCompletions(today), getDayWindow(), loadMeals(), loadMealsFlexible(), eventsFor(today).catch(() => []), loadMemory(),
        getCompletionTimes(today).catch(() => ({})),
    ]);
    const travel = await loadTravel().catch(() => ({}));
    const items = flowInputs({
        habits: habits.filter(habit => !habit.isGoal && !habit.isArchived && isHabitScheduledForDate(habit, now)),
        tasks: tasksForDay(tasks, today, today), done, doneTimes, day: today, meals: mealSlots(meals), events, travel, today, flexibleMeals: flexible,
        kept: memory.day === today ? memory.slots : undefined, planned: memory.day === today ? memory.planned : undefined,
    });
    return flowDay(items, now.getHours() * 60 + now.getMinutes(), { wake: minutesOf(day.wake), sleep: minutesOf(day.sleep) });
}

/** Where each open habit and task starts and ends today, in minutes from midnight. */
export type TodayTimes = Record<string, { start: number; end: number; cutFrom?: number }>;

/** The Roadmap's own timeline, the freshest truth, while it is from today. */
let latest: { day: string; flow: DayFlow } | null = null;
export function rememberTodayFlow(day: string, flow: DayFlow) { latest = { day, flow }; }

/** Today's timeline: the Roadmap's own while it is from today, else worked out here. */
export async function currentTodayFlow(now = new Date()): Promise<DayFlow | null> {
    const { localDateKey } = require('./habitSchedule') as typeof import('./habitSchedule');
    const day = localDateKey(now);
    return latest?.day === day ? latest.flow : await todayFlow(now).catch(() => null);
}

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
        .map(item => [item.id, { start: item.start, end: item.end, ...(item.cutFrom ? { cutFrom: item.cutFrom } : null) }]));
}

/**
 * Focusing all day: what comes next from `now` on today's timeline. A habit
 * or task not done yet, or a meal or calendar event not over yet, in the
 * order the timeline has them; `skip` is the one just finished (its tick may
 * still be saving). An exact-time one that has not started yet comes back
 * with `wait`: the free time before it is the step.
 */
export interface DayStep { item: import('./dayFlow').FlowItem; wait: boolean }
export function nextStep(flow: DayFlow | null, now: number, skip?: string): DayStep | null {
    const item = (flow?.timeline ?? [])
        .filter(entry => entry.id !== skip && !entry.done && entry.state !== 'done' && entry.end > now)
        .sort((a, b) => a.start - b.start)[0];
    if (!item) return null;
    // A habit or task that floats can start straight away; one at an exact
    // time, a meal or an event, waits for its time.
    const waits = !!(item.locked || item.fixed) && item.start > now;
    return { item, wait: waits };
}
