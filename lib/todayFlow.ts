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
