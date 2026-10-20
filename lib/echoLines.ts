import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PersonalityModeId } from '@/constants/AIPersonalities';
import { askForLine, isOnDeviceAIReady } from './onDeviceAI';
import { speaksAsUser } from './echoWriter';

/**
 * What Echo says at the top of Home, a new line every time the page is opened
 * or refreshed.
 *
 * Five kinds of line, mixed by personality:
 * - facts: true, sourced findings about habits and behaviour change. Wording
 *   stays within what the studies found; nothing here is embellished.
 * - yours: built from the user's own recorded data. Never claims more than
 *   was logged, and an unlogged habit is "not logged", not "skipped".
 * - quote: lines that hit like the best motivational quotes — about work,
 *   standards and what it costs to win. No numbers, no data.
 * - push: encouragement in the personality's voice.
 * - roast: Bully Mode only. Harsh about excuses and effort, with guilt and
 *   FOMO; never about their body, looks, identity or mental health.
 *
 * When the on-device model is ready it sometimes writes a fresh line instead,
 * held to the same rules; the written bank is the fallback and the default.
 */

export interface EchoStats {
    name?: string;
    streak: number;
    todayDone: number;
    todayTotal: number;
    /** Share of the last 7 days with at least one check-in, 0-100. */
    weekConsistency: number;
    bestHabit?: string;
    nextHabit?: string;
    goalsCount: number;
    overallProgress: number;
    /** What Echo found in their record (lib/echoPatterns.ts), strongest first. True, so the model may cite them. */
    patterns?: string[];
}

type Kind = 'fact' | 'yours' | 'quote' | 'push' | 'roast';

const MIX: Record<PersonalityModeId, Record<Kind, number>> = {
    friendly: { fact: 2, yours: 3, quote: 3, push: 3, roast: 0 },
    normal: { fact: 3, yours: 3, quote: 4, push: 1, roast: 0 },
    dad_mode: { fact: 1, yours: 3, quote: 4, push: 3, roast: 0 },
    bully_mode: { fact: 1, yours: 2, quote: 3, push: 0, roast: 5 },
};

/**
 * The lines people screenshot. Short, absolute, and about the work — the kind
 * that make sitting still feel like a choice you have to defend.
 */
export const QUOTES: string[] = [
    'Work so hard that it would be unreasonable for you not to win.',
    'Discipline is choosing what you want most over what you want now.',
    'Nobody remembers the days you felt like it. They remember what you built anyway.',
    'You will never regret the work. You will regret the days you gave away.',
    'The pain of discipline weighs ounces. The pain of regret weighs tons.',
    'Be so consistent that luck has no choice but to find you.',
    'Everyone wants the result. Almost nobody wants the boring middle. Be the one who does.',
    'Comfort is the slowest way to lose everything you could have been.',
    'Do it tired. Do it unsure. Do it anyway. That is the whole secret.',
    'Your future is being decided by what you do in the next hour, not the next year.',
    'Talent is common. People who show up every single day are rare.',
    'Act like the person you want to become is watching. Because one day they will be.',
    'Winners are not people who never feel like quitting. They are people who never let it decide.',
    'The version of you that you dream about is built on days exactly like this one.',
    'If it was easy, everyone would have it. That is the point.',
    'You do not rise to your goals. You fall to your habits. Raise them.',
    'Stop waiting to feel ready. Ready is something you become by starting.',
    'Outwork your doubts. They get quieter every time you do.',
    'One day or day one. You decide, every morning.',
    'Hard choices, easy life. Easy choices, hard life.',
    'Make your excuses wait outside. Today is not theirs.',
    'Be obsessed, or be average. There is not much in between.',
];

export const FACTS: string[] = [
    'In a UCL study, new habits took a median of 66 days to feel automatic. Anywhere from 18 to 254 is normal.',
    'Missing a single day did not measurably slow habit formation in that same study. One off day is not a reset.',
    'Deciding "I will do X at time Y in place Z" makes people noticeably more likely to follow through. It is called an implementation intention.',
    'About 43% of what people do each day is done out of habit, while thinking about something else.',
    'Habits form fastest when the cue is stable: same time, same place, right after the same thing.',
    'Tying a new habit to one you already have ("after coffee, I…") gives it a ready-made cue.',
    'People who tracked a behaviour consistently were more likely to change it. Measuring is part of the work.',
    'Small, easy versions of a habit are more likely to stick than ambitious ones. You can grow it once it is automatic.',
    'Willpower is less of a factor than environment. Making the right thing the easy thing does more than trying harder.',
    'In a large review of studies, tracking progress helped people reach goals, and it helped more when the progress was shared with someone.',
    'Simple habits, like drinking water after breakfast, became automatic faster than harder ones like daily exercise.',
    'Rewards that come right away build habits better than rewards that come weeks later.',
    'Planning for obstacles ahead of time, "if X happens, I will do Y", protects habits on bad days.',
    'Short sleep makes self-control harder the next day. Bedtime is part of the plan.',
    'A fresh start, like a new week or month, is a real motivation boost. People start more goals on Mondays.',
];

