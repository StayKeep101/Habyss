import type { PersonalityModeId } from '@/constants/AIPersonalities';
import type { MemoryNote, HelpType } from './echoMemory';

/**
 * What makes Echo read like a person rather than a dashboard. Pure, so it is
 * tested without a phone.
 *
 * - Numbers become words: a coach says "half an hour", not "31 minutes";
 *   "a couple more", not "2 more"; "about halfway", not "47%".
 * - A one-word name is quoted, so "“Hello” is due today" reads as a name and
 *   not as a greeting.
 * - Callbacks: what you told Echo, what helped you before, how long you were
 *   away — the things only someone who knows you would bring up.
 * - Short reactions and questions, so not every line has the same shape.
 * - Opinions Echo holds for good: the same ones, week after week.
 * - A human minute: notifications land at 7:43, not on the hour.
 */

const SMALL = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];

/** "three" for 3, digits past twelve: small counts read better as words. */
export const numberWord = (count: number): string => (count >= 0 && count < SMALL.length ? SMALL[count] : String(count));

/** "third" for 3: a place on a leaderboard, said the way people say it. */
export function ordinal(place: number): string {
    const words = ['zeroth', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];
    if (place >= 0 && place < words.length) return words[place];
    const tail = place % 100 >= 11 && place % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[place % 10] ?? 'th';
    return `${place}${tail}`;
}

/** Minutes as a person would round them: "a few minutes", "half an hour", "over an hour". */
export function roughMinutes(minutes: number): string {
    const m = Math.max(0, Math.round(minutes));
    if (m < 2) return 'a minute';
    if (m < 8) return 'a few minutes';
    if (m < 13) return 'about ten minutes';
    if (m < 18) return 'about fifteen minutes';
    if (m < 25) return 'about twenty minutes';
    if (m < 38) return 'half an hour';
    if (m < 52) return 'the best part of an hour';
    if (m < 70) return 'an hour';
    if (m < 100) return 'over an hour';
    if (m < 150) return 'a couple of hours';
    if (m < 300) return 'hours';
    return 'most of the day';
}

/** How far through something is, in words: "barely started", "about halfway", "nearly there". */
export function roughShare(percent: number): string {
    const p = Math.max(0, Math.min(100, percent));
    if (p === 0) return 'not started';
    if (p < 15) return 'barely started';
    if (p < 35) return 'about a quarter of the way';
    if (p < 60) return 'about halfway';
    if (p < 85) return 'most of the way';
    if (p < 100) return 'nearly there';
    return 'done';
}

/** "a couple more" for 2: what is left besides the one named. */
export function roughMore(count: number): string {
    if (count <= 0) return '';
    if (count === 1) return 'one more';
    if (count === 2) return 'a couple more';
    if (count <= 4) return 'a few more';
    return 'a pile more';
}

/** How far apart two scores are, as a person would put it: "a bit", "well", "way". */
export function roughGap(points: number): string {
    const gap = Math.abs(points);
    if (gap < 8) return 'just';
    if (gap < 25) return 'a bit';
    if (gap < 50) return 'well';
    return 'way';
}

