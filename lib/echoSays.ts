import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PersonalityModeId } from '@/constants/AIPersonalities';
import { clockLabel, type DayFlow, type FlowItem } from './dayFlow';
import { keepsTheFacts, talkingPoints, writtenLines, type Deadline, type EchoBrief } from './echoBrief';
import { pickFresh, saidLines, shuffled, type Option, type Said } from './echoRecent';

/** Bounds that keep Echo as quick in year five as on day one: only today, only the few that matter. */
const CAP = { friends: 3, duels: 5, above: 50 } as const;

/**
 * Echo, saying the one thing most worth saying right now (lib/echoBrief.ts).
 *
 * Built so years of use never slow it down: only today's timeline (never the
 * history), the newest 20 feed posts, active duels, a handful of friends, and
 * one talking point handed to the model, so its prompt is the same size on the
 * first day and the thousandth.
 *
 * The brief is built from today's timeline as it stands (it is planned from
 * waking and follows every tick, addition and early finish), and from what
 * your friends, your rank and your duels are doing. Those last are read from
 * the server at most every few minutes and kept in between, so Echo always has
 * them without slowing anything down.
 */

const doable = (row: FlowItem) => row.kind === 'habit' || row.kind === 'task';

/** The day as the timeline has it, at this minute. Pure. */
export function dayFacts(flow: DayFlow | null, now: number): Pick<EchoBrief, 'onNow' | 'next' | 'freeFor' | 'missed' | 'done' | 'total' | 'early'> {
    const rows = (flow?.timeline ?? []).filter(doable);
    const ids = [...new Set(rows.map(row => row.id))];
    const whole = (id: string) => { const parts = rows.filter(row => row.id === id); return { first: parts[0], start: Math.min(...parts.map(p => p.start)), end: Math.max(...parts.map(p => p.end)) }; };
    const current = flow?.current && doable(flow.current) ? flow.current : null;
    // An event counts as on now too (a class, a meeting): opening the app during it is worth a word.
    const event = !current && flow?.current?.kind === 'event' && !flow.current.done ? flow.current : null;
    const onNow = current ? (() => { const w = whole(current.id); return { title: current.title, minutesIn: Math.max(0, now - w.start), minutesLeft: Math.max(0, w.end - now) }; })()
        : event ? { title: event.title, minutesIn: Math.max(0, now - event.start), minutesLeft: Math.max(0, event.end - now) } : undefined;
    const upcoming = (flow?.timeline ?? []).filter(row => !row.done && row.start > now && (doable(row) || row.kind === 'meal' || row.kind === 'event'))
        .sort((a, b) => a.start - b.start)[0];
    const next = upcoming ? { title: upcoming.title, at: clockLabel(upcoming.start) } : undefined;
    const missed = ids.filter(id => { const w = whole(id); return !w.first.done && w.end <= now; }).map(id => whole(id).first.title);
    const done = ids.filter(id => whole(id).first.done).length;
    const recent = rows.filter(row => row.done && row.doneAt !== undefined && row.planned && row.planned.end - row.doneAt >= 5 && now - row.doneAt <= 30)
        .sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0))[0];
    return {
        onNow, next, missed, done, total: ids.length,
        freeFor: !current && upcoming ? upcoming.start - now : undefined,
        early: recent ? { title: recent.title, minutes: recent.planned!.end - recent.doneAt! } : undefined,
    };
}

/* ------------------------------------------------------------ around you */

type Around = Pick<EchoBrief, 'passedBy' | 'rank' | 'duels' | 'friendsDone' | 'friendsFocusing'>;
const AROUND_MS = 5 * 60_000;
const BOARD_KEY = 'habyss_echo_board';
let around: { at: number; value: Around } | null = null;

/** Your rank, who just passed you, your duels, friends done and focusing. Read at most every five minutes. */
async function aroundYou(): Promise<Around> {
    if (around && Date.now() - around.at < AROUND_MS) return around.value;
    const value: Around = { duels: [], friendsDone: [], friendsFocusing: [] };
    const { FeedService } = require('./feedService') as typeof import('./feedService');
    const today = (require('./habitSchedule') as typeof import('./habitSchedule')).localDateKey(new Date());
    await Promise.all([
        // The board, against the order Echo last saw: anyone now above you who was below you passed you.
        FeedService.leaderboard('friends').then(async board => {
            const me = board.find(row => row.isMe);
            if (!me) return;
            value.rank = me.rank;
            const above = board.filter(row => row.rank < me.rank).map(row => row.userId).slice(0, CAP.above);
            const before = JSON.parse((await AsyncStorage.getItem(BOARD_KEY).catch(() => null)) ?? 'null') as { above: string[] } | null;
            const passer = before ? board.find(row => above.includes(row.userId) && !before.above.includes(row.userId)) : undefined;
            if (passer) value.passedBy = { name: passer.name.split(' ')[0], rank: me.rank };
            await AsyncStorage.setItem(BOARD_KEY, JSON.stringify({ above })).catch(() => undefined);
        }).catch(() => undefined),
        (require('./duels') as typeof import('./duels')).myDuels().then(duels => {
            const { daysLeft } = require('./duels') as typeof import('./duels');
            const share = (score: { done: number; total: number }) => (score.total > 0 ? Math.round((score.done / score.total) * 100) : 0);
            value.duels = duels.filter(duel => duel.status === 'active')
                .map(duel => ({ name: duel.name.split(' ')[0], me: share(duel.me), them: share(duel.them), daysLeft: daysLeft(duel.ends) })).slice(0, CAP.duels);
        }).catch(() => undefined),
        FeedService.feed(undefined, 20).then(posts => {
            value.friendsDone = posts.filter(post => !post.mine && post.day === today)
                .filter(post => { const total = post.card.habitsTotal + post.card.tasksTotal; return total > 0 && post.card.habitsDone + post.card.tasksDone >= total; })
                .map(post => ({ name: post.name.split(' ')[0], done: post.card.habitsDone + post.card.tasksDone })).slice(0, CAP.friends);
        }).catch(() => undefined),
        FeedService.friendStatuses().then(statuses => {
            const now = Date.now();
            value.friendsFocusing = statuses.filter(row => row.focusUntil && (row.focusOpen || Date.parse(row.focusUntil) > now))
                .map(row => ({ name: row.name.split(' ')[0], on: row.focusLabel ?? undefined })).slice(0, CAP.friends);
        }).catch(() => undefined),
    ]);
    around = { at: Date.now(), value };
    return value;
}

