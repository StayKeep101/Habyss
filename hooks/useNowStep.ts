import { useEffect, useState } from 'react';
import { onAny } from '@/lib/appEvents';
import type { DayStep } from '@/lib/todayFlow';

/**
 * What today's timeline has now (else next): the same step Focus opens on.
 * Read again the moment the one on now ends or the next one begins (so the day
 * moves on with the clock, done or not), every minute besides, and
 * whenever a habit or task changes.
 */
export function useNowStep(): DayStep | null {
    const [step, setStep] = useState<DayStep | null>(null);
    useEffect(() => {
        let alive = true;
        let edge: ReturnType<typeof setTimeout> | undefined;
        const read = async () => {
            const { currentTodayFlow, nextStep } = require('@/lib/todayFlow') as typeof import('@/lib/todayFlow');
            const now = new Date();
            const minute = now.getHours() * 60 + now.getMinutes();
            const flow = await currentTodayFlow(now).catch(() => null);
            if (!alive) return;
            const found = nextStep(flow, minute);
            setStep(found);
            // Next change of step: when the one on now ends, or the next one starts.
            if (edge) clearTimeout(edge);
            if (found) {
                const boundary = found.item.start > minute ? found.item.start : found.item.end;
                const midnight = new Date(now); midnight.setHours(0, 0, 0, 0);
                const wait = midnight.getTime() + boundary * 60_000 - now.getTime() + 500;
                if (wait > 0 && wait < 6 * 3600_000) edge = setTimeout(() => void read(), wait);
            }
        };
        void read();
        // The edges are timed exactly (above); this only catches what changed elsewhere.
        const timer = setInterval(() => void read(), 60_000);
        const off = onAny(['tasks_changed', 'habit_completion_updated', 'habit_updated', 'habit_created', 'habit_deleted'], () => void read());
        // The timeline's memory changed (missed ones fitted in): read once the line has been laid out again.
        let soon: ReturnType<typeof setTimeout> | undefined;
        const { subscribeMemory } = require('@/lib/dayMemory') as typeof import('@/lib/dayMemory');
        const offMemory = subscribeMemory(() => { if (soon) clearTimeout(soon); soon = setTimeout(() => void read(), 150); });
        return () => { alive = false; clearInterval(timer); if (edge) clearTimeout(edge); if (soon) clearTimeout(soon); off(); offMemory(); };
    }, []);
    return step;
}
