import type { Evidence } from './proof';

/**
 * What a kept habit is worth, and why anything is worth anything.
 *
 * A points system in a habit tracker is usually worthless within a week: the
 * app invents the points, hands them out for showing up, and nothing can ever
 * be lost. Three rules keep an ember worth having.
 *
 *   Earned, not given.  Only a habit that was actually due and actually kept
 *                       pays. Evidence pays more, because a run your watch
 *                       recorded is a stronger claim than a ticked box.
 *   Capped.             A day pays at most `DAILY_CAP`, whatever you tracked.
 *                       Otherwise the way to get rich is to create forty
 *                       trivial habits, and a currency anyone can print is not
 *                       a currency.
 *   Losable.            Embers are staked on a pact with a friend, and a pact
 *                       you do not keep pays them out. Nothing here creates
 *                       embers between two people — see `lib/pact.ts` — so the
 *                       pool only ever shrinks.
 *
 * They buy nothing, and that is deliberate. The moment they can be bought or
 * cashed out this stops being a habit tracker and starts being a game with a
 * balance sheet, which is a different app with a different rulebook.
 */

/** What one kept habit is worth before anything is applied to it. */
export const BASE = 10;

/** However much you track, a day is worth at most this. */
export const DAILY_CAP = 60;

/**
 * Evidence is worth more, because it is worth more.
 *
 * Not a punishment for self-logging — most habits cannot be proved and most of
 * the app is self-logged. It is that a habit which *can* be checked and *was*
 * is a stronger claim, and a currency should price a stronger claim higher.
 */
export const EVIDENCE_WORTH: Record<Evidence, number> = {
    verified: 2,
    context: 1.5,
    self: 1,
};

/** A long run is worth a little more per day, and stops mattering at a month. */
export const STREAK_CAP = 30;

/** Up to half as much again at a thirty-day run. */
export const streakBonus = (streak: number): number =>
    1 + (Math.min(Math.max(0, streak), STREAK_CAP) / STREAK_CAP) * 0.5;

/** What one kept habit pays, before the day's cap. */
export const earnedFor = (evidence: Evidence, streak = 0): number =>
    Math.round(BASE * EVIDENCE_WORTH[evidence] * streakBonus(streak));

/**
 * What a whole day pays.
 *
 * The strongest claims are counted first, so hitting the cap costs you the
 * cheapest habit rather than the one you took a watch to.
 */
export function earnedForDay(kept: { evidence: Evidence; streak?: number }[]): number {
    const worth = kept
        .map(one => earnedFor(one.evidence, one.streak ?? 0))
        .sort((a, b) => b - a);

    let total = 0;
    for (const one of worth) {
        if (total >= DAILY_CAP) break;
        total = Math.min(DAILY_CAP, total + one);
    }
    return total;
}

/** Why a balance moved. Every row in the ledger carries one. */
export type EmberReason =
    /** A habit kept. */
    | 'kept'
    /** Put up against a pact; held by nobody until it settles. */
    | 'staked'
    /** A pact kept: your own stake, back. */
    | 'returned'
    /** A pact the other person did not keep: their stake, yours. */
    | 'won'
    /** Somebody has to start with something. */
    | 'opening';

export const REASON_LABEL: Record<EmberReason, string> = {
    kept: 'Kept a habit',
    staked: 'Staked on a pact',
    returned: 'Pact kept',
    won: 'Won a pact',
    opening: 'Starting embers',
};

/**
 * Enough to make the first pact mean something, few enough that it runs out.
 *
 * A balance you can never spend down teaches nothing; this is a fortnight of
 * keeping most of what you set, and after that every stake is one you earned.
 */
export const OPENING_BALANCE = 100;

/** "1,240" — a balance reads as a number, not as a score out of something. */
export const formatEmbers = (amount: number): string => Math.round(amount).toLocaleString();
