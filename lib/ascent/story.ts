/**
 * The Ascent: Habyss's first run, told as a story with Echo. It starts in the
 * dark and climbs out, and the lore is shown, never explained:
 *
 * - the Abyss is felt before it is named: the pull back to square one;
 * - Echo arrives as what they heard in the dark, a ripple in time;
 * - Chronos is the clock that never stops, and gives everyone the same 24;
 * - time is the enemy (the years a screen takes) and the friend (what thirty
 *   minutes a day becomes, what 1% a day compounds to).
 *
 * Along the way Echo asks what a curious friend would, and every answer
 * shapes their plan and their Echo. Under each question is a reason it is
 * asked, and where it sits:
 *
 * - their name: everything after is personal, and people stay with what
 *   knows them;
 * - "back at square one?": they name the problem themselves, so the fix is
 *   theirs; never blamed on them, always on the plan;
 * - their day and sleep: the 24 hours made concrete, their own;
 * - screen hours and age: the cost of doing nothing, worked out in their own
 *   numbers (the years shown are arithmetic, never invented);
 * - "what would you learn?": a desire they chose, set against the same time
 *   scrolled, so the choice is between two futures, not a chore;
 * - motivation against discipline, and the compounding: a new reason the
 *   last attempt did not stick, and why this one will;
 * - what gets in the way, and when work happens: the answer is built around it;
 * - 90 days going perfectly: they picture the result before they start;
 * - one tiny first step, scheduled: the smallest yes, made real;
 * - a friend: someone in their corner keeps them coming back;
 * - their Echo built from all of it, then a hold to rise: it is theirs, and
 *   they chose to begin.
 *
 * This file is the story as data: every scene, line, question, Echo's mood
 * and what Echo becomes on screen (`stage`), as a function of what has been
 * answered. The screen plays it (components/Ascent), the machine walks it
 * (lib/ascent/machine.ts), the plan saves the goal and step
 * (lib/ascent/plan.ts) and the build saves Echo (lib/ascent/echoBuild.ts).
 *
 * Tone: warm, curious, short. Never shame, never invented numbers, never
 * "you failed".
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
export type GoalId = 'discipline' | 'organized' | 'health' | 'skill' | 'career' | 'calm' | 'own';
export type WhenId = 'now' | 'later' | 'tomorrow';
export type ActionKind = 'task' | 'habit' | 'focus' | 'dump';
export type PhoneId = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
export type SkillId = 'morse' | 'language' | 'guitar' | 'typing' | 'code' | 'drawing';

/**
 * What Echo becomes on screen while a line is said: itself, or one of the
 * explainers it shapeshifts into (components/Ascent/Explainers.tsx). Each
 * explainer is built like a slide, piece by piece: a line's `step` says how
 * far it has got, so the picture moves on with the conversation.
 */
export type StageId = 'echo' | 'clock' | 'cost' | 'trade' | 'motivation' | 'compound';

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
    /** Hours a day on the phone outside work. */
    phone?: PhoneId;
    /** In years, as typed. */
    age?: number;
    /** What they would learn with thirty minutes a day. */
    skill?: SkillId;
    obstacle?: ObstacleId;
    /** When work actually happens. */
    timing?: TimingId;
    goal?: GoalId;
    /** The goal in their words, when it is none of the choices. */
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
export type ChoiceField = 'history' | 'chronotype' | 'sleepAmount' | 'phone' | 'skill' | 'obstacle' | 'timing' | 'goal' | 'when' | 'invite' | 'source';

