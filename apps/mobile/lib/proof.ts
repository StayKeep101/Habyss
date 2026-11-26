/**
 * How a completion was evidenced.
 *
 * A social feed of self-reported streaks stops meaning anything within a week:
 * everyone is perfect, so nobody is. The fix is not to demand proof of
 * everything — most habits cannot be proved and it would be miserable to try —
 * but to stop pretending that every tick is the same kind of claim.
 *
 * Three readings, strongest first, and only two of them need anything of you:
 * a run your watch recorded is not the same claim as a box you ticked, and the
 * feed should not draw them identically. Nothing here calls anyone a liar —
 * self-logged is the honest default and most of the feed will be it.
 *
 * A fourth tier, a friend vouching for you, was considered and dropped. It
 * turns a habit app into a place where people ask each other for favours, and
 * the two machine-checkable signals below are worth more than a vouch anyway.
 */
export type Evidence = 'verified' | 'context' | 'self';

/** What the app knows about how a completion came to be. */
export interface EvidenceInput {
    /** The habit reads a Health metric, and the value came from there. */
    fromHealth?: boolean;
    /** A focus session ran against this habit that day. */
    timed?: boolean;
}

const ORDER: Record<Evidence, number> = { verified: 2, context: 1, self: 0 };

/**
 * The strongest honest claim the app can make about one completion.
 *
 * Health data outranks a timer, because Health says what your body did while a
 * timer only says the app was running. A timer outranks a bare tick, because
 * the phone was there for it. Anything else is `self`, which is not an
 * accusation — it is the true statement that nobody checked.
 */
export function evidenceFor(input: EvidenceInput): Evidence {
    if (input.fromHealth) return 'verified';
    if (input.timed) return 'context';
    return 'self';
}

/** Highest first, for ranking a day by its strongest claim. */
export const rankOf = (evidence: Evidence): number => ORDER[evidence];

/** The strongest claim across a day's completions; `self` when there are none. */
export function strongest(all: Evidence[]): Evidence {
    return all.reduce<Evidence>((best, one) => (rankOf(one) > rankOf(best) ? one : best), 'self');
}

export interface EvidenceLook {
    label: string;
    /** One line, written to be read by the person it describes. */
    detail: string;
    icon: 'shield-checkmark' | 'navigate' | 'checkmark-circle';
}

/**
 * How each tier is worded.
 *
 * Deliberately plain. "Verified" has to mean something specific or it becomes
 * decoration, and "self-logged" has to sound like a fact rather than a doubt.
 */
export const LOOK: Record<Evidence, EvidenceLook> = {
    verified: { label: 'Verified', detail: 'Recorded by Health, not typed in', icon: 'shield-checkmark' },
    context: { label: 'Timed', detail: 'You ran the timer for it', icon: 'navigate' },
    self: { label: 'Logged', detail: 'Ticked off, on your word', icon: 'checkmark-circle' },
};

/**
 * A short, true sentence about a day's mix of evidence.
 *
 * Counting matters more than the top tier alone: one verified run among nine
 * ticks is a different day from nine verified runs, and a single badge would
 * read the same for both.
 */
export function describeDay(all: Evidence[]): string {
    if (all.length === 0) return 'Nothing yet today';
    const counted = all.filter(one => one !== 'self').length;
    if (counted === 0) return all.length === 1 ? 'Logged' : `${all.length} logged`;
    if (counted === all.length) return counted === 1 ? 'Backed by your phone' : `All ${counted} backed`;
    return `${counted} of ${all.length} backed`;
}