const PUSH: Record<PersonalityModeId, ((s: EchoStats) => string)[]> = {
    friendly: [
        s => `${s.name ? `${s.name}, y` : 'Y'}ou showed up again. That is the whole trick. 💙`,
        () => 'Tiny steps still move you forward. Proud of you. 🌟',
        () => 'You do not have to be perfect today. Just present. 💙',
        s => `Whatever today looks like${s.name ? `, ${s.name}` : ''}, I am in your corner. ✨`,
        () => 'Future you is going to be so grateful for today. 🌱',
        () => 'Be gentle with yourself and keep going. Both count. 💙',
    ],
    normal: [
        () => 'Consistency beats intensity. Keep the chain going.',
        () => 'Do the smallest version if you are short on time. It still counts.',
        () => 'A good day is one where you did what you planned. Aim for that.',
        () => 'Somebody with less time and fewer chances is doing it right now. So can you.',
        () => 'The work you do when nobody is watching is the work that shows up later.',
    ],
    dad_mode: [
        s => `${s.name ? `${s.name}. ` : ''}You gave your word. Keep it.`,
        () => 'Nobody is coming to do it for you. Get up.',
        () => 'Tired is not a reason. Busy is not a reason. Do it.',
        () => 'I do not want to hear excuses. I want to see it done.',
        () => 'You know better than this. Act like it.',
        () => 'Finish what you started. Then we talk.',
        () => 'Doing the minimum is not something to be proud of.',
        () => 'I expect more from you, because you are capable of more.',
        () => 'I did not raise you to do things halfway.',
        () => 'People with half your chances are out there working. What is your excuse?',
        () => 'You want respect? Earn it from yourself first. Go.',
    ],
    bully_mode: [],
};

/**
 * Bully mode, as asked for: it swears, it insults your effort and your
 * excuses, and it goes for the guilt — the people working while you rest, the
 * people who had it harder and did more, the person who raised you. Never your
 * body, looks, identity or mental health, and no slurs: the point is to light
 * a fire, not to wound.
 */
const ROASTS: ((s: EchoStats) => string)[] = [
    s => `${s.name ? `${s.name}, y` : 'Y'}our excuses are more consistent than your fucking habits.`,
    () => 'Your mom did not raise you to be a lazy ass. Get up.',
    () => 'While you are getting comfortable, someone out there is working right now. And they are coming for what you want.',
    () => 'People with no money, no time and no help did more than this. What the hell is your excuse?',
    () => 'Somewhere a kid with nothing is outworking you tonight. Sit with that.',
    () => 'You had every chance today. Everyone who ever believed in you deserves better than this.',
    () => 'The person you could have been is watching you scroll. They are embarrassed.',
    () => 'Imagine telling your younger self you had all this and still did nothing. Go on. Look at them.',
    () => 'Every minute you waste, somebody hungrier takes your spot. Move your ass.',
    () => '"I will start tomorrow." Bullshit. You said that yesterday.',
    () => 'Nobody is coming to save you. Not today, not ever. Do it yourself.',
    () => 'Your competition did not take today off. Why the hell did you?',
    () => 'Comfortable is where dreams go to die. Get out of it.',
    () => 'You are not tired. You are undisciplined. There is a difference.',
    () => 'Ten years from now you will either thank this moment or hate it. Choose.',
    () => 'Your goals will not hit themselves while you lie there, genius.',
    () => 'Your parents worked too damn hard for you to be this soft.',
    s => (s.todayTotal > 0 && s.todayDone === 0 ? `${s.todayTotal} scheduled today. Zero done. What the hell are you doing?` : 'Done is the only status that counts. Everything else is noise.'),
];

