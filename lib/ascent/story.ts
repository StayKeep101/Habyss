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
            { kind: 'line', text: 'Hey. I’m Echo.', mood: 'appear' },
            { kind: 'line', text: 'What should I call you?', mood: 'listen' },
            { kind: 'input', field: 'name', placeholder: 'Your name', optional: true, mood: 'listen' },
            { kind: 'line', text: first(answers) ? `${first(answers)}. Good to meet you.` : 'A mystery. Fair enough.', mood: 'excited' },
        ],
    },
    {
        id: 'history', label: 'How they got here.',
        beats: answers => [
            { kind: 'line', text: 'Ever promised yourself you’d change, then ended up back at square one?', mood: 'curious' },
            { kind: 'choice', field: 'history', mood: 'listen', options: [
                { id: 'always', label: 'All the time' },
                { id: 'sometimes', label: 'Sometimes' },
                { id: 'rarely', label: 'Not really' },
            ] },
            answers.history === 'always'
                ? { kind: 'line', text: 'Most people have. It’s rarely willpower. It’s the plan.', mood: 'empathetic' }
                : answers.history === 'sometimes'
                    ? { kind: 'line', text: 'Normal. Let’s make the next one stick.', mood: 'empathetic' }
                    : { kind: 'line', text: 'Love that. Then let’s aim higher.', mood: 'encourage' },
        ],
    },
    {
        id: 'life', label: 'What they are carrying.',
        beats: answers => [
            { kind: 'line', text: 'What’s on your plate right now?', mood: 'listen' },
            { kind: 'multi', field: 'juggling', options: options(JUGGLES), mood: 'listen' },
            (answers.juggling?.length ?? 0) >= 3
                ? { kind: 'line', text: 'That’s a lot. We’ll guard time for what matters.', mood: 'empathetic' }
                : { kind: 'line', text: 'Good. Room to go deep.', mood: 'encourage' },
        ],
    },
    {
        id: 'rhythm', label: 'Their day and their sleep.',
        beats: answers => [
            { kind: 'line', text: 'Morning person or night owl?', mood: 'curious' },
            { kind: 'choice', field: 'chronotype', mood: 'listen', options: options(CHRONOTYPES) },
            { kind: 'line', text: 'When’s your day, roughly?', mood: 'listen' },
            { kind: 'day', mood: 'listen' },
            { kind: 'line', text: 'Real talk: how much do you sleep?', mood: 'listen' },
            { kind: 'choice', field: 'sleepAmount', mood: 'listen', options: options(SLEEP_AMOUNTS) },
            answers.sleepAmount === 'under_six'
                ? { kind: 'line', text: 'Let’s work on that. Everything’s harder tired.', mood: 'empathetic' }
                : { kind: 'line', text: 'Nice. That’s half the battle.', mood: 'encourage' },
        ],
    },
    {
        id: 'mirror', label: 'What gets in the way.',
        beats: answers => [
            { kind: 'line', text: 'What usually gets in your way?', mood: 'think' },
            { kind: 'choice', field: 'obstacle', mood: 'listen', options: OBSTACLES },
            { kind: 'line', mood: 'encourage', text:
                answers.obstacle === 'starting' ? 'Then we make starting tiny. Two minutes counts.'
                    : answers.obstacle === 'consistency' ? 'Then missing a day is fine. Just never twice in a row.'
                        : answers.obstacle === 'distraction' ? 'Then we fence off your focus. One thing at a time.'
                            : 'Then we pick one thing. The rest can wait.' },
            { kind: 'line', text: 'When does work actually get done?', mood: 'curious' },
            { kind: 'choice', field: 'timing', mood: 'listen', options: options(TIMINGS) },
            { kind: 'line', mood: 'speak', text:
                answers.timing === 'last_minute' ? 'Deadlines work for you. I’ll set earlier ones.'
                    : answers.timing === 'straight_away' ? 'Love that. I’ll keep up.'
                        : answers.timing === 'planned' ? 'A planner. I can work with that.'
                            : 'Honest. We’ll start small.' },
        ],
    },
    {
        id: 'goal', label: 'Where they want to go.',
        beats: answers => [
            { kind: 'line', text: 'So what do you want to work toward?', mood: 'curious' },
            { kind: 'choice', field: 'goal', mood: 'listen', options: (Object.keys(GOALS) as GoalId[]).map(id => ({ id, label: GOALS[id].label })) },
            ...(answers.goal === 'achieve' || answers.goal === 'own'
                ? [{ kind: 'input', field: 'goalText', placeholder: answers.goal === 'achieve' ? 'Finish my degree' : 'In your words', mood: 'listen' } as Beat]
                : []),
            { kind: 'line', text: `${goalTitle(answers)}. Let’s do it.`, mood: 'excited' },
        ],
    },
    {
        id: 'foothold', label: 'The first step.',
        beats: () => [
            { kind: 'line', text: 'What’s one tiny step toward it?', mood: 'listen' },
            { kind: 'action', mood: 'listen' },
            { kind: 'line', text: 'When?', mood: 'listen' },
            { kind: 'choice', field: 'when', mood: 'listen', options: [
                { id: 'now', label: 'Right now' },
                { id: 'later', label: 'Later today' },
                { id: 'tomorrow', label: 'Tomorrow morning' },
            ] },
            { kind: 'commit' },
            { kind: 'line', text: 'Done. That’s your first step.', mood: 'celebrate' },
        ],
    },
    {
        id: 'allies', label: 'Someone to come along.',
        beats: () => [
            { kind: 'line', text: 'Bring a friend? It’s easier with someone in your corner.', mood: 'encourage' },
            { kind: 'choice', field: 'invite', mood: 'listen', options: [
                { id: 'yes', label: 'Invite a friend' },
                { id: 'later', label: 'Maybe later' },
            ] },
            { kind: 'line', text: 'Last one: how’d you find me?', mood: 'curious' },
            { kind: 'choice', field: 'source', mood: 'listen', options: options(SOURCES) },
        ],
    },
    {
        id: 'your-echo', label: 'Echo, built for them.',
        beats: answers => [
            { kind: 'line', text: 'Got it. Let me tune myself to you. I’ll ask to send you nudges.', mood: 'think' },
            { kind: 'build' },
            { kind: 'line', text: `${first(answers) ? `Ready, ${first(answers)}. ` : 'Ready. '}${buildEcho(answers).reason}`, mood: 'celebrate' },
            { kind: 'begin' },
        ],
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
