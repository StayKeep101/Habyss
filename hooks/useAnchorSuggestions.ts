import { useEffect, useState } from 'react';
import { localDateKey } from '@/lib/habitSchedule';

/**
 * What a habit could be held to: the names of the next two weeks' calendar
 * events (each once, soonest first) and the meals that are on. Read once when
 * the picker opens; on the phone only.
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
            const seen = new Set<string>();
            const list = [...events.map(event => event.title.trim()), ...meals].filter(name => {
                const key = name.toLowerCase();
                if (!name || seen.has(key)) return false;
                seen.add(key);
                return true;
            });
            if (live) setNames(list.slice(0, 10));
        })().catch(() => undefined);
        return () => { live = false; };
    }, [open]);
    return names;
}
