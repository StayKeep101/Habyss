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
export type PhoneId = 'under_1' | 'one_two' | 'two_four' | 'four_six' | 'over_6';
export type AgeId = 'under_18' | 'age_18' | 'age_25' | 'age_35' | 'age_45' | 'over_55';
export type SkillId = 'morse' | 'language' | 'guitar' | 'typing' | 'code' | 'drawing';

/**
 * What Echo becomes on screen while a line is said: itself, or one of the
 * explainers it shapeshifts into (components/Ascent/Explainers.tsx).
 */
export type StageId = 'echo' | 'clock' | 'lifetime' | 'trade' | 'motivation' | 'discipline' | 'compound';

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
    age?: AgeId;
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
export type ChoiceField = 'history' | 'chronotype' | 'sleepAmount' | 'phone' | 'age' | 'skill' | 'obstacle' | 'timing' | 'goal' | 'when' | 'invite' | 'source';

export type Beat =
    | { kind: 'line'; text: string; mood?: Mood; stage?: StageId }
    /** A choice that sets one answer; `own` adds "Something else", typed, saved to that field. */
    | { kind: 'choice'; field: ChoiceField; options: Option[]; mood?: Mood; own?: { field: 'goalText'; label: string; placeholder: string } }
    /** Several of a few choices (what they juggle). */
    | { kind: 'multi'; field: 'juggling'; options: Option[]; mood?: Mood }
    /** Words typed (or skipped, when optional). */
    | { kind: 'input'; field: 'name'; placeholder: string; optional?: boolean; mood?: Mood }
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
    under_1: { label: 'Less than an hour', hours: 0.5 },
    one_two: { label: '1 to 2 hours', hours: 1.5 },
    two_four: { label: '2 to 4 hours', hours: 3 },
    four_six: { label: '4 to 6 hours', hours: 5 },
    over_6: { label: 'More than 6 hours', hours: 7 },
};

export const AGES: Record<AgeId, { label: string; years: number }> = {
    under_18: { label: 'Under 18', years: 16 },
    age_18: { label: '18 to 24', years: 21 },
    age_25: { label: '25 to 34', years: 30 },
    age_35: { label: '35 to 44', years: 40 },
    age_45: { label: '45 to 54', years: 50 },
    over_55: { label: '55 or over', years: 60 },
};

/** The life the years are counted against. */
export const LIFE_YEARS = 80;
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

/** The hours their phone takes from the rest of their life, until 80: hours a day × years left ÷ 24, as years. */
export function screenYears(answers: Answers): { hours: number; years: number; left: number; lived: number } {
    const hours = PHONE[answers.phone ?? 'two_four'].hours;
    const lived = AGES[answers.age ?? 'age_25'].years;
    const left = Math.max(0, LIFE_YEARS - lived);
    return { hours, years: Math.round((hours * left / 24) * 10) / 10, left, lived };
}

/** The years, as said: "7.4 years", or months under a year. */
export function yearsLabel(years: number): string {
    if (years < 1) {
        const months = Math.max(1, Math.round(years * 12));
        return `${months} ${months === 1 ? 'month' : 'months'}`;
    }
    return `${years} ${years === 1 ? 'year' : 'years'}`;
}