function yours(s: EchoStats, personality: PersonalityModeId): string[] {
    const lines: string[] = [];
    const tough = personality === 'dad_mode' || personality === 'bully_mode';
    const warm = personality === 'friendly';
    const left = s.todayTotal - s.todayDone;

    if (s.todayTotal > 0 && left === 0) {
        lines.push(warm ? `All ${s.todayTotal} done today. You nailed it. 🎉` : tough ? `All ${s.todayTotal} done. That is the standard. Again tomorrow.` : `Everything scheduled today is done: ${s.todayDone} of ${s.todayTotal}.`);
    } else if (s.todayTotal > 0) {
        lines.push(warm ? `${s.todayDone} of ${s.todayTotal} done so far. ${left === 1 ? 'Just one' : `${left}`} to go. 💙` : tough ? `${left} still open today. Close them.` : `${s.todayDone} of ${s.todayTotal} logged today.`);
    }
    if (s.nextHabit && left > 0) {
        lines.push(warm ? `Next up: ${s.nextHabit}. You have got this. ✨` : tough ? `${s.nextHabit}. Not logged yet. Go.` : `${s.nextHabit} is not logged yet today.`);
    }
    if (s.streak >= 2) {
        lines.push(warm ? `${s.streak} days in a row! Look at you. 🔥` : tough ? `${s.streak} days in a row. Don't you dare break it.` : `${s.streak} days in a row with at least one check-in.`);
    }
    if (s.weekConsistency > 0) {
        lines.push(s.weekConsistency >= 70
            ? (tough ? `Active ${s.weekConsistency}% of this week. Acceptable. Aim higher.` : `You were active on ${s.weekConsistency}% of the last 7 days.`)
            : (tough ? `Active ${s.weekConsistency}% of this week. That is not a habit yet.` : `Active on ${s.weekConsistency}% of the last 7 days. One more day moves that.`));
    }
    if (s.bestHabit) {
        lines.push(warm ? `${s.bestHabit} is your most consistent habit this week. 🌟` : `${s.bestHabit} is your most consistent habit this week.`);
    }
    if (s.goalsCount > 0) {
        lines.push(tough
            ? `Your goals are ${s.overallProgress}% done. The rest will not do itself.`
            : `Across ${s.goalsCount} goal${s.goalsCount === 1 ? '' : 's'}, you are ${s.overallProgress}% of the way.`);
    }
    return lines;
}

const RECENT_KEY = 'echo_recent_lines';
const RECENT_LIMIT = 12;

async function recentLines(): Promise<string[]> {
    try { return JSON.parse((await AsyncStorage.getItem(RECENT_KEY)) ?? '[]'); } catch { return []; }
}

async function remember(line: string): Promise<void> {
    const recent = await recentLines();
    await AsyncStorage.setItem(RECENT_KEY, JSON.stringify([line, ...recent.filter(item => item !== line)].slice(0, RECENT_LIMIT))).catch(() => undefined);
}

/** The Settings choice of what Echo talks about on Home. */
export type EchoStyle = 'ai' | 'quotes' | 'data' | 'all';

function weightsFor(personality: PersonalityModeId, style: EchoStyle): Record<Kind, number> {
    const base = MIX[personality] ?? MIX.normal;
    const roast = personality === 'bully_mode' ? 1 : 0;
    switch (style) {
        case 'data': return { fact: 0, yours: 1, quote: 0, push: 0, roast: 0 };
        case 'quotes': return { fact: base.fact, yours: 0, quote: base.quote, push: base.push, roast: base.roast };
        case 'all': return { fact: 1, yours: 1, quote: 1, push: personality === 'bully_mode' ? 0 : 1, roast };
        case 'ai':
        default: return base;
    }
}

function pickKind(personality: PersonalityModeId, random: () => number, style: EchoStyle = 'ai'): Kind {
    const weights = weightsFor(personality, style);
    const total = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
    let roll = random() * total;
    for (const kind of Object.keys(weights) as Kind[]) {
        roll -= weights[kind];
        if (roll < 0) return kind;
    }
    return 'fact';
}

function candidates(kind: Kind, personality: PersonalityModeId, stats: EchoStats): string[] {
    switch (kind) {
        case 'fact': return FACTS;
        case 'quote': return QUOTES;
        case 'yours': return yours(stats, personality);
        case 'push': return (PUSH[personality] ?? PUSH.normal).map(line => line(stats));
        case 'roast': return ROASTS.map(line => line(stats));
    }
}

/** A line from the written bank, avoiding the ones shown most recently. */
export function pickWrittenLine(
    personality: PersonalityModeId,
    stats: EchoStats,
    recent: string[] = [],
    random: () => number = Math.random,
    style: EchoStyle = 'ai',
): string {
    for (let attempt = 0; attempt < 6; attempt++) {
        const pool = candidates(pickKind(personality, random, style), personality, stats).filter(line => !recent.includes(line));
        if (pool.length) return pool[Math.floor(random() * pool.length)];
    }
    return FACTS[Math.floor(random() * FACTS.length)];
}

