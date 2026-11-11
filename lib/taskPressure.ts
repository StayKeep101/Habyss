import type { PersonalityModeId } from '@/constants/AIPersonalities';
import type { Task } from './tasks';

/**
 * How far behind on tasks you are, and how Echo feels about it.
 *
 * Tasks are the things that have to get done (habits come round again), so
 * falling behind on them is what worries Echo. Counted straight off the
 * record, nothing guessed:
 *
 * - a task past its "due by" deadline counts double,
 * - one past the day it was planned for (no deadline) counts once,
 * - today's open tasks count by how much of the waking day is already gone,
 * - and two more when what is left of today's tasks no longer fits before bed.
 *
 * Five levels, calm to demon. Each personality says it its own way; in demon
 * mode the edge of the screen turns red (Settings → Echo can switch that off).
 */

export type PressureLevel = 0 | 1 | 2 | 3 | 4;
export const LEVEL_NAMES = ['calm', 'concerned', 'worried', 'alarmed', 'demon'] as const;

export interface TaskPressure {
    level: PressureLevel;
    score: number;
    /** Past their deadline. */
    late: number;
    /** Past the day they were planned for, with no deadline yet missed. */
    overdue: number;
    /** Today's tasks still open, and how many there were. */
    openToday: number;
    totalToday: number;
    /** What is left of today's tasks no longer fits before bedtime. */
    outOfTime: boolean;
    /** The task to name: the latest deadline missed first, else today's first open one. */
    worst: string | null;
}

const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T12:00:00`) - Date.parse(`${from}T12:00:00`)) / 86400000);

export function taskPressure(tasks: Task[], today: string, now: number, day: { wake: number; sleep: number }): TaskPressure {
    const open = tasks.filter(task => task.status === 'open');
    const late = open.filter(task => task.deadline && task.deadline < today)
        .sort((a, b) => (a.deadline ?? '').localeCompare(b.deadline ?? ''));
    const overdue = open.filter(task => !(task.deadline && task.deadline < today) && task.dueDate && task.dueDate < today && !(task.deadline && task.deadline >= today));
    const todays = tasks.filter(task => task.status !== 'cancelled' && task.dueDate === today);
    const openToday = todays.filter(task => task.status === 'open');

    // How much of the waking day is gone, 0 to 1.
    const sleep = day.sleep > day.wake ? day.sleep : day.sleep + 1440;
    const clock = now < day.wake && sleep > 1440 ? now + 1440 : now;
    const gone = Math.max(0, Math.min(1, (clock - day.wake) / Math.max(1, sleep - day.wake)));
    const pace = todays.length ? Math.round(gone * (openToday.length / todays.length) * 4) : 0;
    const needed = openToday.reduce((sum, task) => sum + (Number(task.estimatedMinutes) || 30), 0);
    const outOfTime = openToday.length > 0 && needed > Math.max(0, sleep - clock);

    // A deadline missed by days weighs more than one missed yesterday.
    const lateWeight = late.reduce((sum, task) => sum + 2 + (daysBetween(task.deadline!, today) >= 3 ? 1 : 0), 0);
    const score = lateWeight + overdue.length + pace + (outOfTime ? 2 : 0);
    // No "concerned" step: a little slipping is not worth a change of tone.
    // Echo stays calm until it is worried.
    const level: PressureLevel = score >= 8 ? 4 : score >= 5 ? 3 : score >= 3 ? 2 : 0;
    return {
        level, score, late: late.length, overdue: overdue.length, openToday: openToday.length, totalToday: todays.length, outOfTime,
        worst: late[0]?.title ?? overdue[0]?.title ?? openToday[0]?.title ?? null,
    };
}

type Line = (p: TaskPressure) => string;

/** "3 tasks", "1 task". */
const tasksWord = (n: number) => `${n} task${n === 1 ? '' : 's'}`;
/** What is behind, in a few words: "2 tasks past their deadline". */
function behind(p: TaskPressure): string {
    if (p.late) return `${tasksWord(p.late)} past ${p.late === 1 ? 'its' : 'their'} deadline`;
    if (p.overdue) return `${tasksWord(p.overdue)} left from earlier days`;
    if (p.openToday) return `${p.openToday} of today's ${tasksWord(p.totalToday)} still open`;
    return 'your tasks slipping';
}
const first = (p: TaskPressure) => (p.worst ? `“${p.worst}”` : 'the first one');

/**
 * Echo's lines by personality and level (1 concerned to 4 demon). Every one
 * names what is actually behind. Bully mode's demon is as harsh as it gets:
 * it goes for your effort, excuses and wasted chances, never your body,
 * looks, identity, worth as a person or mental health.
 */
