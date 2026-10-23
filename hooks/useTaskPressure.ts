import { useEffect, useMemo, useState } from 'react';
import { useTasks } from '@/hooks/useTasks';
import { cachedDayWindow, cachedEchoConfig, DEFAULT_DAY, getEchoConfig, minutesOf } from '@/lib/echo';
import { localDateKey } from '@/lib/habitSchedule';
import { taskPressure, type TaskPressure } from '@/lib/taskPressure';

/**
 * How far behind on tasks you are right now (lib/taskPressure.ts), read again
 * every minute as the day goes, and whether demon mode is allowed
 * (Settings → Echo).
 */
export function useTaskPressure(): TaskPressure & { demonAllowed: boolean } {
    const tasks = useTasks();
    const [clock, setClock] = useState(() => new Date());
    const [demonAllowed, setDemonAllowed] = useState(() => cachedEchoConfig()?.demonMode !== false);
    useEffect(() => {
        const tick = () => {
            setClock(new Date());
            void getEchoConfig().then(config => setDemonAllowed(config.demonMode !== false)).catch(() => undefined);
        };
        tick();
        const timer = setInterval(tick, 60000);
        return () => clearInterval(timer);
    }, []);
    return useMemo(() => {
        const day = cachedDayWindow() ?? DEFAULT_DAY;
        const pressure = taskPressure(tasks, localDateKey(clock), clock.getHours() * 60 + clock.getMinutes(), { wake: minutesOf(day.wake), sleep: minutesOf(day.sleep) });
        return { ...pressure, demonAllowed };
    }, [tasks, clock, demonAllowed]);
}