/** A one-word name is quoted, so "Hello" or "Read" reads as the thing's name, not a word in the sentence. */
export function named(title: string): string {
    const clean = title.trim();
    if (!clean || /\s/.test(clean) || /^[“"']/.test(clean)) return clean;
    return `“${clean}”`;
}

/* ------------------------------------------------------------ character */

/**
 * Echo's opinions, held for good. People recognise a person by the views
 * that do not change; these come back now and then, in each voice.
 */
export const OPINIONS: Record<PersonalityModeId, string[]> = {
    friendly: [
        'Honestly? I think starting small is underrated. Small is how everything big started 💙',
        'I don’t believe in perfect weeks. I believe in coming back. 💙',
        'Rest is part of the plan, not a break from it. I mean that.',
    ],
    normal: [
        'I don’t believe in Monday starts. Today is the start.',
        'Motivation is a bonus. The plan is what gets it done.',
        'The best time to do the hard thing is first. I’ll keep saying it.',
    ],
    dad_mode: [
        'I’ve never once seen talent beat showing up. Not once.',
        'Mondays are not special. Neither is tomorrow. Today is what you have.',
        'A promise to yourself is still a promise.',
    ],
    bully_mode: [
        'Monday starts are for people who don’t want to start. Today.',
        'I don’t care how you feel. I care what you did.',
        'Talent is cheap. Showing up when it sucks is the whole game.',
    ],
    goofball: [
        'Hot take: “I’ll do it later” is the most expensive sentence in English.',
        'I don’t trust Monday starts. Mondays have never once followed through.',
        'Unpopular opinion: the first five minutes are the only hard part. The rest is just continuing.',
    ],
};

/* ------------------------------------------------------------ short reactions */

/** Short lines, a word or a question: so not every line is a full sentence with a punchline. */
export const SHORT: Record<PersonalityModeId, { praise: string[]; nudge: string[]; check: string[] }> = {
    friendly: { praise: ['Love that.', 'Look at you 💙', 'Nice one.'], nudge: ['Little one now?', 'Just the first step?'], check: ['How’s today feeling?', 'You okay?'] },
    normal: { praise: ['Good.', 'Nice.', 'That’s the way.'], nudge: ['Now?', 'Start small. Start now.'], check: ['How’s it going?', 'What’s in the way?'] },
    dad_mode: { praise: ['Good.', 'That’s more like it.', 'Proud of you.'], nudge: ['Well?', 'Go on.'], check: ['Everything alright?', 'What’s the holdup?'] },
    bully_mode: { praise: ['Finally.', 'Fine. Good.', 'See?'], nudge: ['Well?', 'Move.'], check: ['What’s the excuse today?', 'Still here?'] },
    goofball: { praise: ['Iconic.', 'Who even are you?', 'Okay, show-off.'], nudge: ['Psst. Now?', 'Tiny start?'], check: ['How’s the vibe?', 'We good?'] },
};

/* ------------------------------------------------------------ callbacks */

export interface CallbackInput {
    voice: PersonalityModeId;
    name?: string;
    /** What Echo remembers (lib/echoMemory.ts). */
    notes: MemoryNote[];
    /** Which help has worked best for them, best first (helpRanking). */
    bestHelp?: { type: HelpType; done: number; tries: number };
    /** Whole days since they last opened Habyss, before today. */
    daysAway: number;
    /** What they answered to Echo's question yesterday, if anything. */
    yesterdayAnswer?: { question: string; answer: string };
    /** The thing waiting on them now, if any (named). */
    waiting?: string;
}

const HELP_WORDS: Record<HelpType, string> = {
    two_minute: 'the two-minute start',
    five_minute: 'five minutes on the clock',
    plan: 'a plan for when and where',
};

const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** "Sam, " or "" */
const hey = (name?: string) => (name ? `${name.split(' ')[0]}, ` : '');

/**
 * Something only someone who knows you would say, or null when there is
 * nothing to call back to. Most personal first: coming back after a gap,
 * yesterday's answer, something you told Echo, then the help that works.
 */
export function callbackLine(input: CallbackInput, random: () => number = Math.random): { topic: string; line: string } | null {
    const { voice, name, waiting } = input;
    const tough = voice === 'dad_mode' || voice === 'bully_mode';

    if (input.daysAway >= 2) {
        const gap = input.daysAway >= 7 ? 'a while' : `${numberWord(input.daysAway)} days`;
        const line = voice === 'friendly' ? `${hey(name)}it’s been ${gap}. Missed you. No catching up needed, just today 💙`
            : voice === 'dad_mode' ? `${capital(gap)}. I noticed. Let’s not make it a habit.`
            : voice === 'bully_mode' ? `Oh, you’re alive. ${gap} gone. Don’t try to make it up, just do today.`
            : voice === 'goofball' ? `Look who’s back. ${gap} away. I kept your seat warm.`
            : `Haven’t seen you in ${gap}. Forget the backlog. Just today.`;
        return { topic: 'callback:away', line };
    }

    if (input.yesterdayAnswer) {
        const said = input.yesterdayAnswer.answer.trim().replace(/[.!?]+$/, '');
        if (said) {
            const line = tough ? `Yesterday you said “${said}”. So? Did today go differently?`
                : voice === 'goofball' ? `Yesterday’s report: “${said}”. Today’s sequel?`
                : `Yesterday you told me “${said}”. How’s today compared?`;
            return { topic: 'callback:answer', line };
        }
    }

    const told = input.notes.filter(note => note.source === 'you' && (note.kind === 'obstacle' || note.kind === 'preference' || note.kind === 'strategy'));
    if (told.length && random() < 0.6) {
        const note = told[Math.floor(random() * told.length)];
        const what = note.text.trim().replace(/[.!?]+$/, '');
        const lower = what.charAt(0).toLowerCase() + what.slice(1);
        const line = note.kind === 'obstacle'
            ? (tough ? `You told me ${lower}. Fine. Work around it${waiting ? `: ${waiting}, now` : ''}.` : `You mentioned ${lower}. ${waiting ? `Want to try ${waiting} anyway, just a small bit?` : 'So let’s plan around it.'}`)
            : note.kind === 'strategy'
                ? `Remember what works for you: ${lower}.${waiting ? ` Try it on ${waiting}.` : ''}`
                : `You said ${lower}. I’m keeping that in mind${waiting ? ` for ${waiting}` : ''}.`;
        return { topic: `callback:note:${note.id}`, line };
    }

    if (input.bestHelp && input.bestHelp.done >= 2 && waiting) {
        const how = HELP_WORDS[input.bestHelp.type];
        const line = tough ? `${how.charAt(0).toUpperCase()}${how.slice(1)} worked for you before. Use it on ${waiting}.`
            : `Last few times, ${how} is what got you going. Same trick for ${waiting}?`;
        return { topic: 'callback:help', line };
    }
    return null;
}

/* ------------------------------------------------------------ restraint & timing */

/** How long a line stays put when nothing has changed: glancing at Home again is not a new conversation. */
export const QUIET_FOR_MS = 3 * 60_000;

/**
 * Whether Echo keeps what it said: the same situation (topic) said within the
 * last few minutes stays on screen rather than being swapped for another
 * wording. A person does not rephrase themselves every time you look up.
 */
export function keepLastLine(last: { line: string; at: number; situation: string } | null, situation: string, now = Date.now()): boolean {
    return !!last && last.situation === situation && now - last.at < QUIET_FOR_MS;
}

/**
 * A human minute for something Echo sends at a set time: a few minutes either
 * side of it, the same on a given day for a given thing (so rescheduling does
 * not move it about), never on the hour.
 */
export function humanMinute(minute: number, key: string, day: string): number {
    let hash = 0;
    for (const char of `${key}:${day}`) hash = (hash * 31 + char.charCodeAt(0)) | 0;
    const offset = (Math.abs(hash) % 13) - 6; // −6..+6
    const moved = minute + (offset === 0 ? 3 : offset);
    return Math.max(0, Math.min(24 * 60 - 1, moved));
}

/** A date moved to a human minute (humanMinute), the same each time it is worked out for that day. */
export function humanTime(date: Date, key: string): Date {
    const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const minute = humanMinute(date.getHours() * 60 + date.getMinutes(), key, day);
    const moved = new Date(date);
    moved.setHours(Math.floor(minute / 60), minute % 60, 0, 0);
    return moved;
}

/** Whole days between two local day keys ("2026-11-04" → "2026-11-11" is 7). */
export function daysBetween(from: string, to: string): number {
    return Math.round((Date.parse(`${to}T12:00:00`) - Date.parse(`${from}T12:00:00`)) / 86400000);
}

/**
 * What Echo says when you answer its question: short, and it says it will
 * remember, because it will (lib/echoConversation.ts).
 */
export function heardLine(voice: PersonalityModeId, question: 'win' | 'blocker' | 'wentWell'): string {
    const lines: Record<PersonalityModeId, Record<typeof question, string>> = {
        friendly: { win: 'Love it. That’s the one, then 💙', blocker: 'Thanks for telling me. We’ll work around it tomorrow.', wentWell: 'That made my day. Remember it.' },
        normal: { win: 'Good. That’s today’s one thing.', blocker: 'Noted. Tomorrow we plan around it.', wentWell: 'Good. Do more of that.' },
        dad_mode: { win: 'Then that’s what gets done.', blocker: 'Noted. No excuses tomorrow, though.', wentWell: 'Good. That’s what I like to hear.' },
        bully_mode: { win: 'Fine. Now actually do it.', blocker: 'Noted. Tomorrow it doesn’t get to win.', wentWell: 'Look at that. Again tomorrow.' },
        goofball: { win: 'Locked in. I’m holding you to it.', blocker: 'Filed under “things we defeat tomorrow”.', wentWell: 'Adding that to your highlight reel.' },
    };
    return (lines[voice] ?? lines.normal)[question];
}
