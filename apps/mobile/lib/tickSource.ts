/**
 * What logged a check-in. Every tick says where it came from, so the habit
 * page can show how a habit is really kept (by hand, by its timer, by Health),
 * and anything that rewards a tick can trust a recorded one over a tapped one.
 * Null on rows from before schema v26, which were all by hand.
 */
export type TickSource = 'manual' | 'timer' | 'health' | 'auto' | 'siri' | 'widget' | 'watch' | 'notification';

export const TICK_SOURCES: TickSource[] = ['manual', 'timer', 'health', 'auto', 'siri', 'widget', 'watch', 'notification'];

export const asTickSource = (value: unknown): TickSource =>
    (TICK_SOURCES as unknown[]).includes(value) ? value as TickSource : 'manual';

/** Said in a sentence: "by hand", "with the timer", … */
export const SOURCE_WORDS: Record<TickSource, string> = {
    manual: 'by hand',
    timer: 'with the timer',
    health: 'from Apple Health',
    auto: 'automatically',
    siri: 'with Siri',
    widget: 'from a widget',
    watch: 'on the Watch',
    notification: 'from a reminder',
};

/** Recorded rather than claimed: the timer, Health, or a place or app tracked it. */
export const isRecorded = (source: TickSource): boolean => source === 'timer' || source === 'health' || source === 'auto';

/** Each source's share of a habit's ticks, biggest first. */
export function sourceShares(sources: TickSource[]): { source: TickSource; count: number; share: number }[] {
    if (!sources.length) return [];
    const counts = new Map<TickSource, number>();
    for (const source of sources) counts.set(source, (counts.get(source) ?? 0) + 1);
    return [...counts.entries()]
        .map(([source, count]) => ({ source, count, share: count / sources.length }))
        .sort((a, b) => b.count - a.count || TICK_SOURCES.indexOf(a.source) - TICK_SOURCES.indexOf(b.source));
}
