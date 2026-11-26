import type * as Notifications from 'expo-notifications';
import { SOCIAL_ACTION } from './notificationActions';

/**
 * A button pressed on a Community push (lib/notificationActions.ts): "On it"
 * on a nudge tells the friend, "Reply" on a comment answers in its thread,
 * "Accept" or "Decline" on a duel answers it, "Let's do it" or "No
 * thanks" on a shared habit or task answers that offer, "Accept" or
 * "Decline" on a friend request answers it, and "Join" or "Decline" on a
 * challenge invite answers that. The push names who it is from
 * (data.from); a friend pair has one duel at a time, and a reply goes under
 * their latest comment. False when the button is not one of these.
 */
export async function handleSocialResponse(response: Notifications.NotificationResponse): Promise<boolean> {
    const action = response.actionIdentifier;
    if (!(Object.values(SOCIAL_ACTION) as string[]).includes(action)) return false;
    const from = response.notification.request.content.data?.from;
    if (typeof from !== 'string') return true;
    if (action === SOCIAL_ACTION.shareYes || action === SOCIAL_ACTION.shareNo) {
        // Their latest offer still waiting on you: accepted (it joins your list) or declined.
        const { FriendsService } = require('./friendsService') as typeof import('./friendsService');
        const offer = (await FriendsService.pendingShares())
            .filter(share => share.fromUserId === from)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
        if (offer) {
            if (action === SOCIAL_ACTION.shareYes) await FriendsService.acceptShareRequest(offer.type, offer.itemId, from);
            else await FriendsService.declineShareRequest(offer.type, offer.itemId, from);
        }
    } else if (action === SOCIAL_ACTION.friendAccept || action === SOCIAL_ACTION.friendDecline) {
        // Their request to you, still waiting: accepted (you are friends) or declined.
        const { FriendsService } = require('./friendsService') as typeof import('./friendsService');
        const relation = await FriendsService.relationTo(from);
        if (relation.kind === 'incoming' && relation.requestId) {
            if (action === SOCIAL_ACTION.friendAccept) await FriendsService.acceptFriendRequest(relation.requestId);
            else await FriendsService.declineFriendRequest(relation.requestId);
        }
    } else if (action === SOCIAL_ACTION.challengeJoin || action === SOCIAL_ACTION.challengeDecline) {
        // Their invite still open: joined (its habits come into your plan) or declined.
        const challenges = require('./challenges') as typeof import('./challenges');
        const { localDateKey } = require('./habitSchedule') as typeof import('./habitSchedule');
        const today = localDateKey(new Date());
        const open = (await challenges.myChallenges()).filter(run => run.myStatus === 'invited' && challenges.canAnswer(run, today));
        const run = open.find(item => item.members.some(member => member.id === from)) ?? open[0];
        if (run) {
            await challenges.respondChallenge(run.runId, action === SOCIAL_ACTION.challengeJoin);
            void challenges.syncChallenges();
        }
    } else if (action === SOCIAL_ACTION.onIt) {
        const { FriendsService } = require('./friendsService') as typeof import('./friendsService');
        await FriendsService.answerNudge(from);
    } else if (action === SOCIAL_ACTION.reply) {
        const text = (response as { userText?: string }).userText?.trim();
        if (text) await (require('./comments') as typeof import('./comments')).replyToLatestFrom(from, text);
    } else {
        // Duels are gone (a push from before still lands here): Accept opens Community.
        if (action === SOCIAL_ACTION.accept) {
            setTimeout(() => { require('expo-router').router.navigate('/(root)/(tabs)/community'); }, 500);
        }
    }
    return true;
}
