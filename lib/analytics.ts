import { Habit } from './habits';

export interface AdvancedStats {
    consistencyScore: number;
    allTimeCompletionRate: number;
    perfectDays: number;
    totalHabitsCompleted: number;
    totalTimeInvestedMinutes: number;
    averageHabitsPerDay: number;
    habitScore: number;
    habitAge: number;
}

export const Analytics = {
    /**
     * Calculate comprehensive statistics from raw data
     */
    calculateStats(
        habits: Habit[],
        dailyHistory: { date: string; completedIds: string[] }[]
    ): AdvancedStats {
        if (!habits.length || !dailyHistory.length) {
            return {
                consistencyScore: 0,
                allTimeCompletionRate: 0,
                perfectDays: 0,
                totalHabitsCompleted: 0,
                totalTimeInvestedMinutes: 0,
                averageHabitsPerDay: 0,
                habitScore: 0,
                habitAge: 0
            };
        }

        const totalDays = dailyHistory.length;
        let totalCompletions = 0;
        let perfectDays = 0;
        let totalTime = 0;

        dailyHistory.forEach(day => {
            const count = day.completedIds.length;
            totalCompletions += count;
            if (count >= habits.length && habits.length > 0) {
                perfectDays++;
            }
        });

        // Calculate time invested (assume 15 min avg per habit completion for timed habits)
        habits.forEach(h => {
            if (h.durationMinutes) {
                totalTime += totalCompletions * (h.durationMinutes || 15);
            }
        });

        const avgCompletionsPerDay = totalDays > 0 ? totalCompletions / totalDays : 0;
        const possibleCompletions = habits.length * totalDays;
        const consistencyScore = possibleCompletions > 0
            ? Math.round((totalCompletions / possibleCompletions) * 100)
            : 0;

        // Habit Age: days since first habit was created
        const ages = habits.map(h => {
            const created = new Date(h.startDate);
            const now = new Date();
            return Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
        });
        const avgAge = ages.length > 0 ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length) : 0;

        // Habit Score (Gamification)
        const habitScore = Math.min(100, Math.round(
            (consistencyScore * 0.4) +
            (perfectDays * 2) +
            (Math.min(totalCompletions, 100) * 0.3)
        ));

        return {
            consistencyScore,
            allTimeCompletionRate: consistencyScore,
            perfectDays,
            totalHabitsCompleted: totalCompletions,
            totalTimeInvestedMinutes: totalTime,
            averageHabitsPerDay: parseFloat(avgCompletionsPerDay.toFixed(1)),
            habitScore,
            habitAge: avgAge
        };
    }
};
