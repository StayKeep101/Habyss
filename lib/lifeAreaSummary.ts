import type { Habit, HabitCategory } from './habitsSQLite';
import { isHabitScheduledForDate, localDateKey } from './habitSchedule';

export const LIFE_AREAS = [
    { id: 'body', label: 'Body', description: 'Health & fitness', color: '#EF4444', categories: ['body', 'health', 'fitness'] },
    { id: 'wealth', label: 'Wealth', description: 'Work & finances', color: '#F59E0B', categories: ['wealth', 'work', 'finance', 'productivity'] },
    { id: 'heart', label: 'Heart', description: 'Relationships', color: '#EC4899', categories: ['heart', 'family', 'social'] },
    { id: 'mind', label: 'Mind', description: 'Learning', color: '#60A5FA', categories: ['mind', 'learning'] },
    { id: 'soul', label: 'Soul', description: 'Mindfulness', color: '#A78BFA', categories: ['soul', 'mindfulness'] },
    { id: 'play', label: 'Play', description: 'Creativity & recreation', color: '#34D399', categories: ['play', 'creativity'] },
    { id: 'other', label: 'Other', description: 'Personal & uncategorized', color: '#94A3B8', categories: ['personal', 'misc'] },
] as const;

export type LifeAreaId = typeof LIFE_AREAS[number]['id'];
export type CompletionHistoryDay = { date: string; completedIds: string[] };

export interface LifeAreaHabitSummary {
    habit: Habit;
    scheduled: number;
    completed: number;
    dueToday: boolean;
    completedToday: boolean;
}

export interface LifeAreaSummary {
    id: LifeAreaId;
    label: string;
    description: string;
    color: string;
    scheduled: number;
    completed: number;
    rate: number | null;
    habits: LifeAreaHabitSummary[];
}

export const lifeAreaForCategory = (category: HabitCategory): LifeAreaId =>
    LIFE_AREAS.find(area => (area.categories as readonly string[]).includes(category))?.id ?? 'other';

/**
 * Follow-through on each area's chosen commitments, not a score for life quality.
 * Each scheduled habit/day is one opportunity; goals, archives, unscheduled
 * check-ins and future dates cannot inflate the denominator or numerator.
 * Today uses the live completion map so an undo is reflected immediately.
 */
export function buildLifeAreaSummary({
    habits,
    history,
    completions,
    days = 7,
    now = new Date(),
}: {
    habits: Habit[];
    history: CompletionHistoryDay[];
    completions: Record<string, boolean>;
    days?: number;
    now?: Date;
}): LifeAreaSummary[] {
    const today = localDateKey(now);
    const completedByDate = new Map<string, Set<string>>();
    for (const day of history) {
        const completed = completedByDate.get(day.date) ?? new Set<string>();
        day.completedIds.forEach(id => completed.add(id));
        completedByDate.set(day.date, completed);
    }
    completedByDate.set(today, new Set(Object.keys(completions).filter(id => completions[id])));

    const dates = Array.from({ length: days }, (_, index) => {
        const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days + index + 1, 12);
        return { date, key: localDateKey(date) };
    });
    const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
    const activeHabits = habits.filter(habit => !habit.isGoal && !habit.isArchived);

    return LIFE_AREAS.map(area => {
        const areaHabits = activeHabits
            .filter(habit => lifeAreaForCategory(habit.category) === area.id)
            .map(habit => {
                const scheduledDates = dates.filter(({ date }) => isHabitScheduledForDate(habit, date));
                return {
                    habit,
                    scheduled: scheduledDates.length,
                    completed: scheduledDates.filter(({ key }) => completedByDate.get(key)?.has(habit.id)).length,
                    dueToday: isHabitScheduledForDate(habit, todayDate),
                    completedToday: !!completions[habit.id],
                };
            })
            .sort((a, b) => Number(b.dueToday && !b.completedToday) - Number(a.dueToday && !a.completedToday) || a.habit.name.localeCompare(b.habit.name));
        const scheduled = areaHabits.reduce((sum, habit) => sum + habit.scheduled, 0);
        const completed = areaHabits.reduce((sum, habit) => sum + habit.completed, 0);
        return { ...area, habits: areaHabits, scheduled, completed, rate: scheduled > 0 ? completed / scheduled : null };
    }).filter(area => area.id !== 'other' || area.habits.length > 0);
}
