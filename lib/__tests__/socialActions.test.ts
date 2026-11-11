const mockAnswerNudge = jest.fn(async () => true);
const mockReplyToLatestFrom = jest.fn(async () => null);
const mockRespondDuel = jest.fn(async () => undefined);
const mockAccept = jest.fn(async () => true);
const mockDecline = jest.fn(async () => true);
jest.mock('../friendsService', () => ({ FriendsService: {
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
jest.mock('../duels', () => ({
    myDuels: async () => [
        { id: 'mine', mine: true, friendId: 'sam', status: 'proposed' },
        { id: 'theirs', mine: false, friendId: 'sam', status: 'proposed' },
    ],
    respondDuel: mockRespondDuel,
}));
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

    it('Accept and Decline answer the duel they sent, not one you sent', async () => {
        jest.useFakeTimers();
        await handleSocialResponse(press(SOCIAL_ACTION.accept));
        await handleSocialResponse(press(SOCIAL_ACTION.decline));
        expect(mockRespondDuel.mock.calls).toEqual([['theirs', true], ['theirs', false]]);
        jest.useRealTimers();
    });

    it('a comment can be answered by typing on it', () => {
        const reply = CATEGORIES.find(category => category.id === COMMENT_CATEGORY)!.buttons[0];
        expect(reply.textInput?.submitButtonTitle).toBe('Send');
        expect(reply.options.opensAppToForeground).toBe(false);
    });
});