const STYLE: Record<PersonalityModeId, string> = {
    friendly: 'warm, upbeat and supportive, like a best friend; one emoji at most',
    normal: 'intense and inspiring, like the best motivational quote they have ever read: short, absolute, about hard work and winning; no emoji',
    dad_mode: 'a stern, strict father: short clipped sentences, disappointed when they slack, reminds them that others with less are working harder, expects results, no praise for the bare minimum, no warmth, no emoji',
    bully_mode: 'a foul-mouthed drill sergeant who swears freely (fuck, shit, damn, ass) and cuts deep: guilt about wasting their chances, FOMO about people working right now, people in harder conditions doing more, "your mom did not raise you to be lazy"; never about their body, looks, identity or mental health; no slurs; no emoji',
};

/**
 * Echo's line for this visit. Written lines by default; now and then a fresh
 * one from the on-device model, grounded only in the numbers passed in.
 */
export async function nextEchoLine(personality: PersonalityModeId, stats: EchoStats, style: EchoStyle = 'ai'): Promise<string> {
    const recent = await recentLines();
    let line: string | null = null;

    if (style !== 'data' && isOnDeviceAIReady() && Math.random() < 0.4) {
        const facts = [
            stats.name ? `The user you are speaking to is called ${stats.name}` : null,
            `Today: ${stats.todayDone} of ${stats.todayTotal} habits logged`,
            stats.streak ? `Streak: ${stats.streak} days` : null,
            `Active on ${stats.weekConsistency}% of the last 7 days`,
            stats.nextHabit ? `Not logged yet: ${stats.nextHabit}` : null,
            stats.goalsCount ? `Goals: ${stats.overallProgress}% done overall` : null,
            // Two at most: a small model given more stops reading.
            stats.patterns?.length ? `Found in their own record: ${stats.patterns.slice(0, 2).join(' ')}` : null,
        ].filter(Boolean).join('. ');
        line = await askForLine(
            `You are Echo, the voice of a habit tracker, talking TO the user. Write ONE sentence, at most 18 words. Tone: ${STYLE[personality] ?? STYLE.normal}. `
            + 'Address them as "you"; never speak as them or introduce yourself by their name. '
            + 'Use only the facts given; never invent numbers, streaks or events. Say "not logged" rather than "skipped". No quotation marks.',
            facts,
            4000,
        );
        if (line && (line.length > 160 || recent.includes(line) || speaksAsUser(line, stats.name))) line = null;
    }

    line ??= pickWrittenLine(personality, stats, recent, Math.random, style);
    await remember(line);
    return line;
}

/* -------------------------------------------------------------------------- */
/*  Check-ins                                                                  */
/* -------------------------------------------------------------------------- */

export interface CheckInFacts {
    name?: string;
    /** Habits scheduled today that are not done or skipped. */
    left: number;
    /** What today asked for in total. */
    total: number;
    /** The next thing not done yet, if there is one. */
    next?: string;
    tasksDue: number;
    /** The day's promise: how many tasks it is meant to carry. */
    focusTarget?: number;
    /** How many of them are already finished. */
    focusDone?: number;
    /** Something Echo found in their record, said after the plan in the morning. */
    insight?: string;
}

/**
 * What Echo says when it checks in, in the voice the user chose.
 *
 * Only the numbers it was handed: no invented progress, and "not logged"
 * rather than any claim about what the person did or did not do.
 */
export function checkInLine(
    kind: 'morning' | 'evening',
    personality: PersonalityModeId,
    facts: CheckInFacts,
): { title: string; body: string } {
    const line = planLine(kind, personality, facts);
    // The morning one also brings something from their record: the day's plan
    // with one thing that is true about how they work.
    return kind === 'morning' && facts.insight ? { ...line, body: `${line.body} ${facts.insight}` } : line;
}

