import type { HeatDay } from '@/components/Profile/YearHeatmap';

/**
 * A friend's year of days, for the heatmap on their profile: from the day
 * cards they share (FeedService.feed for that person, fifty at a time, back a
 * year). A day's fill is how much of it they got done. Days with no card are
 * blank, as they are on yours until you start.
 */
export function yearFromCards(cards: { day: string; card: { habitsDone: number; habitsTotal: number; tasksDone: number; tasksTotal: number } }[]): HeatDay[] {
    const byDay = new Map<string, number>();
    for (const { day, card } of cards) {
        const total = (card.habitsTotal ?? 0) + (card.tasksTotal ?? 0);
        const done = (card.habitsDone ?? 0) + (card.tasksDone ?? 0);
        const fill = total > 0 ? Math.min(1, done / total) : done > 0 ? 1 : 0;
        byDay.set(day, Math.max(byDay.get(day) ?? 0, fill));
    }
    return [...byDay].map(([date, fill]) => ({ date, fill }));
}

export async function friendYear(userId: string): Promise<HeatDay[]> {
    const { FeedService } = require('./feedService') as typeof import('./feedService');
    const since = new Date(); since.setFullYear(since.getFullYear() - 1);
    const floor = since.toISOString().slice(0, 10);
    const cards: { day: string; card: any }[] = [];
    let before: string | undefined;
    for (let page = 0; page < 8; page++) {
        const posts = await FeedService.feed(before, 50, userId).catch(() => []);
        cards.push(...posts.map(post => ({ day: post.day, card: post.card })));
        if (posts.length < 50 || posts[posts.length - 1].day < floor) break;
        before = posts[posts.length - 1].postedAt;
    }
    return yearFromCards(cards.filter(item => item.day >= floor));
}
