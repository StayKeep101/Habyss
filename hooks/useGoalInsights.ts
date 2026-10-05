import { useCallback, useEffect, useMemo, useState } from 'react';
import { getCompletions, getLastNDaysCompletions, getSkipped, subscribeToHabits, type Habit } from '@/lib/habitsSQLite';
import { localDateKey } from '@/lib/habitSchedule';
import { buildGoalInsights, combineSeries, daysBetween, goalRange, type GoalInsights, type GoalPoint } from '@/lib/goalInsights';
import { useTasks } from '@/hooks/useTasks';
import type { Task } from '@/lib/tasks';
import { on } from '@/lib/appEvents';

export interface GoalsData {
    /** Active goals, in the order the user has them. */
    goals: Habit[];
    habits: Habit[];
    tasks: Task[];
    insightsById: Record<string, GoalInsights>;
    /** Every goal's progress averaged: the number on the Home progress bar. */
    overall: number;
    /** Every goal's line averaged day by day, for the overview chart. */
    overallSeries: GoalPoint[];
    /** Today's check-ins, kept current as habits are ticked anywhere. */
    completions: Record<string, boolean>;
    /** Habits deliberately skipped today. */
    skippedToday: Record<string, boolean>;
    setCompletion: (habitId: string, done: boolean) => void;
    today: string;
    loaded: boolean;
    /** Completed habit ids by day, today included. */
    history: Record<string, string[]>;
    /** Skipped habit ids by day, today included. */
    skips: Record<string, string[]>;
}

/**
 * All goals, their habits, tasks and check-in history, and the insights built
 * from them. Home, the goals overview, and each goal's page, stats and roadmap
 * read from this, so a goal shows the same number everywhere.
 */
export function useGoalsInsights(): GoalsData {
    const [habits, setHabits] = useState<Habit[]>([]);
    const [completions, setCompletions] = useState<Record<string, boolean>>({});
    const [history, setHistory] = useState<Record<string, string[]>>({});
    const [skips, setSkips] = useState<Record<string, string[]>>({});
    const [skippedToday, setSkippedToday] = useState<Record<string, boolean>>({});
    const [historyVersion, setHistoryVersion] = useState(0);
    const [loaded, setLoaded] = useState(false);
    const tasks = useTasks();
    const today = localDateKey(new Date());

    const goals = useMemo(() => habits.filter(habit => habit.isGoal && !habit.isArchived), [habits]);

    useEffect(() => {
        let alive = true;
        const unsubscribe = subscribeToHabits(all => { if (alive) { setHabits(all); setLoaded(true); } });
        getCompletions(today).then(done => { if (alive) setCompletions(done); }).catch(() => undefined);
        getSkipped(today).then(skipped => { if (alive) setSkippedToday(skipped); }).catch(() => undefined);
        const subs = [
            on('habit_completion_updated', ({ habitId, date, completed, skipped }) => {
                // A bulk change names neither row nor day; re-read rather than patch.
                if (!habitId || date !== localDateKey(new Date())) { setHistoryVersion(version => version + 1); return; }
                setCompletions(prev => ({ ...prev, [habitId]: completed === true }));
                setSkippedToday(prev => {
                    const next = { ...prev };
                    if (skipped) next[habitId] = true; else delete next[habitId];
                    return next;
                });
            }),
            // A restore brings back past check-ins too.
            on('cloud_restored', () => {
                getCompletions(localDateKey(new Date())).then(done => { if (alive) setCompletions(done); }).catch(() => undefined);
                setHistoryVersion(version => version + 1);
            }),
        ];
        return () => { alive = false; unsubscribe.then(stop => stop()); subs.forEach(sub => sub.remove()); };
    }, [today]);

    // Include archived goals and habits older than their goal, so charts and
    // lifetime streaks keep the complete history.
    const earliestStart = useMemo(
        () => habits.map(habit => goalRange(habit, today).start).sort()[0] ?? null,
        [habits, today],
    );
    useEffect(() => {
        if (!earliestStart) return;
        let alive = true;
        const days = Math.max(30, daysBetween(earliestStart, today) + 1);
        getLastNDaysCompletions(days)
            .then(rows => {
                if (!alive) return;
                const map: Record<string, string[]> = {};
                const skipped: Record<string, string[]> = {};
                rows.forEach(row => {
                    map[row.date] = row.completedIds;
                    if (row.skippedIds?.length) skipped[row.date] = row.skippedIds;
                });
                setHistory(map);
                setSkips(skipped);
            })
            .catch(() => undefined);
        return () => { alive = false; };
    }, [earliestStart, today, historyVersion]);

    const setCompletion = useCallback((habitId: string, done: boolean) => {
        setCompletions(prev => ({ ...prev, [habitId]: done }));
    }, []);

    const merged = useMemo(
        () => ({ ...history, [today]: Object.keys(completions).filter(id => completions[id]) }),
        [history, completions, today],
    );
    const mergedSkips = useMemo(
        () => ({ ...skips, [today]: Object.keys(skippedToday).filter(id => skippedToday[id]) }),
        [skips, skippedToday, today],
    );
    const insightsById = useMemo(() => {
        const map: Record<string, GoalInsights> = {};
        // Archived goals too, so an archived goal's own page still opens.
        for (const goal of habits.filter(habit => habit.isGoal)) {
            map[goal.id] = buildGoalInsights({ goal, habits, tasks, history: merged, skips: mergedSkips, today });
        }
        return map;
    }, [habits, tasks, merged, mergedSkips, today]);

    const overall = goals.length
        ? Math.round(goals.reduce((sum, goal) => sum + (insightsById[goal.id]?.progress ?? 0), 0) / goals.length)
        : 0;
    const overallSeries = useMemo(
        () => combineSeries(goals.map(goal => insightsById[goal.id]?.series ?? [])),
        [goals, insightsById],
    );

    return {
        goals, habits, tasks, insightsById, overall, overallSeries, completions, skippedToday, setCompletion, today, loaded,
        history: merged, skips: mergedSkips,
    };
}

export interface GoalData {
    goal: Habit | null;
    habits: Habit[];
    tasks: Task[];
    completions: Record<string, boolean>;
    skippedToday: Record<string, boolean>;
    setCompletion: (habitId: string, done: boolean) => void;
    insights: GoalInsights | null;
    today: string;
    loaded: boolean;
}

/** One goal, read from the same source as every other goal screen. */
export function useGoalInsights(goalId: string | undefined): GoalData {
    const data = useGoalsInsights();
    const goal = data.habits.find(item => item.id === goalId && item.isGoal) ?? null;
    return {
        goal,
        habits: data.habits,
        tasks: data.tasks,
        completions: data.completions,
        skippedToday: data.skippedToday,
        setCompletion: data.setCompletion,
        insights: goal ? data.insightsById[goal.id] ?? null : null,
        today: data.today,
        loaded: data.loaded,
    };
}
