import type { PersonalityModeId } from '@/constants/AIPersonalities';
import type { DayWindow } from './echo';
import { minutesOf } from './echo';
import type { ScheduledMoment } from './scheduledMoments';

export interface AliveReminder {
    id: string; date: Date; phase: 'before' | 'follow-up'; moment: ScheduledMoment;
    title: string; body: string;
}

const awake = (date: Date, window: DayWindow) => {
    const minutes = date.getHours() * 60 + date.getMinutes();
    const wake = minutesOf(window.wake), sleep = minutesOf(window.sleep);
    return wake === sleep || (wake < sleep ? minutes >= wake && minutes < sleep : minutes >= wake || minutes < sleep);
};

export function aliveLine(moment: ScheduledMoment, phase: AliveReminder['phase'], voice: PersonalityModeId, name?: string) {
    const who = name ? `${name}, ` : '';
    const title = phase === 'before' ? 'Echo · You’re up in 10' : 'Echo · Checking in';
    const item = `“${moment.title}”`;
    const before: Record<PersonalityModeId, string[]> = {
        friendly: [`${who}${item} starts in 10 minutes. Get ready; the first small step is enough. I’m cheering you on.`, `${who}a little heads-up: ${item} in 10. You made room for yourself today. Let’s use it.`],
        normal: [`${who}${item} starts in 10 minutes. Set up what you need and give yourself an easy start.`],
        dad_mode: [`${who}${item} in 10. You made a plan. Get ready, start small, and give yourself a chance to keep it.`],
        bully_mode: [`${who}${item} in 10. Future you called: less negotiating, more getting ready. You’ve got this.`],
    };
    const after: Record<PersonalityModeId, string[]> = {
        friendly: [`${who}how did ${item} go? I haven’t seen a check-in yet. Already done? Mark it off. If plans changed, a smaller step still counts.`, `${who}checking in on ${item}. No check-in yet—did life get in the way? You can take a small step or make a fresh plan.`],
        normal: [`${who}${item} is still unchecked. Finished already? Log it. Otherwise, choose a smaller step or reschedule.`],
        dad_mode: [`${who}how’s ${item} going? I haven’t seen it checked off. No guilt—tell the app what happened, then make your next move.`],
        bully_mode: [`${who}${item} is still unchecked. Did you finish and forget the victory lap? Log it—or make the next five minutes count.`],
    };
    const bank = (phase === 'before' ? before : after)[voice] ?? (phase === 'before' ? before.normal : after.normal);
    const seed = [...moment.key].reduce((sum, letter) => sum + letter.charCodeAt(0), 0);
    return { title, body: bank[seed % bank.length] };
}

/** Two bounded nudges, never during quiet hours or repeatedly on an overdue item. */
export function buildAlivePlan(moments: ScheduledMoment[], now: Date, window: DayWindow, voice: PersonalityModeId,
    options: { followUp: boolean; useName: boolean; name?: string; limit?: number }) {
    const plan: AliveReminder[] = [];
    for (const moment of moments) {
        const phases: AliveReminder['phase'][] = options.followUp ? ['before', 'follow-up'] : ['before'];
        for (const phase of phases) {
            const date = new Date(phase === 'before' ? moment.start.getTime() - 10 * 60000 : moment.end.getTime() + 15 * 60000);
            if (date <= now || !awake(date, window)) continue;
            const line = aliveLine(moment, phase, voice, options.useName ? options.name : undefined);
            plan.push({ id: `echo-alive:${moment.key}:${phase}`, date, phase, moment, ...line });
        }
    }
    return plan.sort((a, b) => a.date.getTime() - b.date.getTime() || a.id.localeCompare(b.id)).slice(0, options.limit ?? 48);
}
