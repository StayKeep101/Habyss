import type { PersonalityModeId } from '@/constants/AIPersonalities';
import { minutesOf, type DayWindow } from './echo';
import { pickWrittenLine, type EchoStats } from './echoLines';

/**
 * Echo on the lock screen, hourly.
 *
 * Home has had a line from Echo since the beginning, and it is the one part of
 * the app people read without being asked to. The lock screen is where a phone
 * is looked at eighty times a day and Habyss said nothing there.
 *
 * A widget cannot run code or reach the database, so it cannot ask Echo
 * anything — the app has to hand it the lines in advance. That is what this
 * builds: one line per waking hour, written now, read later. A widget timeline
 * is the only way to say something hourly without a notification, and a
 * notification every hour is not a thing anybody wants.
 *
 * Lines are picked with a seeded shuffle rather than `Math.random`, so the plan
 * is the same every time it is rebuilt within an hour. Without that, every
 * widget sync would rewrite the afternoon and the line you half-read at two
 * would be gone when you looked again.
 */

export interface EchoHour {
    /** When this line takes over, in epoch milliseconds. */
    at: number;
    line: string;
}

/** A tiny deterministic generator, so a plan can be rebuilt unchanged. */
function seeded(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6D2B79F5) >>> 0;
        let value = Math.imul(state ^ (state >>> 15), 1 | state);
        value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
}

const hash = (text: string): number => {
    let total = 0;
    for (const letter of text) total = (Math.imul(total, 31) + letter.charCodeAt(0)) >>> 0;
    return total;
};

/** Whether the clock is inside the user's waking window. */
export function awakeAt(date: Date, window: DayWindow): boolean {
    const minutes = date.getHours() * 60 + date.getMinutes();
    const wake = minutesOf(window.wake);
    const sleep = minutesOf(window.sleep);
    if (wake === sleep) return true;
    return wake < sleep ? minutes >= wake && minutes < sleep : minutes >= wake || minutes < sleep;
}

/**
 * One line for now, then one on each waking hour after it.
 *
 * The first entry is the moment asked for rather than the next o'clock, so a
 * widget added at twenty past has something to say at twenty past. Sleeping
 * hours are skipped rather than filled: a phone picked up at four in the
 * morning should not be given a pep talk, it should keep the last line.
 */
export function buildEchoHours(options: {
    stats: EchoStats;
    personality: PersonalityModeId;
    window: DayWindow;
    now: Date;
    /** How many hours ahead to write for. */
    hours?: number;
}): EchoHour[] {
    const { stats, personality, window, now } = options;
    const span = Math.max(1, Math.min(48, options.hours ?? 14));
    const plan: EchoHour[] = [];
    const used: string[] = [];

    const add = (at: Date, index: number) => {
        const random = seeded(hash(`${at.toDateString()}:${at.getHours()}:${personality}:${index}`));
        // Recent lines are the ones already in this plan, so an hour never
        // repeats the hour before it.
        const line = pickWrittenLine(personality, stats, used.slice(-6), random, 'ai');
        used.push(line);
        plan.push({ at: at.getTime(), line });
    };

    add(now, 0);
    const next = new Date(now);
    next.setMinutes(0, 0, 0);
    for (let index = 1; index <= span; index++) {
        next.setHours(next.getHours() + 1);
        if (!awakeAt(next, window)) continue;
        add(new Date(next), index);
    }
    return plan;
}
