import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import type { Habit } from '@/lib/habitsSQLite';
import { HEALTH_METRICS } from '@/lib/healthMetrics';

export type TrackingProgress =
    | { kind: 'health'; label: string; value: number; target: number; unit: string }
    | { kind: 'app'; value: number | null; target: number; quit: boolean }
    | { kind: 'place'; place: string; value: number | null; target: number };

/**
 * How far a habit that tracks itself is today: Apple Health's count against
 * the target (10,000 steps), the minutes in its apps against its time, or the
 * minutes at its place so far. Read now, every minute, and on coming back to
 * the app. Null for a habit ticked by hand.
 */
export function useTrackingProgress(habit: Habit | null): TrackingProgress | null {
    const [progress, setProgress] = useState<TrackingProgress | null>(null);
    useEffect(() => {
        if (!habit) return;
        let live = true;
        const read = async () => {
            const { getAppTime, appTimeProgress } = require('@/lib/appTime') as typeof import('@/lib/appTime');
            if (habit.healthKitMetric) {
                const { getHabitMeasurement, syncHealthKitData } = require('@/lib/habitsSQLite') as typeof import('@/lib/habitsSQLite');
                await syncHealthKitData().catch(() => 0);
                const target = habit.healthKitTarget || habit.goalValue || 1;
                const value = await getHabitMeasurement(habit.id, target).catch(() => 0);
                const label = HEALTH_METRICS.find(item => item.id === habit.healthKitMetric)?.label ?? 'Apple Health';
                if (live) setProgress({ kind: 'health', label, value, target, unit: habit.unit && habit.unit !== 'time' ? habit.unit : '' });
                return;
            }
            const minutes = (await getAppTime())[habit.id];
            if (minutes) {
                const value = await appTimeProgress(habit.id);
                if (live) setProgress({ kind: 'app', value, target: minutes, quit: habit.type === 'quit' });
                return;
            }
            const stay = habit.locationReminders?.find(place => place.trigger === 'stay');
            if (stay) {
                const { minutesHereFor } = require('@/lib/LocationService') as typeof import('@/lib/LocationService');
                const value = await minutesHereFor(habit.id).catch(() => null);
                if (live) setProgress({ kind: 'place', place: stay.name, value, target: stay.stayMinutes ?? 30 });
                return;
            }
            if (live) setProgress(null);
        };
        void read();
        const timer = setInterval(() => void read(), 60_000);
        const sub = AppState.addEventListener('change', state => { if (state === 'active') void read(); });
        return () => { live = false; clearInterval(timer); sub.remove(); };
    }, [habit]);
    return progress;
}
