jest.mock('../supabase', () => ({ getSupabase: () => null, isCloudConfigured: () => false }));

import { FriendsService, addFriendByUsername, inviteLink, normaliseUsername, usernameFrom } from '../friendsService';

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

    it('refuses a QR code that belongs to some other app', () => {
        // It used to be offered as a friend to add, verbatim.
        expect(usernameFrom('https://example.com/menu')).toBeNull();
        expect(usernameFrom('WIFI:S:Cafe;T:WPA;P:hunter2;;')).toBeNull();
    });

    it('survives a link somebody has mangled by hand', () => {
        // decodeURIComponent throws on a stray percent; a broken invite should
        // be a null, not a crash inside a scanner.
        expect(usernameFrom('habyss://add-friend?u=100%')).toBeNull();
        expect(usernameFrom('habyss://add-friend?u=%E2%9C%93')).toBeNull();
    });
});

describe('normaliseUsername', () => {
    // The whole bug in one line: handles were read lowercase and stored with
    // whatever capitals were typed, so scanning @Pen searched for "pen" and was
    // told nobody was called that. `profiles.username` is constrained to this
    // shape now, so the two cannot drift apart again.
    it('writes a handle the one way it is stored', () => {
        expect(normaliseUsername('  @Pen ')).toBe('pen');
        expect(normaliseUsername('Pierre.Erwan')).toBe('pierre.erwan');
        expect(normaliseUsername('@@milo')).toBe('milo');
    });

    it('reads the same handle however it was capitalised', () => {
        expect(usernameFrom('@Pen')).toBe(usernameFrom('pen'));
        expect(usernameFrom(inviteLink('Pen'))).toBe('pen');
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
