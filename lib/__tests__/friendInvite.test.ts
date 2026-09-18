jest.mock('../supabase', () => ({ getSupabase: () => null, isCloudConfigured: () => false }));

import { FriendsService, addFriendByUsername, inviteLink, usernameFrom } from '../friendsService';

describe('usernameFrom', () => {
    it('reads a plain username, with or without @, in any case', () => {
        expect(usernameFrom('erwan')).toBe('erwan');
        expect(usernameFrom(' @Erwan_88 ')).toBe('erwan_88');
    });

    it('reads the username out of an invite link', () => {
        expect(usernameFrom(inviteLink('erwan.b'))).toBe('erwan.b');
        expect(usernameFrom('Join me on Habyss. Add me as @x: habyss://add-friend?u=milo_2')).toBe('milo_2');
    });

    it('reads the old QR format', () => {
        expect(usernameFrom(JSON.stringify({ type: 'friend', code: 'nova' }))).toBe('nova');
    });

    it('refuses anything that could not be a username', () => {
        expect(usernameFrom('ab')).toBeNull();
        expect(usernameFrom('drop table;')).toBeNull();
        expect(usernameFrom('')).toBeNull();
    });
});

describe('signed out', () => {
    it('shows no friends and sends nothing', async () => {
        expect(await FriendsService.isAvailable()).toBe(false);
        expect(await FriendsService.getFriends()).toEqual([]);
        expect(await FriendsService.getLeaderboard()).toEqual([]);
        expect(await addFriendByUsername('erwan')).toEqual({ ok: false, error: 'Sign in first.' });
    });
});
