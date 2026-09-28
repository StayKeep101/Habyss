/**
 * Blocking and reporting, as far as it can be checked without two accounts.
 *
 * What matters most about a block is enforced in Postgres — the policies on
 * feed_comments, feed_reactions, friend_requests and friendships all refuse a
 * write between two people where either has blocked the other. That cannot be
 * exercised here. What can is the part that would be embarrassing: the client
 * must not ask the server to do something it will obviously refuse, and it must
 * never let somebody block or report themselves.
 */

const session = { data: { session: { user: { id: 'me' } } } };
const upsert = jest.fn().mockResolvedValue({ error: null });
const insert = jest.fn().mockResolvedValue({ error: null });
const del = jest.fn();

/**
 * A query builder that answers every chain with itself and resolves empty.
 *
 * Written as a proxy rather than a hand-listed set of methods so that adding a
 * `.is()` or an `.or()` to a query never breaks a test about blocking.
 */
const builder = (onDelete?: () => void): any => new Proxy({}, {
    get(_target, key) {
        if (key === 'then') {
            return (resolve: (value: unknown) => void) => {
                onDelete?.();
                return Promise.resolve({ data: [], error: null }).then(resolve);
            };
        }
        return () => builder(onDelete);
    },
});

const table = () => ({
    upsert,
    insert,
    delete: () => builder(del),
    select: () => builder(),
});

jest.mock('../supabase', () => ({
    getSupabase: () => ({ auth: { getSession: () => Promise.resolve(session) }, from: () => table() }),
    isCloudConfigured: () => true,
}));
jest.mock('../cloudSync', () => ({ syncNow: jest.fn().mockResolvedValue(undefined) }));

import { FriendsService } from '../friendsService';

describe('blocking', () => {
    beforeEach(() => jest.clearAllMocks());

    it('refuses to block yourself rather than asking the server to', () => {
        return expect(FriendsService.blockUser('me')).resolves.toBe(false);
    });

    it('records the block under your own id', async () => {
        await FriendsService.blockUser('them');
        expect(upsert).toHaveBeenCalledWith(
            { blocker: 'me', blocked: 'them' },
            { onConflict: 'blocker,blocked' },
        );
    });

    it('takes the friendship with it, both ways round', async () => {
        await FriendsService.blockUser('them');
        // Either row can be the one that exists, so both are removed.
        expect(del.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
});

describe('reporting', () => {
    beforeEach(() => jest.clearAllMocks());

    it('refuses an empty reason', async () => {
        await expect(FriendsService.reportContent({ userId: 'them', kind: 'profile', reason: '   ' })).resolves.toBe(false);
        expect(insert).not.toHaveBeenCalled();
    });

    it('refuses to report yourself, which the table would refuse anyway', async () => {
        await expect(FriendsService.reportContent({ userId: 'me', kind: 'profile', reason: 'spam' })).resolves.toBe(false);
        expect(insert).not.toHaveBeenCalled();
    });

    it('files one under your own id, with what it is about', async () => {
        await FriendsService.reportContent({ userId: 'them', kind: 'comment', reason: 'harassment', reference: 'c1' });
        expect(insert).toHaveBeenCalledWith({
            reporter: 'me', reported_user: 'them', kind: 'comment', reference: 'c1', reason: 'harassment',
        });
    });

    it('never sends a reason longer than the column allows', async () => {
        await FriendsService.reportContent({ userId: 'them', kind: 'other', reason: 'x'.repeat(2000) });
        expect(insert.mock.calls[0][0].reason).toHaveLength(1000);
    });
});
