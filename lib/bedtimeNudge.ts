import type { PersonalityModeId } from '@/constants/AIPersonalities';
import { isNight } from './bedtimeLock';

/**
 * Still in Habyss past bedtime: Echo's line on Home says so, in the chosen
 * voice. The first line as soon as bedtime passes, then one every quarter of
 * an hour, getting firmer the later it gets. Never the same line twice in a
 * row. Pure.
 */
export const NUDGE_EVERY_MS = 15 * 60 * 1000;

const toMinute = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return (h || 0) * 60 + (m || 0); };

/** Minutes since bedtime, or null when it is not the night. */
export function minutesPastBedtime(now: Date, day: { wake: string; sleep: string }): number | null {
    const minute = now.getHours() * 60 + now.getMinutes();
    const [wake, sleep] = [toMinute(day.wake), toMinute(day.sleep)];
    if (!isNight(minute, wake, sleep)) return null;
    return (minute - sleep + 1440) % 1440;
}

type Stage = 'just' | 'late' | 'very';
const stageOf = (past: number): Stage => (past < 30 ? 'just' : past < 90 ? 'late' : 'very');

const LINES: Record<'warm' | 'plain' | 'tough' | 'funny', Record<Stage, string[]>> = {
    warm: {
        just: ["It's bedtime. Tomorrow's you will thank you for stopping here.", 'That was a good day. Let it end on time.', "Phone down soon? You've earned the sleep."],
        late: ["Still up? Let's call it. Everything here will keep till morning.", "Your plan for tomorrow is set. The only thing left is sleep.", "Half an hour past bedtime. Be kind to tomorrow's you."],
        very: ["It's really late. Whatever it is, it's smaller after sleep.", 'Sleep is the habit that makes all the others easier. Go.', "Nothing on this screen beats eight hours. Goodnight."],
    },
    plain: {
        just: ["Bedtime. Close the app; the plan's saved.", "That's the day. Time to sleep.", 'Bedtime passed. Wind down now.'],
        late: ["You're past bedtime. Tomorrow starts tired from here.", "Every 15 minutes now comes out of tomorrow's focus.", 'Planning is done. Sleep is the next task.'],
        very: ["It's very late. Sleep now and tomorrow is still winnable.", 'Short nights cost you habits. Your own record says so.', 'Put the phone down. Now.'],
    },
    tough: {
        just: ["Bedtime. Phone down. That's an order.", 'Day is over. Discipline includes stopping.', "You set this bedtime. Keep your word."],
        late: ["You're still here? Tomorrow you'll pay for this.", 'Champions sleep. Scrollers lose. Pick.', 'Thirty minutes late. Stop negotiating with yourself.'],
        very: ['This is how streaks die. Go to bed.', 'Nothing good happens on a phone at this hour.', 'Lights off. No excuses.'],
    },
    funny: {
        just: ["Bedtime. Even your phone wants a break, and it's literally a phone.", 'The day is closed. Please exit through the pillow.', "Sleep is free. You're not using it. Weird flex."],
        late: ['Still awake? Your bed is filing a missing person report.', "Bold of you to assume tomorrow's you agreed to this.", 'Fun fact: nothing productive has ever happened at this hour. Probably.'],
        very: ["It's so late the owls are judging you.", "At this point you're not up late, you're up early. Wrong direction.", 'Goodnight. I mean it. I will keep saying it.'],
    },
};

const voiceOf = (personality: PersonalityModeId): keyof typeof LINES =>
    personality === 'friendly' ? 'warm' : personality === 'dad_mode' || personality === 'bully_mode' ? 'tough' : personality === 'goofball' ? 'funny' : 'plain';

/** What Echo says this time: by how late it is and the voice, never the line said last. */
export function bedtimeLine(past: number, personality: PersonalityModeId, last: string | null, random: () => number = Math.random): string {
    const pool = LINES[voiceOf(personality)][stageOf(past)].filter(line => line !== last);
    return pool[Math.floor(random() * pool.length) % pool.length];
}

/** Whether to say one now: it is the night, and the last one was long enough ago. */
export function nudgeDue(now: Date, day: { wake: string; sleep: string }, lastAt: number | null): boolean {
    if (minutesPastBedtime(now, day) === null) return false;
    return lastAt === null || now.getTime() - lastAt >= NUDGE_EVERY_MS;
}