function planLine(
    kind: 'morning' | 'evening',
    personality: PersonalityModeId,
    facts: CheckInFacts,
): { title: string; body: string } {
    const who = facts.name ? `, ${facts.name}` : '';
    const nothing = facts.total === 0 && facts.tasksDue === 0;

    if (kind === 'morning') {
        if (nothing) {
            return {
                title: 'Nothing scheduled today',
                body: personality === 'bully_mode'
                    ? 'An empty day. Add something worth doing.'
                    : `A clear day${who}. Add something if you want one.`,
            };
        }
        const what = [
            facts.total ? `${facts.total} habit${facts.total === 1 ? '' : 's'}` : null,
            facts.tasksDue ? `${facts.tasksDue} task${facts.tasksDue === 1 ? '' : 's'}` : null,
        ].filter(Boolean).join(' and ');

        // The promise comes first in the morning, because it is the thing the
        // day is actually for.
        if (facts.focusTarget) {
            const promise = `${facts.focusTarget} things`;
            switch (personality) {
                case 'friendly':
                    return { title: 'Morning!', body: `${promise} today${who}, and the day is yours. Start with ${facts.next ?? 'the easiest one'}. 💙` };
                case 'dad_mode':
                    return { title: 'Today', body: `${promise}. That is the deal${who}. Start with ${facts.next ?? 'the first one'}.` };
                case 'bully_mode':
                    return { title: 'Today', body: `${promise}. No excuses. ${facts.next ?? 'First one'}. Move.` };
                default:
                    return { title: 'Today', body: `${promise} to finish today.${facts.next ? ` First: ${facts.next}.` : ''}` };
            }
        }

        switch (personality) {
            case 'friendly':
                return { title: 'Morning!', body: `${what} today${who}. Start with ${facts.next ?? 'whichever is easiest'}. 💙` };
            case 'dad_mode':
                return { title: 'Today', body: `${what}. Start with ${facts.next ?? 'the first one'}${who}. No drifting.` };
            case 'bully_mode':
                return { title: 'Today', body: `${what}. ${facts.next ?? 'First one'}. Move.` };
            default:
                return { title: 'Today', body: `${what} scheduled.${facts.next ? ` First: ${facts.next}.` : ''}` };
        }
    }

    const short = facts.focusTarget ? Math.max(0, facts.focusTarget - (facts.focusDone ?? 0)) : 0;
    if (short > 0) {
        const need = `${short} more`;
        switch (personality) {
            case 'friendly':
                return { title: 'Before bed', body: `${facts.focusDone ?? 0} of ${facts.focusTarget} done${who}. ${need} and today counts. 💙` };
            case 'dad_mode':
                return { title: 'Before bed', body: `${facts.focusDone ?? 0} of ${facts.focusTarget}. ${need}${who}. There is still time.` };
            case 'bully_mode':
                return { title: 'Not done', body: `${facts.focusDone ?? 0} of ${facts.focusTarget}. ${need}. Go.` };
            default:
                return { title: 'Before bed', body: `${facts.focusDone ?? 0} of ${facts.focusTarget} finished today. ${need} to keep the day.` };
        }
    }

    if (facts.focusTarget && short === 0) {
        switch (personality) {
            case 'friendly': return { title: 'Day kept', body: `All ${facts.focusTarget} done${who}. That is how it is built. 💙` };
            case 'dad_mode': return { title: 'Day kept', body: `All ${facts.focusTarget} done. That is the standard. Again tomorrow.` };
            case 'bully_mode': return { title: 'Kept', body: `${facts.focusTarget} done. Again tomorrow.` };
            default: return { title: 'Day kept', body: `All ${facts.focusTarget} finished today.` };
        }
    }

    if (facts.left === 0 && facts.tasksDue === 0) {
        switch (personality) {
            case 'friendly': return { title: 'All done', body: `Everything due today is logged${who}. Rest well. 💙` };
            case 'dad_mode': return { title: 'All done', body: 'Everything logged. That is the standard. Again tomorrow.' };
            case 'bully_mode': return { title: 'Done', body: 'Logged. Again tomorrow.' };
            default: return { title: 'All done', body: 'Everything due today is logged.' };
        }
    }

    const open = [
        facts.left ? `${facts.left} habit${facts.left === 1 ? '' : 's'}` : null,
        facts.tasksDue ? `${facts.tasksDue} task${facts.tasksDue === 1 ? '' : 's'}` : null,
    ].filter(Boolean).join(' and ');

    switch (personality) {
        case 'friendly':
            return { title: 'Before bed', body: `${open} still open${who}. Even the smallest version counts. 💙` };
        case 'dad_mode':
            return { title: 'Before bed', body: `${open} still open. There is time${who}. Go and close them.` };
        case 'bully_mode':
            return { title: 'Still open', body: `${open}. The day is not over yet. Go.` };
        default:
            return { title: 'Before bed', body: `${open} not logged yet today.` };
    }
}
