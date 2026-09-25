import type { PersonalityModeId } from '@/constants/AIPersonalities';

/**
 * The seven onboarding answers, and what each one changes.
 *
 * The rule: if an answer does not change something the user can see or feel
 * afterwards, it is a survey and does not belong here. Every option below is
 * wired to at least one of: the coach's voice, the size of the daily target,
 * whether a reminder is offered, whether sharing is suggested, or what the plan
 * says back to them.
 *
 * 1 identity goal   free text, becomes the measurable goal in 7
 * 2 attempts        how sceptical this person is, which changes the coach's opening
 * 3 momentum        multi-select; the strongest signal, drives targets and reminders
 * 4 cost            free text, optional; quoted back when a streak is at risk
 * 5 tone            picks the coach personality
 * 6 time budget     sizes the daily target
 * 7 measurable      confirmed target, derived from 1
 */

export type AttemptsId = 'first' | 'few' | 'many' | 'lost_count';
export type KillerId =
    | 'busy' | 'motivation_fades' | 'bad_day'
    | 'all_or_nothing' | 'dont_know' | 'no_accountability';
export type ToneId = 'encouraging' | 'straight' | 'drill';

/** Minutes a day the user says they can give. */
export type TimeBudget = 5 | 15 | 30 | 60;

export interface Option<T extends string> { id: T; label: string }

export const ATTEMPTS: Option<AttemptsId>[] = [
    { id: 'first', label: 'This is my first time' },
    { id: 'few', label: '2–3 times' },
    { id: 'many', label: 'More than I’d like to admit' },
    { id: 'lost_count', label: 'I’ve lost count' },
];

export interface Killer extends Option<KillerId> {
    /** What the plan will do about it, shown back to the user at the end. */
    plan: string;
}

export const KILLERS: Killer[] = [
    {
        id: 'busy', label: 'I get busy and it slips',
        plan: 'a reminder at a time you choose, so it does not depend on remembering',
    },
    {
        id: 'motivation_fades', label: 'Motivation fades after a week or two',
        plan: 'a target small enough to still do on a flat day',
    },
    {
        id: 'bad_day', label: 'One bad day turns into a bad week',
        plan: 'a missed day shown as one missed day, never as a broken streak to abandon',
    },
    {
        id: 'all_or_nothing', label: 'I’m all-or-nothing',
        plan: 'a smaller daily target, so partial counts as done',
    },
    {
        id: 'dont_know', label: 'I don’t know what to do next',
        plan: 'one specific action each day, tied to something you already do',
    },
    {
        id: 'no_accountability', label: 'Nobody holds me accountable',
        plan: 'a coach that checks in, and someone you can invite to see it',
    },
];

export const TONES: { id: ToneId; label: string; blurb: string; coach: PersonalityModeId }[] = [
    { id: 'encouraging', label: 'Encouraging', blurb: 'Keep me going', coach: 'friendly' },
    { id: 'straight', label: 'Straight up', blurb: 'Tell me the truth', coach: 'normal' },
    { id: 'drill', label: 'Drill sergeant', blurb: 'Make me lock in', coach: 'dad_mode' },
];

export const TIME_BUDGETS: { id: TimeBudget; label: string }[] = [
    { id: 5, label: '5 min' },
    { id: 15, label: '15 min' },
    { id: 30, label: '30 min' },
    { id: 60, label: '1 hr+' },
];

/* -------------------------------------------------------------------------- */
/*  What the answers do                                                        */
/* -------------------------------------------------------------------------- */

/** Answer 5 picks the coach outright. */
export const coachForTone = (tone?: ToneId): PersonalityModeId =>
    TONES.find(item => item.id === tone)?.coach ?? 'normal';

/**
 * Answer 2 tells the coach how much benefit of the doubt to skip.
 * Someone on their fifth attempt does not want to be congratulated for starting.
 */
export const hasTriedBefore = (attempts?: AttemptsId): boolean =>
    attempts === 'few' || attempts === 'many' || attempts === 'lost_count';

export const isVeteranOfFailedStarts = (attempts?: AttemptsId): boolean =>
    attempts === 'many' || attempts === 'lost_count';

const has = (killers: KillerId[] | undefined, id: KillerId) => !!killers?.includes(id);

/** Forgetting and lack of accountability are the two a reminder actually answers. */
export const shouldOfferReminder = (killers?: KillerId[]): boolean =>
    has(killers, 'busy') || has(killers, 'no_accountability');

/** All-or-nothing, bad days and fading motivation all call for a smaller target. */
export const prefersSmallSteps = (killers?: KillerId[]): boolean =>
    has(killers, 'all_or_nothing') || has(killers, 'bad_day') || has(killers, 'motivation_fades');

/** "I don't know what to do next" is answered by anchoring the action to a cue. */
export const wantsExplicitCue = (killers?: KillerId[]): boolean => has(killers, 'dont_know');

/** Only suggest inviting someone to the person who said accountability is missing. */
export const shouldSuggestSharing = (killers?: KillerId[]): boolean =>
    has(killers, 'no_accountability');

/**
 * Answer 6 sizes the daily target, and answer 3 can shrink it further.
 *
 * Someone who is all-or-nothing gets a target they can still hit on a bad day,
 * because the failure mode is abandoning the whole thing after one miss.
 */
export function dailyTargetMinutes(budget?: TimeBudget, killers?: KillerId[]): number {
    const base = budget ?? 15;
    if (!prefersSmallSteps(killers)) return base;
    // A floor of 5 keeps it a real unit of work rather than a token.
    return Math.max(5, Math.round(base / 2));
}

/** The plan lines for whichever momentum killers were chosen, in list order. */
export function planFor(killers?: KillerId[]): string[] {
    if (!killers?.length) return [];
    return KILLERS.filter(item => killers.includes(item.id)).map(item => item.plan);
}

/**
 * The payoff screen, in the user's own words.
 *
 * Reflects back what they said rather than congratulating them, which is the
 * moment that earns the next session. Every line is drawn from an answer; if
 * they skipped something, the line is simply absent.
 */
export function payoffHeadline(attempts?: AttemptsId, killers?: KillerId[]): string {
    const killer = KILLERS.find(item => killers?.includes(item.id));
    if (isVeteranOfFailedStarts(attempts) && killer) {
        return `You’ve started this before. What usually stops you is ${killer.label.toLowerCase().replace(/^i /, '')}.`;
    }
    if (killer) {
        return `What usually stops you is ${killer.label.toLowerCase().replace(/^i /, '')}.`;
    }
    if (hasTriedBefore(attempts)) return 'You’ve started this before.';
    return 'Here’s your plan.';
}