export type Beat =
    | { kind: 'line'; text: string; mood?: Mood; stage?: StageId; step?: number }
    /** A choice that sets one answer; `own` adds "Something else", typed, saved to that field. */
    | { kind: 'choice'; field: ChoiceField; options: Option[]; mood?: Mood; own?: { field: 'goalText'; label: string; placeholder: string } }
    /** Several of a few choices (what they juggle). */
    | { kind: 'multi'; field: 'juggling'; options: Option[]; mood?: Mood }
    /** Words typed (or skipped, when optional). */
    | { kind: 'input'; field: 'name'; placeholder: string; optional?: boolean; mood?: Mood }
    /** A number typed: their age. */
    | { kind: 'number'; field: 'age'; placeholder: string; min: number; max: number; mood?: Mood }
    /** When the day starts and ends, set from their rhythm and adjustable. */
    | { kind: 'day'; mood?: Mood }
    /** The first step: suggestions for this person, or their own. */
    | { kind: 'action'; mood?: Mood }
    /** The goal and first step are saved here; the story waits for it. */
    | { kind: 'commit' }
    /** Their Echo is built and saved here: voice, day, nudges. */
    | { kind: 'build' }
    /** The last control: hold to rise. */
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

export const PHONE: Record<PhoneId, { label: string; hours: number }> = {
    h1: { label: 'About an hour', hours: 1 },
    h2: { label: '2 hours', hours: 2 },
    h3: { label: '3 hours', hours: 3 },
    h4: { label: '4 hours', hours: 4 },
    h5: { label: '5 hours', hours: 5 },
    h6: { label: '6 hours or more', hours: 6 },
};

/** The average life the years are counted against. */
export const LIFE_YEARS = 90;
/** The half hour a day the trade is about. */
export const TRADE_MINUTES = 30;

/**
 * Skills thirty minutes a day can buy: roughly how many days that takes and
 * what it gets you, said modestly so it holds true for most people.
 */
export const SKILLS: Record<SkillId, { label: string; icon: string; days: number; outcome: string; goal: string }> = {
    morse: { label: 'Morse code', icon: 'radio', days: 90, outcome: 'read and send Morse code', goal: 'Learn Morse code' },
    language: { label: 'A new language', icon: 'language', days: 180, outcome: 'hold a simple conversation', goal: 'Learn a new language' },
    guitar: { label: 'Guitar', icon: 'musical-notes', days: 90, outcome: 'play your first real songs', goal: 'Learn guitar' },
    typing: { label: 'Touch typing', icon: 'keypad', days: 30, outcome: 'type fast without looking', goal: 'Learn touch typing' },
    code: { label: 'Coding', icon: 'code-slash', days: 120, outcome: 'build your first small app', goal: 'Learn to code' },
    drawing: { label: 'Drawing', icon: 'brush', days: 90, outcome: 'draw what you see', goal: 'Learn to draw' },
};

const round = (value: number, places: number) => Math.round(value * 10 ** places) / 10 ** places;

/**
 * The time their phone has taken, and will, at the pace they said: hours a
 * day × 365 × their years so far, as hours, days and years; and the same for
 * the years left of an average life of ninety. Arithmetic only.
 */
export function screenTime(answers: Answers) {
    const perDay = PHONE[answers.phone ?? 'h3'].hours;
    const age = Math.min(LIFE_YEARS - 1, Math.max(1, Math.round(answers.age ?? 25)));
    const hours = perDay * 365 * age;
    const days = Math.round(hours / 24);
    const years = round(hours / 24 / 365, 2);
    const left = LIFE_YEARS - age;
    const ahead = round((perDay * 365 * left) / 24 / 365, 1);
    return { perDay, age, hours, days, years, left, ahead, lifetime: round((perDay * LIFE_YEARS) / 24, 1) };
}

/** A number as said: 27,740. */
export const grouped = (value: number) => value.toLocaleString('en-US');

const hoursLabel = (hours: number) => `${hours} ${hours === 1 ? 'hour' : 'hours'}`;

/** What 1% a day becomes in a year, better and worse. */
export const COMPOUND = { better: Math.round(1.01 ** 365 * 10) / 10, worse: Math.round(0.99 ** 365 * 100) / 100 };

