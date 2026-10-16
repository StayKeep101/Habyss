import type { DayCardData } from './dayCard';

/**
 * One chat with one friend: what you both typed, and each of your days.
 *
 * A day card sits at the end of its day (or now, for today), so the thread
 * reads like the days went: what you said that day, then how the day ended.
 */

export interface ChatMessage {
    id: string;
    fromUser: string;
    toUser: string;
    body: string;
    createdAt: string;
    readAt?: string | null;
}

export interface StoredDayCard { userId: string; day: string; card: DayCardData; updatedAt: string }

export type ThreadItem =
    | { kind: 'message'; id: string; at: string; mine: boolean; message: ChatMessage }
    | { kind: 'card'; id: string; at: string; mine: boolean; day: string; card: DayCardData };

/** Where a card sits: the last moment of its day, or its last update if that is earlier (today). */
const cardTime = (card: StoredDayCard): string => {
    const end = new Date(`${card.day}T23:59:59`).toISOString();
    return card.updatedAt < end ? card.updatedAt : end;
};

export function buildThread(me: string, messages: ChatMessage[], cards: StoredDayCard[]): ThreadItem[] {
    const items: ThreadItem[] = [
        ...messages.map(message => ({
            kind: 'message' as const, id: `m:${message.id}`, at: message.createdAt,
            mine: message.fromUser === me, message,
        })),
        // A day with nothing scheduled and nothing done says nothing; leave it out.
        ...cards.filter(card => card.card.habitsTotal + card.card.tasksTotal > 0).map(card => ({
            kind: 'card' as const, id: `c:${card.userId}:${card.day}`, at: cardTime(card),
            mine: card.userId === me, day: card.day, card: card.card,
        })),
    ];
    return items.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
}

/** The line under a friend's name in the chat list. */
export function preview(item: ThreadItem | undefined): string {
    if (!item) return '';
    if (item.kind === 'message') return `${item.mine ? 'You: ' : ''}${item.message.body}`;
    const { card } = item;
    return `${item.mine ? 'Your' : 'Their'} day: ${card.habitsDone + card.tasksDone} of ${card.habitsTotal + card.tasksTotal} done`;
}
