import { useEffect, useMemo, useState } from 'react';
import { localDateKey } from '@/lib/habitSchedule';

/**
 * What a habit could be held to: the names of the next two weeks' calendar
 * events (each once, soonest first), the meals that are on, your habits and
 * today's tasks. Read once when asked for; on the phone only.
 */
export type AnchorKind = 'event' | 'meal' | 'task' | 'habit';
/** `done`: a habit or task already done today (listed after the rest). */
export type AnchorOption = { kind: AnchorKind; name: string; done?: boolean };

/** Every name, of every kind (for reading the sentence: "after Lunch"). */
export function useAnchorSuggestions(open: boolean): string[] {
    const options = useAnchorOptions(open);
    return useMemo(() => options.map(option => option.name), [options]);
}

/** What a habit can be linked to, each with its kind, for the Link panel to sort by. */
export function useAnchorOptions(open: boolean): AnchorOption[] {
    const [names, setNames] = useState<AnchorOption[]>([]);
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
            const data = getData();
            const doneToday = new Set(data.history[data.today] ?? []);
            const habits = (await getHabits().catch(() => [])).filter(habit => !habit.isArchived)
                .map(habit => ({ name: habit.name, done: doneToday.has(habit.id) }));
            // Today's tasks: still to do, and those done today.
            const tasks = data.tasks.filter(task => task.status !== 'cancelled' && (task.status === 'open'
                ? !task.dueDate || task.dueDate === data.today
                : (task.completedAt ?? '').slice(0, 10) === data.today))
                .map(task => ({ name: task.title, done: task.status === 'done' }));
            const seen = new Set<string>();
            const list: AnchorOption[] = [
                ...events.map(event => ({ kind: 'event' as const, name: event.title.trim() })),
                ...meals.map(name => ({ kind: 'meal' as const, name })),
                ...tasks.map(task => ({ kind: 'task' as const, ...task })),
                ...habits.map(habit => ({ kind: 'habit' as const, ...habit })),
            ].filter(({ name }) => {
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
