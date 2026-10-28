/**
 * The Ascent: Habyss's first run, told as a conversation with Echo. It learns
 * who they are (name, what they carry, their day, their sleep, what gets in
 * the way, when work really happens), helps them choose a goal and a real
 * first step, and ends by building the Echo they need from all of it.
 *
 * This file is the story as data: every scene, every line, every question and
 * Echo's mood, as a function of what has been answered so far. The screen
 * only plays it (components/Ascent), the machine only walks it
 * (lib/ascent/machine.ts), the plan saves the goal and step
 * (lib/ascent/plan.ts) and the build saves Echo (lib/ascent/echoBuild.ts).
 *
 * Tone: warm, curious, a little playful. Never shame, never invented numbers,
 * never "you failed".
 */
import type { EchoMood } from '../echo';
import {
    CHRONOTYPES, JUGGLES, SLEEP_AMOUNTS, SOURCES, TIMINGS,
    type ChronotypeId, type JuggleId, type SleepAmountId, type SourceId, type TimingId,
} from '../onboardingProfile';
import { buildEcho } from './echoBuild';

export type Mood = EchoMood;

export type HistoryId = 'always' | 'sometimes' | 'rarely';
export type ObstacleId = 'starting' | 'consistency' | 'distraction' | 'overwhelm';
export type GoalId = 'discipline' | 'organized' | 'health' | 'achieve' | 'own';
export type WhenId = 'now' | 'later' | 'tomorrow';
export type ActionKind = 'task' | 'habit' | 'focus' | 'dump';

export interface Answers {
    name?: string;
    history?: HistoryId;
    /** Everything they are carrying at once. */
    juggling?: JuggleId[];
    chronotype?: ChronotypeId;
    /** "HH:MM": when their day starts and ends. */
    wake?: string;
    sleep?: string;
    sleepAmount?: SleepAmountId;
    obstacle?: ObstacleId;
    /** When work actually happens. */
    timing?: TimingId;
    goal?: GoalId;
    /** The goal in their words, for "something important" or "my own". */
    goalText?: string;
    /** The first step: one of the suggestions, or their own words. */
    action?: string;
    actionKind?: ActionKind;
    when?: WhenId;
    invite?: 'yes' | 'later';
    /** Where they heard about Habyss. */
    source?: SourceId;
}

export interface Option<T extends string = string> { id: T; label: string; icon?: string }

/** Answers that are one of a few choices. */
export type ChoiceField = 'history' | 'chronotype' | 'sleepAmount' | 'obstacle' | 'timing' | 'goal' | 'when' | 'invite' | 'source';

export type Beat =
    | { kind: 'line'; text: string; mood?: Mood }
    /** A choice that sets one answer. */
    | { kind: 'choice'; field: ChoiceField; options: Option[]; mood?: Mood }
    /** Several of a few choices (what they juggle). */
    | { kind: 'multi'; field: 'juggling'; options: Option[]; mood?: Mood }
    /** Words typed (or skipped, when optional). */
    | { kind: 'input'; field: 'name' | 'goalText'; placeholder: string; optional?: boolean; mood?: Mood }
    /** When the day starts and ends, set from their rhythm and adjustable. */
    | { kind: 'day'; mood?: Mood }
    /** The first step: suggestions for this person, or their own. */
    | { kind: 'action'; mood?: Mood }
    /** The goal and first step are saved here; the story waits for it. */
    | { kind: 'commit' }
    /** Their Echo is built and saved here: voice, day, nudges. */
    | { kind: 'build' }
    /** The last button. */
    | { kind: 'begin' };

export interface Scene {
    id: string;
    /** What the scene is for, said to VoiceOver as it opens. */
    label: string;
    beats: (answers: Answers) => Beat[];
}

const first = (answers: Answers) => {
    const word = (answers.name ?? '').trim().split(/\s+/)[0] ?? '';
    return word ? word.charAt(0).toUpperCase() + word.slice(1) : '';
};

export const GOALS: Record<GoalId, { label: string; title: string; icon: string }> = {
    discipline: { label: 'Become more disciplined', title: 'Become more disciplined', icon: 'shield-checkmark' },
    organized: { label: 'Get my life organized', title: 'Get my life organized', icon: 'albums' },
    health: { label: 'Improve my health', title: 'Improve my health', icon: 'heart' },
    achieve: { label: 'Achieve something important', title: '', icon: 'trophy' },
    own: { label: 'Something else', title: '', icon: 'flag' },
};

export const OBSTACLES: Option<ObstacleId>[] = [
    { id: 'starting', label: 'I struggle to get started' },
    { id: 'consistency', label: 'I can’t stay consistent' },
    { id: 'distraction', label: 'I get distracted' },
    { id: 'overwhelm', label: 'Everything feels overwhelming' },
];