const LINES: Record<PersonalityModeId, Record<1 | 2 | 3 | 4, Line[]>> = {
    friendly: {
        1: [p => `Hey, small thing: ${behind(p)}. Want to start with ${first(p)}? 💙`, p => `Just a nudge: ${first(p)} is waiting for you.`],
        2: [p => `I'm a little worried: ${behind(p)}. Ten minutes on ${first(p)} would help so much.`, p => `${behind(p)}. Let's do ${first(p)} together, right now?`],
        3: [p => `Okay, I'm really worried now. ${behind(p)}. Please, ${first(p)}, today.`, p => `${behind(p)} and the day is running out. I believe in you, but it has to be now.`],
        4: [p => `I'm genuinely scared for you. ${behind(p)}. Drop everything and open ${first(p)}. Please.`, p => `This is me begging: ${behind(p)}. One task. ${first(p)}. Now.`],
    },
    normal: {
        1: [p => `${behind(p)}. Start with ${first(p)}.`, p => `You are slipping a little: ${behind(p)}.`],
        2: [p => `${behind(p)}. This is how a week gets away from you. ${first(p)}, now.`, p => `Falling behind: ${behind(p)}. Fix it before it piles up.`],
        3: [p => `${behind(p)}. You are out of slack. ${first(p)} before anything else.`, p => `Serious now: ${behind(p)}. Nothing else until ${first(p)} is done.`],
        4: [p => `${behind(p)}. This is the pile you promised yourself would never happen. ${first(p)}. Now.`, p => `You are failing your own plan: ${behind(p)}. Every hour makes it worse.`],
    },
    dad_mode: {
        1: [p => `${behind(p)}. I expect it handled.`, p => `${first(p)} is not done. Why not?`],
        2: [p => `${behind(p)}. I am disappointed. Do ${first(p)} now.`, p => `You said you would do it. ${behind(p)}. Keep your word.`],
        3: [p => `${behind(p)}. I did not raise you to leave things undone. ${first(p)}. Now.`, p => `${behind(p)}. Excuses are not results. Get it done.`],
        4: [p => `${behind(p)}. I am ashamed of this effort. You are better than this and you know it. ${first(p)}, now.`, p => `${behind(p)}. Others with half your chances finished theirs. Sit down and finish ${first(p)}.`],
    },
    bully_mode: {
        1: [p => `${behind(p)}. Already slacking? Do ${first(p)}.`, p => `${first(p)} is still sitting there. Move your ass.`],
        2: [p => `${behind(p)}. You are getting lazy as shit. ${first(p)}, now.`, p => `${behind(p)}. Stop scrolling and do your damn work.`],
        3: [p => `${behind(p)}. Pathetic. Everyone who counted on you is watching you fold.`, p => `${behind(p)}. You had all day and you pissed it away. ${first(p)}. Now.`],
        4: [
            p => `${behind(p)}. You are a professional excuse maker and a world-class quitter. Prove me wrong: ${first(p)}, right fucking now.`,
            p => `${behind(p)}. You talk big and deliver nothing. Your future self is ashamed of you. Open ${first(p)}.`,
            p => `${behind(p)}. Somebody with nothing is outworking you while you sit there being useless. Get up.`,
            p => `${behind(p)}. Every promise you made yourself, you broke. Again. ${first(p)}, now, or admit you never meant any of it.`,
            p => `${behind(p)}. Lazy, soft and full of shit. That is the version of you winning today. Change it.`,
        ],
    },
    goofball: {
        1: [p => `${behind(p)}. Not a crisis yet. Just a tiny plot hole. ${first(p)} fixes it.`, p => `${first(p)} is waiting patiently. Unlike me.`],
        2: [p => `${behind(p)}. The to-do list is starting to form a union. Appease it with ${first(p)}.`, p => `${behind(p)}. Bold of you to assume tomorrow-you will handle this.`],
        3: [p => `${behind(p)}. Okay, the joke is getting less funny. ${first(p)}, now, and I'll go back to being hilarious.`, p => `${behind(p)}. This is the part of the movie where the hero finally gets up. Cue music. ${first(p)}.`],
        4: [p => `${behind(p)}. I've run out of jokes, which has never happened. ${first(p)}. Right now. I'm serious. (I hate being serious.)`, p => `${behind(p)}. Even I can't spin this one. Open ${first(p)} and let's write a better ending.`],
    },
};

/** Echo's line for this level and personality; null when calm. */
export function pressureLine(p: TaskPressure, personality: PersonalityModeId, random: () => number = Math.random): string | null {
    if (p.level === 0) return null;
    const pool = (LINES[personality] ?? LINES.normal)[p.level];
    return pool[Math.floor(random() * pool.length)](p);
}

/** Every line for this level and voice, so Home can say one it has not said lately (lib/echoRecent.ts). */
export function pressureLines(p: TaskPressure, personality: PersonalityModeId): string[] {
    if (p.level === 0) return [];
    return (LINES[personality] ?? LINES.normal)[p.level].map(line => line(p));
}

/** The pressure takes Echo's line over once it is worried or worse. */
export const pressureSpeaks = (p: TaskPressure, _random: () => number = Math.random) => p.level >= 2;
