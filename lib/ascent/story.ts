/**
 * The Ascent: Habyss's first run, told as a conversation with Echo deep in
 * an abyss, ending with a real goal and a real first step, and the climb into
 * the app. This file is the story as data: every scene, every line, every
 * choice, Echo's mood and the cue the world plays, as a function of what has
 * been answered so far. The screen only plays it (components/Ascent), the
 * machine only walks it (lib/ascent/machine.ts), and the plan only saves what
 * it decided (lib/ascent/plan.ts).
 *
 * Tone: warm, curious, a little playful. Never shame, never invented numbers,
 * never "you failed". The urgency is only that a first step can be today.
 */

import type { EchoMood } from '../echo';

export type Mood = EchoMood;

/** What the world does on a beat (components/Ascent/AbyssWorld.tsx reads these). */
export type Cue =
    | 'ECO_APPEAR' | 'CAMERA_DRIFT' | 'NAME_CONFIRMED'
    | 'CAMERA_DESCEND' | 'FRAGMENTS'
    | 'OBSTACLE_REVEAL'
    | 'FLAME_IGNITE' | 'FLAME_FADE' | 'SYSTEM_REVEAL'
    | 'DOMINO_READY' | 'CHAIN_REACTION'
    | 'CAMERA_LOOK_UP' | 'GOAL_MATERIALIZE'
    | 'FIRST_STEP_CREATED'
    | 'ALLIES_APPEAR'
    | 'CAMERA_ASCEND';

export type HistoryId = 'always' | 'sometimes' | 'rarely';
export type ObstacleId = 'starting' | 'consistency' | 'distraction' | 'overwhelm';
export type GoalId = 'discipline' | 'organized' | 'health' | 'achieve' | 'own';
export type WhenId = 'now' | 'later' | 'tomorrow';
export type ActionKind = 'task' | 'habit' | 'focus' | 'dump';

export interface Answers {
    name?: string;
    history?: HistoryId;
    obstacle?: ObstacleId;
    goal?: GoalId;
    /** The goal in their words, for "something important" or "my own". */
    goalText?: string;
    /** The first step: one of the suggestions, or their own words. */
    action?: string;
    actionKind?: ActionKind;
    when?: WhenId;
    invite?: 'yes' | 'later';
}

export interface Option<T extends string = string> { id: T; label: string }

export type Beat =
    | { kind: 'line'; text: string; mood?: Mood; cue?: Cue }
    /** A choice that sets one answer. */
    | { kind: 'choice'; field: 'history' | 'obstacle' | 'goal' | 'when' | 'invite'; options: Option[]; mood?: Mood }
    /** Words typed (or skipped, when optional). */
    | { kind: 'input'; field: 'name' | 'goalText'; placeholder: string; optional?: boolean; mood?: Mood }
    /** The first step: suggestions for this person, or their own. */
    | { kind: 'action'; mood?: Mood }
    /** A touch the scene waits for (the first domino). */
    | { kind: 'touch'; label: string; cue: Cue; mood?: Mood }
    /** The goal and first step are saved here; the story waits for it. */
    | { kind: 'commit' }
    /** The last button: Begin my ascent. */
    | { kind: 'begin' };