/** Forget what was read around you (a new day, signing out). */
export function forgetAround() { around = null; }

/* ------------------------------------------------------------ the brief */

export async function buildBrief(input: { name?: string; streak: number; now?: Date; deadlines?: Deadline[] }): Promise<EchoBrief> {
    const at = input.now ?? new Date();
    const minute = at.getHours() * 60 + at.getMinutes();
    const { currentTodayFlow } = require('./todayFlow') as typeof import('./todayFlow');
    const [flow, near, scrolled] = await Promise.all([
        currentTodayFlow(at).catch(() => null),
        aroundYou().catch((): Around => ({ duels: [], friendsDone: [], friendsFocusing: [] })),
        (require('./ScreenTimeService') as typeof import('./ScreenTimeService')).ScreenTimeService.scrolledToday().catch(() => null),
    ]);
    return { now: minute, name: input.name, streak: input.streak, ...dayFacts(flow, minute), ...near, scrolled: scrolled ?? undefined, deadlines: input.deadlines };
}

/* ------------------------------------------------------------ saying it */

/** Who Echo is, in a few plain words: the model gets the voice, never a list of phrases to stir together. */
const VOICE: Record<PersonalityModeId, string> = {
    friendly: 'a warm, encouraging best friend',
    normal: 'a calm, direct coach',
    dad_mode: 'a stern father who expects results',
    bully_mode: 'a harsh drill sergeant who swears',
    goofball: 'a sarcastic, funny friend',
};

/**
 * What Echo could say now: every talking point, most important first, each
 * with all its written variants in a random order. A topic is the point and
 * what it is about ("onNow:Study"), so the same thing is not raised twice in
 * a row, however it is worded.
 */
export function echoOptions(voice: PersonalityModeId, brief: EchoBrief, random: () => number = Math.random): Option[] {
    return talkingPoints(brief).flatMap(point => shuffled(writtenLines(point, brief, voice), random)
        .map(line => ({ topic: `${point.kind}:${point.keys.join('|')}`, line })));
}

let rewroteAt = 0;
/** The model speaks at most every few minutes: Home asks on every tick, and running it each time kept the phone warm. */
const REWRITE_EVERY = 4 * 60_000;

/**
 * Echo's line for now and what it is about, or null when everything worth
 * saying was just said (the caller then says something else: a pattern, a
 * quote, a piece of advice). Never a line said lately, never the topic it
 * just raised (lib/echoRecent.ts).
 *
 * Now and then the on-device model says it instead, as a person would: it is
 * told what is happening and how a coach would put it, and answers in its own
 * words. Its answer is kept only when it keeps every name and number and reads
 * as a real sentence; otherwise the written line.
 */
export async function echoSays(voice: PersonalityModeId, brief: EchoBrief, said: Said[]): Promise<Option | null> {
    const chosen = pickFresh(echoOptions(voice, brief), said);
    if (!chosen) return null;
    const point = talkingPoints(brief).find(item => chosen.topic === `${item.kind}:${item.keys.join('|')}`)!;

    const { currentEngine, askForLine } = require('./onDeviceAI') as typeof import('./onDeviceAI');
    if (currentEngine('voice') && Date.now() - rewroteAt >= REWRITE_EVERY) {
        rewroteAt = Date.now();
        const lately = saidLines(said).slice(0, 4);
        const rewritten = await askForLine(
            `You are Echo, ${VOICE[voice] ?? VOICE.normal}. You are a real person texting ${brief.name ? brief.name.split(' ')[0] : 'the user'}, not an app. `
            + 'They just picked up their phone and are reading you. React to what is happening the way a human coach would: notice it, call it out, '
            + 'and if it helps, give one short practical tip. Keep every name, title and number exactly as written. One or two short sentences. No quotation marks.'
            + (lately.length ? ` Do not repeat anything like these, said already: ${lately.join(' / ')}` : ''),
            `What is happening: ${point.facts}\nThe sort of thing you might say: ${chosen.line}`,
        ).catch(() => null);
        if (keepsTheFacts(rewritten, point)) {
            const line = rewritten.replace(/^["“]+|["”]+$/g, '').trim();
            if (!lately.includes(line)) return { topic: chosen.topic, line };
        }
    }
    return chosen;
}