export const GOALS: Record<GoalId, { label: string; title: string; icon: string }> = {
    discipline: { label: 'I’d be disciplined', title: 'Become more disciplined', icon: 'shield-checkmark' },
    organized: { label: 'My life would be organized', title: 'Get my life organized', icon: 'albums' },
    health: { label: 'I’d be fitter and healthier', title: 'Get fitter and healthier', icon: 'heart' },
    skill: { label: 'I’d have learned a skill', title: 'Learn a new skill', icon: 'school' },
    career: { label: 'My career would move', title: 'Move my career forward', icon: 'briefcase' },
    calm: { label: 'My mind would be calmer', title: 'Calm my mind', icon: 'leaf' },
    own: { label: 'Something else', title: '', icon: 'flag' },
};

export const OBSTACLES: Option<ObstacleId>[] = [
    { id: 'starting', label: 'I struggle to get started' },
    { id: 'consistency', label: 'I can’t stay consistent' },
    { id: 'distraction', label: 'I get distracted' },
    { id: 'overwhelm', label: 'Everything feels overwhelming' },
];

/** The goal as it will be saved: their own words, the skill they picked, or the choice. */
export function goalTitle(answers: Answers): string {
    const typed = answers.goalText?.trim();
    if (typed) return typed.charAt(0).toUpperCase() + typed.slice(1);
    if (answers.goal === 'skill' && answers.skill) return SKILLS[answers.skill].goal;
    return answers.goal ? GOALS[answers.goal].title || 'My goal' : 'My goal';
}

const options = <T extends string>(list: { id: T; label: string; icon?: string }[]): Option[] => list.map(({ id, label, icon }) => ({ id, label, icon }));
const fromRecord = <T extends string>(record: Record<T, { label: string; icon?: string }>): Option[] =>
    (Object.keys(record) as T[]).map(id => ({ id, label: record[id].label, icon: record[id].icon }));

