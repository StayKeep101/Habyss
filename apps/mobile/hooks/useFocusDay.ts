import { useCallback } from 'react';
import { router } from 'expo-router';
import { currentTodayFlow, nextStep } from '@/lib/todayFlow';

/**
 * Focusing all day: moves the focus page on to whatever comes next on today's
 * timeline, read fresh (lib/todayFlow.ts). A habit or task opens its focus,
 * started; a meal or event, or the free time before something at an exact
 * time, is a step of its own that ends when its time does. Nothing left: the
 * day's end.
 */
/** One move at a time: the timer running out and Next pressed together must not move twice. */
let moving = false;

/**
 * The focus page shows the next step in place: its params change and the
 * screen redraws, with no navigation. router.replace pushed a fresh copy of
 * the page, which iOS animates as the page closing and another opening.
 * Every param is given, so nothing from the last step lingers.
 */
type FocusParams = { day?: string; end?: string; kind?: string; id?: string; title?: string; from?: string; until?: string; nextKind?: string; start?: string; banked?: string; minutes?: string };
export function showFocusStep(params: FocusParams): void {
    const all: FocusParams = { day: undefined, end: undefined, kind: undefined, id: undefined, title: undefined, from: undefined, until: undefined, nextKind: undefined, start: undefined, banked: undefined, minutes: undefined, ...params };
    router.setParams(all as never);
}

export function useFocusDay() {
    return useCallback(async (skip?: string) => {
        if (moving) return;
        moving = true;
        setTimeout(() => { moving = false; }, 1500);
        const now = new Date();
        // The timeline you see (lib/todayFlow.ts), so Focus opens on what it shows as now.
        const flow = await currentTodayFlow(now).catch(() => null);
        const step = nextStep(flow, now.getHours() * 60 + now.getMinutes(), skip);
        if (!step) { showFocusStep({ day: '1', end: '1' }); return; }
        const { item, wait } = step;
        if (wait || item.kind === 'meal' || item.kind === 'event') {
            showFocusStep({
                day: '1', kind: wait && item.kind !== 'meal' && item.kind !== 'event' ? 'wait' : item.kind, id: item.id, title: item.title,
                from: String(item.start), until: String(wait && (item.kind === 'habit' || item.kind === 'task') ? item.start : item.end), nextKind: item.kind,
            });
            return;
        }
        showFocusStep({ day: '1', kind: item.kind, id: item.id, title: item.title, start: '1' });
    }, []);
}
