import { useEffect, useMemo, useState } from 'react';
import { useFocusRecords } from '@/hooks/useFocusRecords';
import { useWeekStart } from '@/hooks/useWeekStart';
import { useTasks } from '@/hooks/useTasks';
import { useDailyTarget } from '@/hooks/useDailyFocus';
import { useGoalsInsights } from '@/hooks/useGoalInsights';
import { weekSoFar } from '@/lib/focusStats';
import { focusHistory, focusInsights } from '@/lib/dailyFocus';
import { startOfWeek } from '@/lib/weekStart';
import { localDateKey } from '@/lib/habitSchedule';
import { loadSamples } from '@/lib/learnedLength';
import { averageSleepHours, hoursOf, planRatio, topRateNote } from '@/lib/weekNumbers';

export interface WeekNumbers {
    /** Hours focused this week, and the change against the same days last week. */
    focusHours: number;
    focusChange: number;
    /** Days this week the top 3 (or 5) were done, as a share; null before any day has counted. */
    topRate: number | null;
    topNote: 'Plan less' | 'Plan more' | null;
    /** Average progress across active goals; null with no goals. */
    goals: number | null;
    /** Average hours asleep this week; null without Apple Health. */
    sleep: number | null;
    /** Time taken against time planned (1.4 = 40% longer); null with too little to go on. */
    plan: number | null;
}

/**
 * This week's five numbers, each from the one place the app already counts it:
 * focus from the focus records, the top 3 from lib/dailyFocus, goals from
 * goalInsights, sleep from Apple Health (only when it is already connected, so
 * opening Progress never asks for it) and planned-vs-actual from the lengths
 * the timeline learns (lib/learnedLength).
 */
export function useWeekNumbers(): WeekNumbers {
    const records = useFocusRecords();
    const weekStartPref = useWeekStart();
    const tasks = useTasks();
    const target = useDailyTarget();
    const { goals, overall, today } = useGoalsInsights();
    const weekStart = useMemo(() => localDateKey(startOfWeek(new Date(`${today}T12:00:00`), weekStartPref)), [today, weekStartPref]);

    const focus = useMemo(() => weekSoFar(records, today, weekStart), [records, today, weekStart]);
    const top = useMemo(() => {
        const days = Math.round((new Date(`${today}T12:00:00`).getTime() - new Date(`${weekStart}T12:00:00`).getTime()) / 86400000) + 1;
        const history = focusHistory(tasks, target, days, today);
        // Today counts once it is won; until then it is still being played.
        const counted = history.at(-1)?.hit ? history : history.slice(0, -1);
        if (!counted.length) return { rate: null, note: null };
        const { rate } = focusInsights(counted);
        return { rate, note: topRateNote(rate, counted.length) };
    }, [tasks, target, today, weekStart]);

    const [plan, setPlan] = useState<number | null>(null);
    const [sleep, setSleep] = useState<number | null>(null);
    useEffect(() => {
        let alive = true;
        void loadSamples().then(samples => { if (alive) setPlan(planRatio(samples, weekStart, today)); }).catch(() => undefined);
        void (async () => {
            const { HealthKitService } = require('@/lib/HealthKitService') as typeof import('@/lib/HealthKitService');
            if (!HealthKitService.isAvailable || !(await HealthKitService.authorised().catch(() => false))) return;
            const { readHealth } = require('@/lib/healthMetrics') as typeof import('@/lib/healthMetrics');
            const nights: Date[] = [];
            for (let day = new Date(`${weekStart}T12:00:00`); localDateKey(day) <= today; day.setDate(day.getDate() + 1)) nights.push(new Date(day));
            const minutes = await Promise.all(nights.map(night => readHealth('sleep', night)));
            if (alive) setSleep(averageSleepHours(minutes));
        })().catch(() => undefined);
        return () => { alive = false; };
    }, [weekStart, today]);

    return {
        focusHours: hoursOf(focus.week),
        focusChange: hoursOf(focus.change),
        topRate: top.rate,
        topNote: top.note,
        goals: goals.length ? Math.round(overall) : null,
        sleep,
        plan,
    };
}