export const SCENES: Scene[] = [
    {
        id: 'abyss', label: 'In the dark.',
        beats: answers => [
            { kind: 'line', text: 'Hey… you made it down here.', mood: 'appear' },
            { kind: 'line', text: 'Quiet, isn’t it? This is where people end up when the days slip away.', mood: 'appear' },
            { kind: 'line', text: 'Can I ask you something honest?', mood: 'curious' },
            { kind: 'line', text: 'Ever promised yourself you’d change, then slid back to square one?', mood: 'listen' },
            { kind: 'choice', field: 'history', mood: 'listen', options: [
                { id: 'always', label: 'All the time' },
                { id: 'sometimes', label: 'Sometimes' },
                { id: 'rarely', label: 'Not really' },
            ] },
            answers.history === 'always'
                ? { kind: 'line', text: 'Yeah. You’re not the only one. That pull back down has a name.', mood: 'empathetic' }
                : answers.history === 'sometimes'
                    ? { kind: 'line', text: 'Most people say that. That pull back down has a name.', mood: 'empathetic' }
                    : { kind: 'line', text: 'Lucky. Most people feel a pull back down. It has a name.', mood: 'encourage' },
            { kind: 'line', text: 'The Abyss. Lost hours, plans that never start, thoughts that keep you up.', mood: 'think' },
            { kind: 'line', text: 'Everyone carries one. But something reached you down here, didn’t it?', mood: 'appear' },
        ],
    },
    {
        id: 'echo', label: 'Meeting Echo.',
        beats: answers => [
            { kind: 'line', text: 'That was me. I’m Echo.', mood: 'excited' },
            { kind: 'line', text: 'A ripple in time. I find whoever needs a way back up.', mood: 'speak' },
            { kind: 'line', text: 'Before we climb, what should I call you?', mood: 'listen' },
            { kind: 'input', field: 'name', placeholder: 'Your name', optional: true, mood: 'listen' },
            { kind: 'line', text: first(answers) ? `${first(answers)}. I like that.` : 'No name? A mystery. I like that too.', mood: 'excited' },
            { kind: 'line', text: `Alright${first(answers) ? `, ${first(answers)}` : ''}. Let me show you how this place works.`, mood: 'speak' },
        ],
    },
    {
        id: 'chronos', label: 'Time, and their day.',
        beats: answers => {
            const awake = awakeHours(answers);
            return [
                { kind: 'line', text: 'Down here, one thing never stops.', mood: 'think', stage: 'clock', step: 0 },
                { kind: 'line', text: 'Time. Chronos keeps it, and he’s fair about exactly one thing.', mood: 'speak', stage: 'clock', step: 0 },
                { kind: 'line', text: 'Everyone gets 24 hours. You. Me. A billionaire. Same 24.', mood: 'speak', stage: 'clock', step: 1 },
                { kind: 'line', text: 'So let’s look at yours. When does your day start and end?', mood: 'listen', stage: 'clock', step: 1 },
                { kind: 'day', mood: 'listen' },
                { kind: 'line', text: `${awake} hours awake. That’s what you get to spend, every day.`, mood: 'encourage', stage: 'clock', step: 2 },
                { kind: 'line', text: 'Are you a morning person or a night owl?', mood: 'curious' },
                { kind: 'choice', field: 'chronotype', mood: 'listen', options: options(CHRONOTYPES) },
                { kind: 'line', mood: 'encourage', text:
                    answers.chronotype === 'early_bird' ? 'Mornings. Nice, we’ll put the hard things early.'
                        : answers.chronotype === 'night_owl' ? 'A night owl. I’ll keep your mornings gentle.'
                            : 'Depends on the day? Then we’ll follow your energy.' },
                { kind: 'line', text: 'And honestly, how much do you sleep?', mood: 'listen' },
                { kind: 'choice', field: 'sleepAmount', mood: 'listen', options: options(SLEEP_AMOUNTS) },
                answers.sleepAmount === 'under_six'
                    ? { kind: 'line', text: 'We’ll work on that together. Everything’s harder tired.', mood: 'empathetic' }
                    : { kind: 'line', text: 'Good. That’s half the battle already won.', mood: 'encourage' },
            ];
        },
    },
    {
        id: 'cost', label: 'What the screen takes.',
        beats: answers => {
            const time = screenTime(answers);
            return [
                { kind: 'line', text: 'Now, the part most people never look at.', mood: 'think' },
                { kind: 'line', text: 'On a normal day, outside work, how long are you on your phone?', mood: 'curious' },
                { kind: 'choice', field: 'phone', mood: 'listen', options: fromRecord(PHONE) },
                { kind: 'line', text: 'And how old are you?', mood: 'listen' },
                { kind: 'number', field: 'age', placeholder: 'Your age', min: 8, max: 89, mood: 'listen' },
                { kind: 'line', text: 'Let’s do the math together.', mood: 'think', stage: 'cost', step: 0 },
                { kind: 'line', text: `${hoursLabel(time.perDay)} a day, 365 days a year, for ${time.age} years.`, mood: 'think', stage: 'cost', step: 0 },
                { kind: 'line', text: `That’s ${grouped(time.hours)} hours. ${grouped(time.days)} days.`, mood: 'think', stage: 'cost', step: 1 },
                { kind: 'line', text: `${time.years} years of your life. Already gone.`, mood: 'empathetic', stage: 'cost', step: 2 },
                { kind: 'line', text: `Now picture a whole life. About ${LIFE_YEARS} years, one cube each.`, mood: 'think', stage: 'cost', step: 3 },
                { kind: 'line', text: `Keep going like this, and ${time.ahead} more years go to a screen.`, mood: 'think', stage: 'cost', step: 4 },
                { kind: 'line', text: 'It’s not only time. Heavy screen use is tied to worse sleep, focus and mood.', mood: 'empathetic' },
                { kind: 'line', text: 'I’m not saying this to scare you. I’m saying it because it can change.', mood: 'encourage' },
            ];
        },
    },
    {
        id: 'trade', label: 'Thirty minutes a day.',
        beats: answers => {
            const skill = SKILLS[answers.skill ?? 'morse'];
            return [
                { kind: 'line', text: 'Here’s the good part.', mood: 'excited' },
                { kind: 'line', text: 'Take back just 30 minutes a day. What would you love to learn?', mood: 'curious' },
                { kind: 'choice', field: 'skill', mood: 'listen', options: fromRecord(SKILLS) },
                { kind: 'line', text: 'Watch what 30 minutes does.', mood: 'speak', stage: 'trade', step: 0 },
                { kind: 'line', text: `Every day, for ${skill.days} days.`, mood: 'speak', stage: 'trade', step: 1 },
                { kind: 'line', text: `Scrolling leaves nothing behind. ${skill.label}? You could ${skill.outcome}.`, mood: 'excited', stage: 'trade', step: 2 },
                { kind: 'line', text: 'Same time. A completely different life.', mood: 'encourage', stage: 'trade', step: 2 },
            ];
        },
    },
    {
        id: 'compound', label: 'Discipline, not motivation.',
        beats: answers => [
            { kind: 'line', text: 'So why hasn’t it stuck before? It’s not you. It’s how you’ve been trying.', mood: 'empathetic' },
            { kind: 'line', text: 'Most people wait to feel motivated. It spikes, then it’s gone.', mood: 'think', stage: 'motivation', step: 0 },
            { kind: 'line', text: 'Discipline is quieter. Small, every day. And it keeps climbing.', mood: 'encourage', stage: 'motivation', step: 1 },
            { kind: 'line', text: 'What usually gets in your way?', mood: 'think' },
            { kind: 'choice', field: 'obstacle', mood: 'listen', options: OBSTACLES },
            { kind: 'line', mood: 'encourage', text:
                answers.obstacle === 'starting' ? 'Then we make starting tiny. Two minutes counts.'
                    : answers.obstacle === 'consistency' ? 'Then missing a day is fine. Just never twice in a row.'
                        : answers.obstacle === 'distraction' ? 'Then we fence off your focus. One thing at a time.'
                            : 'Then we pick one thing. The rest can wait.' },
            { kind: 'line', text: 'And small adds up faster than you’d think.', mood: 'speak', stage: 'compound', step: 0 },
            { kind: 'line', text: `1% better each day. After a year, that’s ${COMPOUND.better} times better.`, mood: 'excited', stage: 'compound', step: 1 },
            { kind: 'line', text: 'So tell me, when does your work actually get done?', mood: 'curious' },
            { kind: 'choice', field: 'timing', mood: 'listen', options: options(TIMINGS) },
            { kind: 'line', mood: 'speak', text:
                answers.timing === 'last_minute' ? 'Deadlines work for you. I’ll quietly set earlier ones.'
                    : answers.timing === 'straight_away' ? 'Love that. I’ll keep up with you.'
                        : answers.timing === 'planned' ? 'A planner. We’re going to get along.'
                            : 'Thanks for being honest. We’ll start small.' },
        ],
    },
    {
        id: 'life', label: 'What they are carrying.',
        beats: answers => [
            { kind: 'line', text: 'Tell me what’s on your plate right now.', mood: 'listen' },
            { kind: 'multi', field: 'juggling', options: options(JUGGLES), mood: 'listen' },
            (answers.juggling?.length ?? 0) >= 3
                ? { kind: 'line', text: 'That’s a lot to carry. I’ll guard time for what matters.', mood: 'empathetic' }
                : { kind: 'line', text: 'Good. That leaves room to go deep.', mood: 'encourage' },
        ],
    },
    {
        id: 'goal', label: 'Where they want to go.',
        beats: answers => [
            { kind: 'line', text: 'Okay. Close your eyes for a second.', mood: 'speak' },
            { kind: 'line', text: 'It’s 90 days from now, and they went perfectly. What changed?', mood: 'curious' },
            { kind: 'choice', field: 'goal', mood: 'listen',
                options: (Object.keys(GOALS) as GoalId[]).filter(id => id !== 'own').map(id => ({ id, label: GOALS[id].label, icon: GOALS[id].icon })),
                own: { field: 'goalText', label: 'Your goal', placeholder: 'In your words' } },
            { kind: 'line', text: `${goalTitle(answers)}. Let’s make that real, one small step at a time.`, mood: 'excited' },
        ],
    },
    {
        id: 'foothold', label: 'The first step.',
        beats: () => [
            { kind: 'line', text: 'What’s one tiny step you could take toward it?', mood: 'listen' },
            { kind: 'action', mood: 'listen' },
            { kind: 'line', text: 'Love it. When will you do it?', mood: 'listen' },
            { kind: 'choice', field: 'when', mood: 'listen', options: [
                { id: 'now', label: 'Right now' },
                { id: 'later', label: 'Later today' },
                { id: 'tomorrow', label: 'Tomorrow morning' },
            ] },
            { kind: 'commit' },
            { kind: 'line', text: 'Done. That’s your first step, and it’s on your plan.', mood: 'celebrate' },
        ],
    },
    {
        id: 'allies', label: 'Someone to come along.',
        beats: () => [
            { kind: 'line', text: 'Climbing’s easier with someone in your corner. Bring a friend?', mood: 'encourage' },
            { kind: 'choice', field: 'invite', mood: 'listen', options: [
                { id: 'yes', label: 'Invite a friend' },
                { id: 'later', label: 'Maybe later' },
            ] },
            { kind: 'line', text: 'Last thing, I’m curious: how did you find me?', mood: 'curious' },
            { kind: 'choice', field: 'source', mood: 'listen', options: options(SOURCES) },
        ],
    },
    {
        id: 'your-echo', label: 'Echo, built for them.',
        beats: answers => [
            { kind: 'line', text: 'Thank you for telling me all that. Let me tune myself to you.', mood: 'think' },
            { kind: 'line', text: 'I’ll ask to send you nudges, so I can keep you on track.', mood: 'speak' },
            { kind: 'build' },
            { kind: 'line', text: `${first(answers) ? `Ready, ${first(answers)}. ` : 'Ready. '}${buildEcho(answers).reason}`, mood: 'celebrate' },
            { kind: 'line', text: 'The Abyss is behind you now. Hold to rise.', mood: 'encourage' },
            { kind: 'begin' },
        ],
    },
];

