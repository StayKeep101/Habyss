import type { InboxItem } from './friendsService';

/** One card in the inbox: a notification, and every identical one stacked under it. */
export interface InboxGroup {
    /** The newest of the stack: what the card shows. */
    item: InboxItem;
    /** Every notification in the stack, newest first: clearing the card clears them all. */
    ids: string[];
    count: number;
}

/** Something still waiting for an answer: it has buttons, so it is never stacked or swept away. */
export const isAnswerable = (item: InboxItem): boolean => !!item.requestId || !!item.share;

/**
 * Stacks repeats into one card.
 *
 * A friend ticking the same shared habit seven times sent seven identical
 * notes, and each had to be swiped away on its own. Notes that say the same
 * thing from the same person are one card with a count now, kept where the
 * newest one sits. Anything with buttons stays on its own card.
 */
export function groupInbox(items: InboxItem[]): InboxGroup[] {
    const groups: InboxGroup[] = [];
    const byKey = new Map<string, InboxGroup>();
    const sorted = [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    for (const item of sorted) {
        if (isAnswerable(item)) { groups.push({ item, ids: [item.id], count: 1 }); continue; }
        const key = [item.kind, item.fromUserId ?? '', item.title, item.body].join('\u0000');
        const found = byKey.get(key);
        if (found) {
            found.ids.push(item.id);
            found.count += 1;
            // One unread note in the stack keeps the card's dot.
            if (!item.read && found.item.read) found.item = { ...found.item, read: false };
            continue;
        }
        const group = { item, ids: [item.id], count: 1 };
        byKey.set(key, group);
        groups.push(group);
    }
    return groups;
}
