/**
 * What is waiting for somebody, and whether they can answer it.
 *
 * The bug behind this: a friend request was a row in `friend_requests` with
 * nowhere to appear. Unless the person happened to open the Community tab and
 * scroll past the feed, being asked was invisible. The inbox is where it waits
 * now — and because a request and the notification announcing it are two rows,
 * the interesting cases are the ones where they come apart.
 */

const ME = 'me';
// Named for jest, which only lets a mock factory reach variables whose names
// begin with "mock" — everything else is out of scope by the time it runs.
const mockRows: { notifications: Record<string, unknown>[]; requests: Record<string, unknown>[] } = {
    notifications: [], requests: [],
};

/** A query builder that answers any chain and resolves per table. */
const mockBuilder = (rows: Record<string, unknown>[]): any => new Proxy({}, {
    get(_target, key) {
        if (key === 'then') {
            return (resolve: (value: unknown) => void) =>
                Promise.resolve({ data: rows, error: null, count: rows.length }).then(resolve);
        }
        if (key === 'maybeSingle' || key === 'single') {
            return () => Promise.resolve({ data: rows[0] ?? null, error: null });
        }
        return () => mockBuilder(rows);
    },
});

jest.mock('../supabase', () => ({
    getSupabase: () => ({
        auth: { getSession: () => Promise.resolve({ data: { session: { user: { id: ME } } } }) },
        from: (table: string) => mockBuilder(
            table === 'notifications' ? mockRows.notifications
                : table === 'friend_requests' ? mockRows.requests
                    : table === 'profiles' ? [{ id: 'them', username: 'sam', avatar_url: null }]
                        : [],
        ),
    }),
    isCloudConfigured: () => true,
}));
jest.mock('../cloudSync', () => ({ syncNow: jest.fn().mockResolvedValue(undefined) }));

import { FriendsService } from '../friendsService';

const notification = (over: Record<string, unknown> = {}) => ({
    id: 'n1', from_user_id: 'them', type: 'friend_request',
    title: '@sam wants to be friends', body: 'Accept or decline from here.',
    read: false, created_at: '2026-09-29T10:00:00.000Z', ...over,
});

const request = (over: Record<string, unknown> = {}) => ({
    id: 'r1', from_user_id: 'them', status: 'pending',
    created_at: '2026-09-29T10:00:00.000Z', ...over,
});

beforeEach(() => { mockRows.notifications = []; mockRows.requests = []; });

describe('the inbox', () => {
    it('carries a request that has been announced, once, and answerable', async () => {
        mockRows.notifications = [notification()];
        mockRows.requests = [request()];

        const items = await FriendsService.getInbox();
        expect(items).toHaveLength(1);
        expect(items[0]).toMatchObject({ kind: 'friend_request', requestId: 'r1', fromUsername: 'sam' });
    });

    it('shows a request whose notification never arrived', async () => {
        // A request sent before the inbox existed, or one whose notification
        // insert failed. Being asked must not depend on a second row saving.
        mockRows.requests = [request()];

        const items = await FriendsService.getInbox();
        expect(items).toHaveLength(1);
        expect(items[0]).toMatchObject({ kind: 'friend_request', requestId: 'r1' });
        expect(items[0].id).toBe('request:r1');
    });

    it('leaves no buttons on a request that has already been answered', async () => {
        // The notification stays as the record that it happened; what goes is
        // the pair of buttons that would no longer do anything.
        mockRows.notifications = [notification()];
        mockRows.requests = [];

        const items = await FriendsService.getInbox();
        expect(items).toHaveLength(1);
        expect(items[0].requestId).toBeUndefined();
    });

    it('keeps anything it does not recognise rather than dropping it', async () => {
        mockRows.notifications = [notification({ id: 'n2', type: 'something_new', title: 'Hello' })];

        const items = await FriendsService.getInbox();
        expect(items).toHaveLength(1);
        expect(items[0].kind).toBe('nudge');
        expect(items[0].title).toBe('Hello');
    });

    it('reads newest first, whichever row it came from', async () => {
        mockRows.notifications = [notification({ id: 'n1', type: 'nudge', created_at: '2026-09-29T09:00:00.000Z' })];
        mockRows.requests = [request({ id: 'r1', created_at: '2026-09-29T11:00:00.000Z' })];

        const items = await FriendsService.getInbox();
        expect(items.map(item => item.id)).toEqual(['request:r1', 'n1']);
    });

    it('cannot dismiss a request that has no notification behind it', async () => {
        // There is nothing to delete; the request is answered, not cleared.
        await expect(FriendsService.dismissNotification('request:r1')).resolves.toBe(false);
    });
});
