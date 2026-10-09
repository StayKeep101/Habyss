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

/** Verbs a habit or task name usually starts with, so it can be said as an action. */
const VERBS = new Set(['go', 'read', 'run', 'write', 'call', 'meditate', 'study', 'walk', 'drink', 'do', 'finish', 'send',
    'work', 'practice', 'practise', 'stretch', 'journal', 'clean', 'cook', 'train', 'pray', 'eat', 'take', 'make', 'learn',
    'review', 'plan', 'pack', 'lift', 'swim', 'bike', 'cycle', 'pay', 'email', 'text', 'build', 'ship', 'post', 'record',
    'practise', 'play', 'draw', 'paint', 'sleep', 'wake', 'brush', 'floss', 'visit', 'fix', 'prepare', 'prep', 'book', 'buy']);

/**
 * A name as something you do: "Go to the gym" stays a verb phrase ("go to the
 * gym"), and "Gym" becomes "your gym" — so a line can ask "Did you go to the
 * gym yet?" the way a friend would text it, instead of quoting a title.
 */
export function asAction(title: string): { verb: boolean; phrase: string } {
    const clean = title.trim();
    const first = clean.split(/\s+/)[0]?.toLowerCase() ?? '';
    if (VERBS.has(first)) return { verb: true, phrase: clean.charAt(0).toLowerCase() + clean.slice(1) };
    return { verb: false, phrase: clean };
}

const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * What Echo texts you, before and after something you planned.
 *
 * Written like a message from a person: from Echo, one short line, the thing
 * named the way you would say it — not a title in quotation marks with a
 * heading over it.
 */
export function aliveLine(moment: ScheduledMoment, phase: AliveReminder['phase'], voice: PersonalityModeId, name?: string) {
    const { verb, phrase } = asAction(moment.title);
    const hey = name ? `${name}, ` : '';
    const did = verb ? `did you ${phrase} yet` : `is ${phrase} done yet`;
    const soon = `${capital(phrase)} in 10 minutes`;
    const before: Record<PersonalityModeId, string[]> = {
        friendly: [`${capital(hey + phrase)} in 10 minutes. You've got this 💙`, `${soon}. Small start, that's all it takes ✨`],
        normal: [`${soon}.`, `${soon}. Get set up.`],
        dad_mode: [`${soon}. Get ready.`, `${soon}. No excuses.`],
        bully_mode: [`${soon}. Get your ass up.`, `${soon}. Move it.`],
    };
    const after: Record<PersonalityModeId, string[]> = {
        friendly: [`${capital(hey + did)}? Even five minutes counts 💙`, `${capital(hey + did)}? If it's done, tick it off 🙌`],
        normal: [`${capital(hey + did)}?`, `${capital(hey + did)}? Log it when it is.`],
        dad_mode: [`${capital(hey + did)}? I expect it done today.`, `${capital(hey + did)}? You said you would.`],
        bully_mode: [`${capital(hey + did)}, or are you scrolling again?`, `${capital(hey)}why the hell is this still not done? ${capital(did)}?`],
    };
    const bank = (phase === 'before' ? before : after)[voice] ?? (phase === 'before' ? before.normal : after.normal);
    const seed = [...moment.key].reduce((sum, letter) => sum + letter.charCodeAt(0), 0);
    return { title: 'Echo', body: bank[seed % bank.length] };
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
