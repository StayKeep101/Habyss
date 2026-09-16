import type { Habit } from './habitsSQLite';
import { isHabitScheduledForDate, localDateKey } from './habitSchedule';

export interface HabitReminder { habit: Habit; date: Date; scheduledDate: string; }

/** A rolling, globally ordered queue; reserve native notification capacity for timers. */
export function buildHabitReminderPlan(habits: Habit[], now = new Date(), completedToday: Record<string, boolean> = {}, limit = 48): HabitReminder[] {
    const plan: HabitReminder[] = [];
    const today = localDateKey(now);
    for (const habit of habits) {
        if (habit.isGoal || habit.isArchived || !habit.reminders?.length) continue;
        for (let offset = 0; offset <= 400; offset++) {
            const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, 12);
            const scheduledDate = localDateKey(day);
            if (!isHabitScheduledForDate(habit, day) || (scheduledDate === today && completedToday[habit.id])) continue;
            for (const time of new Set(habit.reminders)) {
                if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) continue;
                const [hour, minute] = time.split(':').map(Number);
                const date = new Date(day); date.setHours(hour, minute, 0, 0);
                date.setMinutes(date.getMinutes() - Math.max(0, habit.reminderOffset || 0));
                if (date.getTime() > now.getTime()) plan.push({ habit, date, scheduledDate });
            }
        }
    }
    return plan.sort((a, b) => a.date.getTime() - b.date.getTime() || a.habit.id.localeCompare(b.habit.id)).slice(0, Math.max(0, limit));
}
