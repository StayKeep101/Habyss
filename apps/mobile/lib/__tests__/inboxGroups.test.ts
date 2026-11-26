import { groupInbox } from '../inboxGroups';
import type { InboxItem } from '../friendsService';

const note = (id: string, at: string, extra: Partial<InboxItem> = {}): InboxItem => ({
    id, kind: 'shared_done', title: 'Erwan did Apply to 50 jobs', body: 'Your turn.',
    read: true, createdAt: at, fromUserId: 'erwan', ...extra,
});

describe('groupInbox', () => {
    it('stacks identical notes from the same person into one card, newest on top', () => {
        const groups = groupInbox([note('a', '2026-11-01'), note('b', '2026-11-03'), note('c', '2026-11-02')]);
        expect(groups).toHaveLength(1);
        expect(groups[0].item.id).toBe('b');
        expect(groups[0].ids).toEqual(['b', 'c', 'a']);
        expect(groups[0].count).toBe(3);
    });

    it('keeps different notes, and different people, apart', () => {
        const groups = groupInbox([note('a', '2026-11-01'), note('b', '2026-11-02', { fromUserId: 'sam' }), note('c', '2026-11-03', { title: 'Other' })]);
        expect(groups.map(group => group.count)).toEqual([1, 1, 1]);
    });

    it('never stacks something waiting for an answer', () => {
        const ask = { kind: 'friend_request' as const, title: 'Sam wants to be friends', body: 'Accept', requestId: 'r' };
        const groups = groupInbox([note('a', '2026-11-01', ask), note('b', '2026-11-02', ask)]);
        expect(groups).toHaveLength(2);
    });

    it('shows the dot when any note in the stack is unread', () => {
        const groups = groupInbox([note('a', '2026-11-01', { read: false }), note('b', '2026-11-02')]);
        expect(groups[0].item.read).toBe(false);
    });
});