const hoursLabel = (hours: number) => (hours < 1 ? 'Half an hour' : `${hours} hours`);

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
            { kind: 'line', text: 'It’s dark down here.', mood: 'appear' },
            { kind: 'line', text: 'Ever promised yourself you’d change, then slid back to square one?', mood: 'curious' },
            { kind: 'choice', field: 'history', mood: 'listen', options: [
                { id: 'always', label: 'All the time' },
                { id: 'sometimes', label: 'Sometimes' },
                { id: 'rarely', label: 'Not really' },
            ] },
            answers.history === 'always'
                ? { kind: 'line', text: 'That pull back down has a name. The Abyss. Everyone has one.', mood: 'empathetic' }
                : answers.history === 'sometimes'
                    ? { kind: 'line', text: 'That pull back down? The Abyss. Everyone carries one.', mood: 'empathetic' }
                    : { kind: 'line', text: 'Then the Abyss hasn’t got you yet. Let’s keep it that way.', mood: 'encourage' },
            { kind: 'line', text: 'But you heard something, didn’t you?', mood: 'appear' },
        ],
    },
    {
        id: 'echo', label: 'Meeting Echo.',
        beats: answers => [
            { kind: 'line', text: 'That was me. Echo. A ripple in time.', mood: 'excited' },
            { kind: 'line', text: 'Who am I talking to?', mood: 'listen' },
            { kind: 'input', field: 'name', placeholder: 'Your name', optional: true, mood: 'listen' },
            { kind: 'line', text: first(answers) ? `${first(answers)}. Let’s get you out of here.` : 'A mystery. Let’s get you out anyway.', mood: 'excited' },
        ],
    },
    {
        id: 'chronos', label: 'Time, and their day.',
        beats: answers => [
            { kind: 'line', text: 'Down here, one thing never stops.', mood: 'think', stage: 'clock' },
            { kind: 'line', text: 'When does your day start and end?', mood: 'listen' },
            { kind: 'day', mood: 'listen' },
            { kind: 'line', text: 'Chronos gives everyone 24 hours. You, me, a billionaire.', mood: 'speak' },
            { kind: 'line', text: 'Morning person or night owl?', mood: 'curious' },
            { kind: 'choice', field: 'chronotype', mood: 'listen', options: options(CHRONOTYPES) },
            { kind: 'line', text: 'Real talk: how much do you sleep?', mood: 'listen' },
            { kind: 'choice', field: 'sleepAmount', mood: 'listen', options: options(SLEEP_AMOUNTS) },
            answers.sleepAmount === 'under_six'
                ? { kind: 'line', text: 'We’ll work on that. Everything’s harder tired.', mood: 'empathetic' }
                : { kind: 'line', text: 'Nice. That’s half the battle.', mood: 'encourage' },
        ],
    },
    {
        id: 'cost', label: 'What the screen takes.',
        beats: answers => {
            const { hours, years } = screenYears(answers);
            return [
                { kind: 'line', text: 'Outside work, how long are you on your phone a day?', mood: 'curious' },
                { kind: 'choice', field: 'phone', mood: 'listen', options: fromRecord(PHONE) },
                { kind: 'line', text: 'And how old are you?', mood: 'listen' },
                { kind: 'choice', field: 'age', mood: 'listen', options: fromRecord(AGES) },
                { kind: 'line', text: `${hoursLabel(hours)} a day until 80 is ${yearsLabel(years)}. On a screen.`, mood: 'think', stage: 'lifetime' },
                { kind: 'line', text: 'Not to scare you. To show you what’s still yours.', mood: 'empathetic' },
            ];
        },
    },
    {
        id: 'trade', label: 'Thirty minutes a day.',
        beats: answers => {
            const skill = SKILLS[answers.skill ?? 'morse'];
            return [
                { kind: 'line', text: 'Take back just 30 minutes a day. What would you learn?', mood: 'curious' },
                { kind: 'choice', field: 'skill', mood: 'listen', options: fromRecord(SKILLS) },
                { kind: 'line', text: `In about ${skill.days} days, you could ${skill.outcome}.`, mood: 'excited', stage: 'trade' },
                { kind: 'line', text: 'Same 30 minutes scrolling? Nothing to show for it.', mood: 'speak' },
            ];
        },
    },
    {
        id: 'compound', label: 'Discipline, not motivation.',
        beats: answers => [
            { kind: 'line', text: 'Most people wait to feel motivated. It spikes, then it’s gone.', mood: 'think', stage: 'motivation' },
            { kind: 'line', text: 'Discipline is quiet. It just keeps climbing.', mood: 'encourage', stage: 'discipline' },
            { kind: 'line', text: 'What usually gets in your way?', mood: 'think' },
            { kind: 'choice', field: 'obstacle', mood: 'listen', options: OBSTACLES },
            { kind: 'line', mood: 'encourage', text:
                answers.obstacle === 'starting' ? 'Then we make starting tiny. Two minutes counts.'
                    : answers.obstacle === 'consistency' ? 'Then missing a day is fine. Just never twice in a row.'
                        : answers.obstacle === 'distraction' ? 'Then we fence off your focus. One thing at a time.'
                            : 'Then we pick one thing. The rest can wait.' },
            { kind: 'line', text: `1% better a day looks like nothing. A year later, it’s ${COMPOUND.better}×.`, mood: 'excited', stage: 'compound' },
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
        id: 'goal', label: 'Where they want to go.',
        beats: answers => [
            { kind: 'line', text: 'Picture the next 90 days going perfectly. What changed?', mood: 'curious' },
            { kind: 'choice', field: 'goal', mood: 'listen',
                options: (Object.keys(GOALS) as GoalId[]).filter(id => id !== 'own').map(id => ({ id, label: GOALS[id].label, icon: GOALS[id].icon })),
                own: { field: 'goalText', label: 'Your goal', placeholder: 'In your words' } },
            { kind: 'line', text: `${goalTitle(answers)}. Let’s make it real.`, mood: 'excited' },
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
            { kind: 'line', text: 'The Abyss is behind you. Hold to rise.', mood: 'encourage' },
            { kind: 'begin' },
        ],
    },
];

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
