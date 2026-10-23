import { useCallback } from 'react';
import { router } from 'expo-router';
import { nextStep, todayFlow } from '@/lib/todayFlow';

/**
 * Focusing all day: moves the focus page on to whatever comes next on today's
 * timeline, read fresh (lib/todayFlow.ts). A habit or task opens its focus,
 * started; a meal or event, or the free time before something at an exact
 * time, is a step of its own that ends when its time does. Nothing left: the
 * day's end.
 */
export function useFocusDay() {
    return useCallback(async (skip?: string) => {
        const now = new Date();
        const flow = await todayFlow(now).catch(() => null);
        const step = nextStep(flow, now.getHours() * 60 + now.getMinutes(), skip);
        if (!step) { router.replace({ pathname: '/(root)/focus', params: { day: '1', end: '1' } }); return; }
        const { item, wait } = step;
        if (wait || item.kind === 'meal' || item.kind === 'event') {
            router.replace({ pathname: '/(root)/focus', params: {
                day: '1', kind: wait && item.kind !== 'meal' && item.kind !== 'event' ? 'wait' : item.kind, id: item.id, title: item.title,
                from: String(item.start), until: String(wait && (item.kind === 'habit' || item.kind === 'task') ? item.start : item.end), nextKind: item.kind,
            } });
            return;
        }
        router.replace({ pathname: '/(root)/focus', params: { day: '1', kind: item.kind, id: item.id, title: item.title, start: '1' } });
    }, []);
}