/** The goal as it will be saved: its own words when they gave them. */
export function goalTitle(answers: Answers): string {
    const typed = answers.goalText?.trim();
    if (typed) return typed.charAt(0).toUpperCase() + typed.slice(1);
    return answers.goal ? GOALS[answers.goal].title || 'My goal' : 'My goal';
}

const options = <T extends string>(list: { id: T; label: string; icon?: string }[]): Option[] => list.map(({ id, label, icon }) => ({ id, label, icon }));

export const SCENES: Scene[] = [
    {
        id: 'first-light', label: 'Meeting Echo.',
        beats: answers => [
            { kind: 'line', text: 'Oh. Hey.', mood: 'appear' },
            { kind: 'line', text: 'Didn’t think I’d find someone else down here.', mood: 'curious' },
            { kind: 'line', text: 'I’m Echo.', mood: 'speak' },
            { kind: 'line', text: 'What should I call you?', mood: 'listen' },
            { kind: 'input', field: 'name', placeholder: 'Your name', optional: true, mood: 'listen' },
            { kind: 'line', text: first(answers) ? `Nice to meet you, ${first(answers)}.` : 'Mysterious. I like it.', mood: 'excited' },
        ],
    },
    {
        id: 'history', label: 'How they got here.',
        beats: answers => [
            { kind: 'line', text: 'So… how’d you end up here?', mood: 'curious' },
            { kind: 'line', text: 'Ever promised yourself you’d change something, and ended up right back where you started?', mood: 'listen' },
            { kind: 'choice', field: 'history', mood: 'listen', options: [
                { id: 'always', label: 'All the time.' },
                { id: 'sometimes', label: 'Sometimes.' },
                { id: 'rarely', label: 'Not really.' },
            ] },
            answers.history === 'always'
                ? { kind: 'line', text: 'Yeah. Starting over again and again can be exhausting.', mood: 'empathetic' }
                : answers.history === 'sometimes'
                    ? { kind: 'line', text: 'Fair enough. It happens to almost everyone.', mood: 'empathetic' }
                    : { kind: 'line', text: 'That’s good. Maybe you’re here to see how much further you can go.', mood: 'encourage' },
        ],
    },
    {
        id: 'life', label: 'What they are carrying.',
        beats: answers => [
            { kind: 'line', text: 'Tell me about your days. What are you juggling right now?', mood: 'listen' },
            { kind: 'multi', field: 'juggling', options: options(JUGGLES), mood: 'listen' },
            (answers.juggling?.length ?? 0) >= 3
                ? { kind: 'line', text: 'That’s a lot to carry. We’ll make it lighter.', mood: 'empathetic' }
                : { kind: 'line', text: 'Good. Then there’s room for what matters most.', mood: 'encourage' },
        ],
    },
    {
        id: 'rhythm', label: 'Their day and their sleep.',
        beats: answers => [
            { kind: 'line', text: 'Are you more of a morning person, or a night owl?', mood: 'curious' },
            { kind: 'choice', field: 'chronotype', mood: 'listen', options: options(CHRONOTYPES) },
            { kind: 'line', text: 'When does your day usually start and end?', mood: 'listen' },
            { kind: 'day', mood: 'listen' },
            { kind: 'line', text: 'And honestly, how much sleep do you actually get?', mood: 'listen' },
            { kind: 'choice', field: 'sleepAmount', mood: 'listen', options: options(SLEEP_AMOUNTS) },
            answers.sleepAmount === 'under_six'
                ? { kind: 'line', text: 'Running on empty, then. I’ll go easy on your mornings.', mood: 'empathetic' }
                : { kind: 'line', text: 'Good. A rested mind climbs further.', mood: 'encourage' },
        ],
    },
    {
        id: 'mirror', label: 'What gets in the way.',
        beats: answers => [
            { kind: 'line', text: 'Everyone gets stuck differently. What tends to get in your way?', mood: 'think' },
            { kind: 'choice', field: 'obstacle', mood: 'listen', options: OBSTACLES },
            { kind: 'line', mood: 'empathetic', text:
                answers.obstacle === 'starting' ? 'Starting can feel bigger than the thing itself.'
                    : answers.obstacle === 'consistency' ? 'You know where you want to go. Keeping it going is the hard part.'
                        : answers.obstacle === 'distraction' ? 'So many things pulling at your attention.'
                            : 'When everything seems important, it’s hard to know where to begin.' },
            { kind: 'line', text: 'When does work actually get done for you?', mood: 'curious' },
            { kind: 'choice', field: 'timing', mood: 'listen', options: options(TIMINGS) },
            { kind: 'line', text: 'Motivation gives you a spark. But sparks don’t last.', mood: 'think' },
            { kind: 'line', text: 'So we’ll build something that keeps going when the spark doesn’t. Small steps count.', mood: 'encourage' },
        ],
    },
    {
        id: 'goal', label: 'Where they want to go.',
        beats: answers => [
            { kind: 'line', text: 'Enough about what keeps you down here. Where do you want to go?', mood: 'encourage' },
            { kind: 'choice', field: 'goal', mood: 'listen', options: (Object.keys(GOALS) as GoalId[]).map(id => ({ id, label: GOALS[id].label })) },
            ...(answers.goal === 'achieve' || answers.goal === 'own'
                ? [{ kind: 'input', field: 'goalText', placeholder: answers.goal === 'achieve' ? 'Finish my degree' : 'Write it in your words', mood: 'listen' } as Beat]
                : []),
            { kind: 'line', text: `${goalTitle(answers)}. That’s worth working toward.`, mood: 'excited' },
        ],
    },
    {
        id: 'foothold', label: 'The first step.',
        beats: () => [
            { kind: 'line', text: 'Now let’s make it real. What’s one small thing you could do to move closer?', mood: 'listen' },
            { kind: 'action', mood: 'listen' },
            { kind: 'line', text: 'When?', mood: 'listen' },
            { kind: 'choice', field: 'when', mood: 'listen', options: [
                { id: 'now', label: 'Right now' },
                { id: 'later', label: 'Later today' },
                { id: 'tomorrow', label: 'Tomorrow morning' },
            ] },
            { kind: 'commit' },
            { kind: 'line', text: 'There. Your first step.', mood: 'celebrate' },
        ],
    },
    {
        id: 'allies', label: 'Someone to come along.',
        beats: answers => [
            { kind: 'line', text: 'You don’t have to do this alone. Want someone to come along?', mood: 'encourage' },
            { kind: 'choice', field: 'invite', mood: 'listen', options: [
                { id: 'yes', label: 'Invite a friend' },
                { id: 'later', label: 'Maybe later' },
            ] },
            { kind: 'line', mood: 'speak', text: answers.invite === 'yes' ? 'The more the merrier.' : 'Whenever you’re ready.' },
            { kind: 'line', text: 'One last thing: how did you find me?', mood: 'curious' },
            { kind: 'choice', field: 'source', mood: 'listen', options: options(SOURCES) },
        ],
    },
    {
        id: 'your-echo', label: 'Echo, built for them.',
        beats: answers => {
            const echo = buildEcho(answers);
            return [
                { kind: 'line', text: 'I’ve learned a lot about you. Now let me become the Echo you need.', mood: 'think' },
                { kind: 'line', text: 'To keep you on track, I’ll ask if I can send you notifications.', mood: 'speak' },
                { kind: 'build' },
                { kind: 'line', text: first(answers) ? `There. I’m your Echo now, ${first(answers)}.` : 'There. I’m your Echo now.', mood: 'celebrate' },
                { kind: 'line', text: echo.reason, mood: 'speak' },
                { kind: 'line', text: 'You have somewhere to go, and a first step. The rest, we build one day at a time.', mood: 'encourage' },
                { kind: 'begin' },
            ];
        },
    },
];

