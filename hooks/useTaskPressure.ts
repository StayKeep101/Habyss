import { useEffect, useMemo, useState } from 'react';
import { useTasks } from '@/hooks/useTasks';
import { cachedDayWindow, DEFAULT_DAY, minutesOf } from '@/lib/echo';
import { localDateKey } from '@/lib/habitSchedule';
import { taskPressure, type TaskPressure } from '@/lib/taskPressure';

/**
 * How far behind on tasks you are right now (lib/taskPressure.ts), read again
 * every minute as the day goes. Demon mode is gone: Echo goes no further than
 * alarmed, and the screen's edge never turns red (`demonAllowed` is always false).
 */
export function useTaskPressure(): TaskPressure & { demonAllowed: boolean } {
    const tasks = useTasks();
    const [clock, setClock] = useState(() => new Date());
    const demonAllowed = false;
    useEffect(() => {
        const tick = () => { setClock(new Date()); };
        tick();
        const timer = setInterval(tick, 60000);
        return () => clearInterval(timer);
    }, []);
    return useMemo(() => {
        const day = cachedDayWindow() ?? DEFAULT_DAY;
        const pressure = taskPressure(tasks, localDateKey(clock), clock.getHours() * 60 + clock.getMinutes(), { wake: minutesOf(day.wake), sleep: minutesOf(day.sleep) });
        // Never past alarmed (3): no demon.
        return { ...pressure, level: Math.min(3, pressure.level) as TaskPressure['level'], demonAllowed };
    }, [tasks, clock, demonAllowed]);
}
