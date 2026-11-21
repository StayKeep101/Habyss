import { useEffect, useState } from 'react';
import { localDateKey } from '@/lib/habitSchedule';

/**
 * What a habit could be held to: the names of the next two weeks' calendar
 * events (each once, soonest first), the meals that are on, your habits and
 * today's tasks. Read once when asked for; on the phone only.
 */
export function useAnchorSuggestions(open: boolean): string[] {
    const [names, setNames] = useState<string[]>([]);
    useEffect(() => {
        if (!open) return;
        let live = true;
        void (async () => {
            const { eventsFor } = require('@/lib/calendarEvents') as typeof import('@/lib/calendarEvents');
            const { loadMeals, mealSlots } = require('@/lib/meals') as typeof import('@/lib/meals');
            const days = Array.from({ length: 14 }, (_, index) => { const date = new Date(); date.setDate(date.getDate() + index); return localDateKey(date); });
            const events = (await Promise.all(days.map(day => eventsFor(day).catch(() => [])))).flat();
            const meals = mealSlots(await loadMeals().catch(() => ({}) as never)).map(meal => meal.name);
            // Your habits and today's tasks: a habit can be held to those too.
            const { getHabits } = require('@/lib/habitsSQLite') as typeof import('@/lib/habitsSQLite');
            const { getData } = require('@/lib/dataStore') as typeof import('@/lib/dataStore');
            const habits = (await getHabits().catch(() => [])).filter(habit => !habit.isGoal && !habit.isArchived).map(habit => habit.name);
            const data = getData();
            const tasks = data.tasks.filter(task => task.status === 'open' && (!task.dueDate || task.dueDate === data.today)).map(task => task.title);
            const seen = new Set<string>();
            const list = [...events.map(event => event.title.trim()), ...meals, ...habits, ...tasks].filter(name => {
                const key = name.toLowerCase();
                if (!name || seen.has(key)) return false;
                seen.add(key);
                return true;
            });
            if (live) setNames(list);
        })().catch(() => undefined);
        return () => { live = false; };
    }, [open]);
    return names;
}