export interface Scene {
    id: string;
    /** Played as the scene opens. */
    cue?: Cue;
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

export const SCENES: Scene[] = [
    {
        id: 'first-light', cue: 'ECO_APPEAR', label: 'Darkness, and a small light.',
        beats: answers => [
            { kind: 'line', text: 'Oh. Hey.', mood: 'appear' },
            { kind: 'line', text: 'Didn’t think I’d find someone else down here.', mood: 'curious', cue: 'CAMERA_DRIFT' },
            { kind: 'line', text: 'I’m Echo.', mood: 'speak' },
            { kind: 'line', text: 'What should I call you?', mood: 'listen' },
            { kind: 'input', field: 'name', placeholder: 'Your name', optional: true, mood: 'listen' },
            { kind: 'line', text: first(answers) ? `Nice to meet you, ${first(answers)}.` : 'Mysterious. I like it.', mood: 'excited', cue: 'NAME_CONFIRMED' },
        ],
    },
    {
        id: 'descent', cue: 'CAMERA_DESCEND', label: 'Sinking past old plans and calendars.',
        beats: answers => [
            { kind: 'line', text: 'So… how’d you end up here?', mood: 'curious', cue: 'FRAGMENTS' },
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
        id: 'mirror', label: 'The thing that gets in the way.',
        beats: answers => [
            { kind: 'line', text: 'Everyone gets stuck differently.', mood: 'think' },
            { kind: 'line', text: 'What tends to get in your way?', mood: 'listen' },
            { kind: 'choice', field: 'obstacle', mood: 'listen', options: OBSTACLES },
            { kind: 'line', mood: 'empathetic', cue: 'OBSTACLE_REVEAL', text:
                answers.obstacle === 'starting' ? 'Starting can feel bigger than the thing itself.'
                    : answers.obstacle === 'consistency' ? 'You know where you want to go. Keeping it going is the hard part.'
                        : answers.obstacle === 'distraction' ? 'So many things pulling at your attention.'
                            : 'When everything seems important, it’s hard to know where to begin.' },
        ],
    },
    {
        id: 'spark', label: 'A flame, and a path of stones.',
        beats: () => [
            { kind: 'line', text: 'Can I show you something?', mood: 'curious' },
            { kind: 'line', text: 'Motivation gives you a spark.', mood: 'speak', cue: 'FLAME_IGNITE' },
            { kind: 'line', text: 'But sparks don’t last.', mood: 'think', cue: 'FLAME_FADE' },
            { kind: 'line', text: 'That’s why we build something that keeps going when the spark doesn’t.', mood: 'encourage', cue: 'SYSTEM_REVEAL' },
        ],
    },
    {
        id: 'domino', label: 'One small domino.',
        beats: () => [
            { kind: 'line', text: 'See that little thing?', mood: 'curious', cue: 'DOMINO_READY' },
            { kind: 'touch', label: 'Touch the domino', cue: 'CHAIN_REACTION', mood: 'listen' },
            { kind: 'line', text: 'Not a very big move, was it?', mood: 'excited' },
            { kind: 'line', text: 'Sometimes the hardest part is just getting things moving.', mood: 'speak' },
            { kind: 'line', text: 'Small steps count.', mood: 'encourage' },
        ],
    },
    {
        id: 'turning-point', cue: 'CAMERA_LOOK_UP', label: 'Looking up for the first time: a light far above.',
        beats: answers => [
            { kind: 'line', text: 'Alright.', mood: 'speak' },
            { kind: 'line', text: 'Enough about what keeps you down here. Let’s talk about where you want to go.', mood: 'encourage' },
            { kind: 'line', text: 'What would you like to work toward?', mood: 'listen' },
            { kind: 'choice', field: 'goal', mood: 'listen', options: (Object.keys(GOALS) as GoalId[]).map(id => ({ id, label: GOALS[id].label })) },
            ...(answers.goal === 'achieve' || answers.goal === 'own'
                ? [{ kind: 'input', field: 'goalText', placeholder: answers.goal === 'achieve' ? 'Finish my degree' : 'Write it in your words', mood: 'listen' } as Beat]
                : []),
            { kind: 'line', text: `${goalTitle(answers)}. That’s worth working toward.`, mood: 'excited', cue: 'GOAL_MATERIALIZE' },
        ],
    },
    {
        id: 'foothold', label: 'The first foothold.',
        beats: () => [
            { kind: 'line', text: 'Now let’s make it real.', mood: 'speak' },
            { kind: 'line', text: 'What’s one small thing you could do to move closer?', mood: 'listen' },
            { kind: 'action', mood: 'listen' },
            { kind: 'line', text: 'When?', mood: 'listen' },
            { kind: 'choice', field: 'when', mood: 'listen', options: [
                { id: 'now', label: 'Right now' },
                { id: 'later', label: 'Later today' },
                { id: 'tomorrow', label: 'Tomorrow morning' },
            ] },
            { kind: 'commit' },
            { kind: 'line', text: 'There. Your first step.', mood: 'celebrate', cue: 'FIRST_STEP_CREATED' },
            { kind: 'line', text: 'That’s how we start.', mood: 'encourage' },
        ],
    },
    {
        id: 'allies', cue: 'ALLIES_APPEAR', label: 'Other lights along nearby paths.',
        beats: answers => [
            { kind: 'line', text: 'You know something nice about climbing?', mood: 'curious' },
            { kind: 'line', text: 'You don’t have to do it alone.', mood: 'encourage' },
            { kind: 'line', text: 'Want someone to come along?', mood: 'listen' },
            { kind: 'choice', field: 'invite', mood: 'listen', options: [
                { id: 'yes', label: 'Invite a friend' },
                { id: 'later', label: 'Maybe later' },
            ] },
            { kind: 'line', mood: 'speak', text: answers.invite === 'yes' ? 'The more the merrier.' : 'Whenever you’re ready. They’ll be here.' },
        ],
    },
    {
        id: 'ascent', cue: 'CAMERA_LOOK_UP', label: 'Looking up at the opening above.',
        beats: () => [
            { kind: 'line', text: 'Look up.', mood: 'speak' },
            { kind: 'line', text: 'You have somewhere you want to go.', mood: 'encourage' },
            { kind: 'line', text: 'And now you have a first step.', mood: 'excited' },
            { kind: 'line', text: 'The rest? We build it one day at a time.', mood: 'celebrate' },
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

/**
 * Evidence, offered rather than lectured: short, accurate, with where it comes
 * from. Shown as an optional "discovery" after the scene it belongs to.
 */
export const DISCOVERIES: Record<string, { title: string; body: string; source: string }> = {
    domino: {
        title: 'Habits take time, and a missed day is fine',
        body: 'In a study of people building a new daily habit, it took a median of 66 days for it to feel automatic, ranging widely from 18 to 254. Missing a single day did not meaningfully set people back.',
        source: 'Lally, van Jaarsveld, Potts & Wardle (2010), European Journal of Social Psychology, 40(6), 998–1009.',
    },
    foothold: {
        title: 'Deciding when makes it likelier',
        body: 'Plans that say when and where (“after breakfast, at my desk, I will…”) help people follow through. A review of 94 studies found a medium-to-large effect on reaching goals.',
        source: 'Gollwitzer & Sheeran (2006), Advances in Experimental Social Psychology, 38, 69–119.',
    },
};
