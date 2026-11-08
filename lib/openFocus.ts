import type { FlowItem } from './dayFlow';

/**
 * Every way into Focus goes through here, so it is the same Focus wherever it
 * is opened from (the + , the bar over the tab bar, the Now card, a task's
 * button, a notification): the day mode, which moves on through the timeline
 * when a thing is done or its time is up.
 *
 * With a habit or task: focus on it. With nothing: what the timeline has now
 * (or next), the same thing the bar over the tab bar shows.
 */
export async function openFocus(target?: { kind: string; id: string; title: string; minutes?: number }): Promise<void> {
    const { router } = require('expo-router') as typeof import('expo-router');
    let to = target;
    if (!to) {
        const { currentTodayFlow, nextStep } = require('./todayFlow') as typeof import('./todayFlow');
        const now = new Date();
        const step = nextStep(await currentTodayFlow(now).catch(() => null), now.getHours() * 60 + now.getMinutes());
        if (step && (step.item.kind === 'habit' || step.item.kind === 'task')) to = { kind: step.item.kind, id: step.item.id, title: step.item.title };
    }
    if (!to) { router.push('/(root)/focus?day=1' as never); return; }
    router.push({ pathname: '/(root)/focus', params: { day: '1', start: '1', kind: to.kind, id: to.id, title: to.title, ...(to.minutes ? { minutes: String(to.minutes) } : null) } } as never);
}

/** A step of the day as Focus opens it: a habit or task directly, a meal or event as its block. */
export function openFocusOn(item: Pick<FlowItem, 'kind' | 'id' | 'title' | 'start' | 'end'>): void {
    if (item.kind === 'habit' || item.kind === 'task') { void openFocus({ kind: item.kind, id: item.id, title: item.title }); return; }
    const { router } = require('expo-router') as typeof import('expo-router');
    router.push({ pathname: '/(root)/focus', params: { day: '1', kind: item.kind, id: item.id, title: item.title, from: String(item.start), until: String(item.end), nextKind: item.kind } } as never);
}
