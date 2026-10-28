/**
 * The four ways to react to a friend's day (an acknowledgement is one of
 * them). Kept to four so the row fits under a card and each one means
 * something; the server allows exactly these (20261028000400).
 */
export type Reaction = 'proud' | 'fire' | 'comeback' | 'again';

export const REACTIONS: { id: Reaction; label: string; icon: string }[] = [
    { id: 'proud', label: 'Proud of you', icon: 'heart' },
    { id: 'fire', label: 'On fire', icon: 'flame' },
    { id: 'comeback', label: 'The comeback', icon: 'rocket' },
    { id: 'again', label: 'Again tomorrow?', icon: 'repeat' },
];

export const reactionLabel = (id: Reaction): string => REACTIONS.find(item => item.id === id)?.label ?? 'Proud of you';

/** A server value read safely: anything unknown is the plain one. */
export const asReaction = (value: unknown): Reaction =>
    REACTIONS.some(item => item.id === value) ? value as Reaction : 'proud';

/** "Proud of you 3 · On fire 1": what a card got, most first. */
export function reactionSummary(counts: Partial<Record<Reaction, number>>): string {
    return REACTIONS
        .map(item => ({ label: item.label, n: counts[item.id] ?? 0 }))
        .filter(item => item.n > 0)
        .sort((a, b) => b.n - a.n)
        .map(item => `${item.label} ${item.n}`)
        .join(' · ');
}

/** The counts after you react (or change, or take it back): yours moved, nobody else's touched. */
export function withMyReaction(counts: Partial<Record<Reaction, number>>, before: Reaction | null, after: Reaction | null): Partial<Record<Reaction, number>> {
    const next = { ...counts };
    if (before) next[before] = Math.max(0, (next[before] ?? 0) - 1);
    if (after) next[after] = (next[after] ?? 0) + 1;
    return next;
}
