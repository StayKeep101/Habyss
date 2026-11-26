const mockAnswerNudge = jest.fn(async () => true);
const mockReplyToLatestFrom = jest.fn(async () => null);
const mockAccept = jest.fn(async () => true);
const mockDecline = jest.fn(async () => true);
const mockAcceptFriend = jest.fn(async () => true);
const mockDeclineFriend = jest.fn(async () => true);
const mockRespond = jest.fn(async () => undefined);
jest.mock('../challenges', () => ({
    myChallenges: async () => [
        { runId: 'other', myStatus: 'invited', members: [{ id: 'alex' }], starts: '2099-01-01', status: 'proposed' },
        { runId: 'run1', myStatus: 'invited', members: [{ id: 'sam' }], starts: '2099-01-01', status: 'proposed' },
    ],
    canAnswer: () => true,
    respondChallenge: mockRespond,
    syncChallenges: async () => undefined,
}));
jest.mock('../friendsService', () => ({ FriendsService: {
    relationTo: async () => ({ kind: 'incoming', requestId: 'req1' }),
    acceptFriendRequest: mockAcceptFriend,
    declineFriendRequest: mockDeclineFriend,
    answerNudge: mockAnswerNudge,
    acceptShareRequest: mockAccept,
    declineShareRequest: mockDecline,
    pendingShares: async () => [
        { type: 'habit', itemId: 'old', fromUserId: 'sam', createdAt: '2026-11-01T10:00:00Z' },
        { type: 'habit', itemId: 'read', fromUserId: 'sam', createdAt: '2026-11-11T10:00:00Z' },
        { type: 'task', itemId: 'other', fromUserId: 'alex', createdAt: '2026-11-11T11:00:00Z' },
    ],
} }));
jest.mock('../comments', () => ({ replyToLatestFrom: mockReplyToLatestFrom }));
jest.mock('expo-router', () => ({ router: { navigate: jest.fn() } }));

import { handleSocialResponse } from '../socialActions';
import { CATEGORIES, COMMENT_CATEGORY, SOCIAL_ACTION } from '../notificationActions';

const press = (actionIdentifier: string, extra: object = {}) => ({
    actionIdentifier, ...extra,
    notification: { request: { content: { data: { type: 'x', from: 'sam' } } } },
}) as any;

describe('Community buttons', () => {
    beforeEach(() => jest.clearAllMocks());

    it('leaves other buttons to the day handler', async () => {
        expect(await handleSocialResponse(press('ECHO_DONE'))).toBe(false);
    });

    it("Let's do it accepts their latest offer; No thanks declines it", async () => {
        await handleSocialResponse(press(SOCIAL_ACTION.shareYes));
        expect(mockAccept).toHaveBeenCalledWith('habit', 'read', 'sam');
        await handleSocialResponse(press(SOCIAL_ACTION.shareNo));
        expect(mockDecline).toHaveBeenCalledWith('habit', 'read', 'sam');
    });

    it('On it tells the friend who nudged', async () => {
        await handleSocialResponse(press(SOCIAL_ACTION.onIt));
        expect(mockAnswerNudge).toHaveBeenCalledWith('sam');
    });

    it('Reply posts what was typed, and nothing when empty', async () => {
        await handleSocialResponse(press(SOCIAL_ACTION.reply, { userText: '  haha ok  ' }));
        expect(mockReplyToLatestFrom).toHaveBeenCalledWith('sam', 'haha ok');
        await handleSocialResponse(press(SOCIAL_ACTION.reply, { userText: '   ' }));
        expect(mockReplyToLatestFrom).toHaveBeenCalledTimes(1);
    });

    it('a comment can be answered by typing on it', () => {
        const reply = CATEGORIES.find(category => category.id === COMMENT_CATEGORY)!.buttons[0];
        expect(reply.textInput?.submitButtonTitle).toBe('Send');
        expect(reply.options.opensAppToForeground).toBe(false);
    });

    it('answers a friend request from the notification', async () => {
        await handleSocialResponse(press(SOCIAL_ACTION.friendAccept));
        expect(mockAcceptFriend).toHaveBeenCalledWith('req1');
        await handleSocialResponse(press(SOCIAL_ACTION.friendDecline));
        expect(mockDeclineFriend).toHaveBeenCalledWith('req1');
    });

    it("joins or declines that friend's challenge", async () => {
        await handleSocialResponse(press(SOCIAL_ACTION.challengeJoin));
        expect(mockRespond).toHaveBeenCalledWith('run1', true);
        await handleSocialResponse(press(SOCIAL_ACTION.challengeDecline));
        expect(mockRespond).toHaveBeenLastCalledWith('run1', false);
    });
});
