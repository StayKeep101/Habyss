/**
 * A promise made to somebody, with something on it.
 *
 * This is the accountability the rest of the app cannot manufacture. A streak
 * is between you and yourself, and on a bad week it is very easy to decide it
 * did not matter. A pact is with a named person who is watching, on a habit you
 * both agreed to, with embers you both put up — and the reason it works is not
 * the embers. It is that somebody will see.
 *
 * Both sides must keep it. That is the whole point and it is the thing the user
 * asked for: a shared habit is not kept until it is kept by everyone on it.
 *
 * ── The settlement, and why it is that way ────────────────────────────────
 *
 *   both kept      stakes returned. Nothing is created — a pact is not a way
 *                  to farm embers, it is a way to risk them.
 *   one kept       the keeper takes both. This is the whole mechanism: the
 *                  cost of letting it go is paid to the person you let down.
 *   neither kept   both stakes are burned.
 *
 * That last rule is the one that matters most and is easiest to get wrong.
 * Refunding a pact nobody kept makes a mutual quiet week free, and two friends
 * who both want out have every reason to take it — collusion, and the pact
 * stops meaning anything. Burning both means letting go always costs, even when
 * you both do it.
 *
 * Nothing here can be settled early or by one side. A pact runs until its day
 * is over, and then the record decides.
 */

export type PactStatus =
    /** Offered, waiting on the other person. */
    | 'offered'
    /** Both in, running. */
    | 'live'
    /** Over and paid out. */
    | 'settled'
    /** Refused, or withdrawn before it started. */
    | 'cancelled';

export type PactOutcome = 'both' | 'mine' | 'theirs' | 'neither';

export interface PactSide {
    userId: string;
    username: string;
    avatarUrl?: string;
    stake: number;
    /** Whether this person has kept the item for the day being settled. */
    kept: boolean;
}

export interface Pact {
    id: string;
    /** The habit, task or goal it is about. */
    itemId: string;
    itemType: 'habit' | 'task' | 'goal';
    itemName: string;
    status: PactStatus;
    /** The last day it can be kept, as YYYY-MM-DD. */
    deadline: string;
    mine: PactSide;
    theirs: PactSide;
    /** Whether you offered it. Only the other side can accept one. */
    offeredByMe: boolean;
    createdAt: string;
}

/** What the record says happened. */
export function outcomeOf(pact: Pick<Pact, 'mine' | 'theirs'>): PactOutcome {
    if (pact.mine.kept && pact.theirs.kept) return 'both';
    if (pact.mine.kept) return 'mine';
    if (pact.theirs.kept) return 'theirs';
    return 'neither';
}

export interface Settlement {
    /** What lands in your balance. Your stake is already out of it. */
    toMe: number;
    toThem: number;
    /** What nobody gets back. */
    burned: number;
}

/**
 * Who gets what.
 *
 * Deliberately a pure function of the stakes and who kept it: settlement is the
 * one part of this that must never depend on who is asking, what time it is, or
 * which device noticed first.
 */
export function settle(pact: Pick<Pact, 'mine' | 'theirs'>): Settlement {
    const pot = pact.mine.stake + pact.theirs.stake;
    switch (outcomeOf(pact)) {
        case 'both':
            return { toMe: pact.mine.stake, toThem: pact.theirs.stake, burned: 0 };
        case 'mine':
            return { toMe: pot, toThem: 0, burned: 0 };
        case 'theirs':
            return { toMe: 0, toThem: pot, burned: 0 };
        case 'neither':
            // Nobody kept it, so nobody is owed anything. Refunding here would
            // make a mutual quiet week free, which is an invitation to collude.
            return { toMe: 0, toThem: 0, burned: pot };
    }
}

/** Whether the day it was made for has passed. */
export const isOver = (pact: Pick<Pact, 'deadline'>, today: string): boolean => today > pact.deadline;

/** Whether it can still be kept today. */
export const isOpen = (pact: Pick<Pact, 'status' | 'deadline'>, today: string): boolean =>
    pact.status === 'live' && today <= pact.deadline;

/**
 * One line about where a pact stands, written to the person reading it.
 *
 * Says who it is waiting on before anything else, because that is the only part
 * anybody can act on.
 */
export function lineFor(pact: Pick<Pact, 'status' | 'deadline' | 'mine' | 'theirs'>, today: string): string {
    if (pact.status === 'offered') return `Waiting for @${pact.theirs.username} to accept`;
    if (pact.status === 'cancelled') return 'Called off';

    if (pact.status === 'settled' || isOver(pact, today)) {
        switch (outcomeOf(pact)) {
            case 'both': return 'Both kept it';
            case 'mine': return `You kept it, @${pact.theirs.username} did not`;
            case 'theirs': return `@${pact.theirs.username} kept it, you did not`;
            case 'neither': return 'Neither of you kept it';
        }
    }

    if (pact.mine.kept && pact.theirs.kept) return 'Both done — settles tonight';
    if (pact.mine.kept) return `Waiting on @${pact.theirs.username}`;
    if (pact.theirs.kept) return `@${pact.theirs.username} is done. Waiting on you`;
    return 'Neither of you yet';
}

/** How many days are left, counting today as one. */
export function daysLeft(pact: Pick<Pact, 'deadline'>, today: string): number {
    const from = Date.parse(`${today}T12:00:00`);
    const to = Date.parse(`${pact.deadline}T12:00:00`);
    if (!Number.isFinite(from) || !Number.isFinite(to)) return 0;
    return Math.max(0, Math.round((to - from) / 86400000));
}

/** The smallest stake worth making, and the most that can be lost at once. */
export const MIN_STAKE = 10;
export const MAX_STAKE = 500;

export type StakeCheck = { ok: true; stake: number } | { ok: false; error: string };

/** Whether a stake can be made, given what is actually in the balance. */
export function checkStake(raw: number, balance: number): StakeCheck {
    const stake = Math.floor(raw);
    if (!Number.isFinite(stake) || stake < MIN_STAKE) return { ok: false, error: `Stake at least ${MIN_STAKE}.` };
    if (stake > MAX_STAKE) return { ok: false, error: `${MAX_STAKE} is the most you can put on one pact.` };
    // Staking what you do not have is how a closed economy stops being closed.
    if (stake > balance) return { ok: false, error: 'You do not have that many embers.' };
    return { ok: true, stake };
}