/** Hours awake in their day, from when it starts to when it ends. */
export function awakeHours(answers: Answers): number {
    const toMinutes = (time: string) => { const [h, m] = time.split(':').map(Number); return (h || 0) * 60 + (m || 0); };
    const fallback = CHRONOTYPES.find(type => type.id === answers.chronotype) ?? CHRONOTYPES[2];
    const span = toMinutes(answers.sleep ?? fallback.sleep) - toMinutes(answers.wake ?? fallback.wake);
    return Math.round(((span + 1440) % 1440 || 1440) / 60);
}

export interface Suggestion { label: string; kind: ActionKind; minutes: number }

/** A daily habit for each goal, small enough for day one. */
const HABITS: Record<GoalId, { label: string; minutes: number }> = {
    discipline: { label: 'Make my bed every morning', minutes: 5 },
    organized: { label: 'Plan tomorrow in five minutes', minutes: 5 },
    health: { label: 'A ten-minute walk', minutes: 10 },
    skill: { label: 'Practise for ten minutes', minutes: 10 },
    career: { label: 'Ten minutes on my next move', minutes: 10 },
    calm: { label: 'Five quiet minutes every morning', minutes: 5 },
    own: { label: 'Ten minutes on it every day', minutes: 10 },
};

/**
 * The first steps offered, for this obstacle and goal: small enough to do
 * today (starting: two minutes; consistency: one daily habit; distraction: a
 * short focus; overwhelm: emptying the head and choosing one thing).
 */
export function suggestions(answers: Answers): Suggestion[] {
    const habit = HABITS[answers.goal ?? 'own'];
    const byObstacle: Record<ObstacleId, Suggestion> = {
        starting: { label: 'Two minutes on the most important thing', kind: 'task', minutes: 2 },
        consistency: { label: habit.label, kind: 'habit', minutes: habit.minutes },
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
