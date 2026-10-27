import { useCallback, useEffect, useMemo, useState } from 'react';
import { subscribeToHabits, type Habit } from '@/lib/habitsSQLite';
import { localDateKey } from '@/lib/habitSchedule';
import { buildGoalInsights, combineSeries, goalDoneOn, type GoalInsights, type GoalPoint } from '@/lib/goalInsights';
import { useData } from '@/hooks/useData';
import { useGoalLogs } from '@/hooks/useGoalLogs';
import type { Task } from '@/lib/tasks';

/** A goal that reached its target, and the day it did. */
export interface FinishedGoal { goal: Habit; insights: GoalInsights; on: string }

export interface GoalsData {
    /** Active goals (not archived, not yet reached), in the order the user has them. */
    goals: Habit[];
    /** Every goal reached, archived ones too, the latest first: the trophies. */
    finished: FinishedGoal[];
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
    const [loaded, setLoaded] = useState(false);
    // Ticks a screen has shown before the save comes back; the shared history
    // takes over as soon as it changes.
    const [optimistic, setOptimistic] = useState<Record<string, boolean>>({});
    const data = useData();
    const tasks = data.tasks;
    const today = localDateKey(new Date());

    useEffect(() => {
        let alive = true;
        const unsubscribe = subscribeToHabits(all => { if (alive) { setHabits(all); setLoaded(true); } });
        return () => { alive = false; unsubscribe.then(stop => stop()); };
    }, []);
    useEffect(() => { setOptimistic({}); }, [data.history, data.skips]);

    const completions = useMemo(() => {
        const done: Record<string, boolean> = {};
        for (const id of data.history[today] ?? []) done[id] = true;
        return { ...done, ...optimistic };
    }, [data.history, today, optimistic]);
    const skippedToday = useMemo(() => {
        const skipped: Record<string, boolean> = {};
        for (const id of data.skips[today] ?? []) skipped[id] = true;
        return skipped;
    }, [data.skips, today]);

    const setCompletion = useCallback((habitId: string, done: boolean) => {
        setOptimistic(prev => ({ ...prev, [habitId]: done }));
    }, []);

    const merged = useMemo(
        () => ({ ...data.history, [today]: Object.keys(completions).filter(id => completions[id]) }),
        [data.history, completions, today],
    );
    const mergedSkips = data.skips;
    // Progress written straight onto goals ("ran 4 km", "weighed 82 kg").
    const logs = useGoalLogs();
    const insightsById = useMemo(() => {
        const map: Record<string, GoalInsights> = {};
        // Archived goals too, so an archived goal's own page still opens.
        for (const goal of habits.filter(habit => habit.isGoal)) {
            map[goal.id] = buildGoalInsights({ goal, habits, tasks, history: merged, skips: mergedSkips, logs: logs[goal.id], today });
        }
        return map;
    }, [habits, tasks, merged, mergedSkips, logs, today]);

    const finished = useMemo(() => habits
        .filter(habit => habit.isGoal)
        .map(goal => ({ goal, insights: insightsById[goal.id], on: goalDoneOn(insightsById[goal.id]) }))
        .filter((item): item is FinishedGoal => !!item.on && !!item.insights)
        .sort((a, b) => b.on.localeCompare(a.on)), [habits, insightsById]);
    // A goal reached leaves the active lists: its card is done.
    const goals = useMemo(() => {
        const done = new Set(finished.map(item => item.goal.id));
        return habits.filter(habit => habit.isGoal && !habit.isArchived && !done.has(habit.id));
    }, [habits, finished]);

    const overall = goals.length
        ? Math.round(goals.reduce((sum, goal) => sum + (insightsById[goal.id]?.progress ?? 0), 0) / goals.length)
        : 0;
    const overallSeries = useMemo(
        () => combineSeries(goals.map(goal => insightsById[goal.id]?.series ?? [])),
        [goals, insightsById],
    );

    return {
        goals, finished, habits, tasks, insightsById, overall, overallSeries, completions, skippedToday, setCompletion, today,
        loaded: loaded && data.historyLoaded && data.tasksLoaded,
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