export interface Suggestion { label: string; kind: ActionKind; minutes: number }

/**
 * The first steps offered, for this obstacle and goal: small enough to do
 * today (starting: two minutes; consistency: one daily habit; distraction: a
 * short focus; overwhelm: emptying the head and choosing one thing).
 */
export function suggestions(answers: Answers): Suggestion[] {
    const goal = answers.goal ?? 'own';
    const habitFor: Record<GoalId, string> = {
        discipline: 'Make my bed every morning',
        organized: 'Plan tomorrow in five minutes',
        health: 'A ten-minute walk',
        achieve: 'Ten minutes on it every day',
        own: 'Ten minutes on it every day',
    };
    const byObstacle: Record<ObstacleId, Suggestion> = {
        starting: { label: 'Two minutes on the most important thing', kind: 'task', minutes: 2 },
        consistency: { label: habitFor[goal], kind: 'habit', minutes: goal === 'organized' ? 5 : 10 },
        distraction: { label: 'A ten-minute focus session', kind: 'focus', minutes: 10 },
        overwhelm: { label: 'Write down what’s on my mind, then pick one priority', kind: 'dump', minutes: 10 },
    };
    const lead = byObstacle[answers.obstacle ?? 'starting'];
    const others = (Object.keys(byObstacle) as ObstacleId[])
        .filter(id => id !== (answers.obstacle ?? 'starting'))
        .map(id => byObstacle[id])
        .slice(0, 2);
    return [lead, ...others];
}
