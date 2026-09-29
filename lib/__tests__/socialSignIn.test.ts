const mockAuth = {
    signInWithIdToken: jest.fn(),
    signInWithOAuth: jest.fn(),
    exchangeCodeForSession: jest.fn(),
    updateUser: jest.fn(async () => ({ error: null })),
};
jest.mock('../supabase', () => ({ getSupabase: () => ({ auth: mockAuth }) }));
jest.mock('../account', () => ({
    finishSignIn: jest.fn(async () => ({ ok: true, value: { ok: true, uploaded: 0, downloaded: 4, failed: 0 } })),
    friendly: (message: string) => message,
}));
jest.mock('expo-apple-authentication', () => ({
    isAvailableAsync: jest.fn(async () => true),
    signInAsync: jest.fn(),
    AppleAuthenticationScope: { EMAIL: 1, FULL_NAME: 0 },
}));
jest.mock('expo-crypto', () => ({
    randomUUID: () => 'raw-nonce',
    digestStringAsync: jest.fn(async () => 'hashed-nonce'),
    CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
}));
jest.mock('expo-web-browser', () => ({ openAuthSessionAsync: jest.fn() }));
const mockSecureProfile = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
    getItemAsync: jest.fn(async (key: string) => mockSecureProfile.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => { mockSecureProfile.set(key, value); }),
    deleteItemAsync: jest.fn(async (key: string) => { mockSecureProfile.delete(key); }),
}));
// In tests there is no native side; the real check answers false.
jest.mock('../nativeModules', () => ({ hasExpoModule: () => true, hasTurboModule: () => true }));
jest.mock('../echo', () => ({ getName: jest.fn(async () => undefined), saveName: jest.fn(async () => undefined) }));

import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import { GOOGLE_REDIRECT, paramsFrom, signInWithApple, signInWithGoogle } from '../socialSignIn';
import { finishSignIn } from '../account';
import { getName, saveName } from '../echo';

const USER = 'aaaaaaaa-0000-4000-8000-000000000001';
beforeEach(() => { jest.clearAllMocks(); mockSecureProfile.clear(); });

describe('Sign in with Apple', () => {
    it('gives Apple the hashed nonce and Supabase the raw one', async () => {
        (require("expo-apple-authentication").signInAsync as jest.Mock).mockResolvedValue({ identityToken: 'apple-jwt' });
        mockAuth.signInWithIdToken.mockResolvedValue({ data: { session: { user: { id: USER } } }, error: null });
        const result = await signInWithApple();
        expect(AppleAuthentication.signInAsync).toHaveBeenCalledWith(expect.objectContaining({ nonce: 'hashed-nonce' }));
        expect(mockAuth.signInWithIdToken).toHaveBeenCalledWith({ provider: 'apple', token: 'apple-jwt', nonce: 'raw-nonce' });
        expect(finishSignIn).toHaveBeenCalledWith(USER);
        expect(result.ok).toBe(true);
    });

    it('keeps the name Apple gives on the first sign-in', async () => {
        (AppleAuthentication.signInAsync as jest.Mock).mockResolvedValue({ identityToken: 'apple-jwt', fullName: { givenName: 'Erwan' } });
        mockAuth.signInWithIdToken.mockResolvedValue({ data: { session: { user: { id: USER } } }, error: null });
        await signInWithApple();
        expect(saveName).toHaveBeenCalledWith('Erwan');
        expect(mockAuth.updateUser).toHaveBeenCalledWith({ data: { full_name: 'Erwan', given_name: 'Erwan' } });
    });

    it('never overwrites a name the user already has', async () => {
        (getName as jest.Mock).mockResolvedValueOnce('Bea');
        (AppleAuthentication.signInAsync as jest.Mock).mockResolvedValue({ identityToken: 'apple-jwt', fullName: { givenName: 'Erwan' } });
        mockAuth.signInWithIdToken.mockResolvedValue({ data: { session: { user: { id: USER } } }, error: null });
        await signInWithApple();
        expect(saveName).not.toHaveBeenCalled();
    });

    it('treats closing the sheet as a cancel, not an error', async () => {
        (require("expo-apple-authentication").signInAsync as jest.Mock).mockRejectedValue({ code: 'ERR_REQUEST_CANCELED' });
        expect(await signInWithApple()).toMatchObject({ ok: false, cancelled: true });
        expect(mockAuth.signInWithIdToken).not.toHaveBeenCalled();
    });

    it('does not link the phone when Supabase refuses the token', async () => {
        (require("expo-apple-authentication").signInAsync as jest.Mock).mockResolvedValue({ identityToken: 'apple-jwt' });
        mockAuth.signInWithIdToken.mockResolvedValue({ data: { session: null }, error: { message: 'Bad ID token' } });
        expect(await signInWithApple()).toEqual({ ok: false, error: 'Bad ID token' });
        expect(finishSignIn).not.toHaveBeenCalled();
    });

    it('says so plainly when Apple has not been switched on for the project', async () => {
        (require("expo-apple-authentication").signInAsync as jest.Mock).mockResolvedValue({ identityToken: 'apple-jwt' });
        mockAuth.signInWithIdToken.mockResolvedValue({ data: { session: null }, error: { message: 'Unsupported provider: provider is not enabled' } });
        const result = await signInWithApple();
        expect(result).toMatchObject({ ok: false });
        expect(result.ok === false && result.error).toMatch(/not switched on/);
    });

    it('preserves all supplied name parts without writing nulls on later sign-ins', async () => {
        (AppleAuthentication.signInAsync as jest.Mock).mockResolvedValueOnce({ identityToken: 'jwt', user: 'apple-user',
            fullName: { givenName: ' Ada ', middleName: ' M ', familyName: ' Lovelace ' } });
        mockAuth.signInWithIdToken.mockResolvedValue({ data: { session: { user: { id: USER } } }, error: null });
        await signInWithApple();
        expect(mockAuth.updateUser).toHaveBeenCalledWith({ data: {
            full_name: 'Ada M Lovelace', given_name: 'Ada', middle_name: 'M', family_name: 'Lovelace',
        } });
        expect(mockSecureProfile.size).toBe(0);
        mockAuth.updateUser.mockClear();
        (AppleAuthentication.signInAsync as jest.Mock).mockResolvedValueOnce({ identityToken: 'jwt', user: 'apple-user', fullName: { givenName: null, familyName: null } });
        await signInWithApple();
        expect(mockAuth.updateUser).not.toHaveBeenCalled();
    });

    it('keeps the first name through a failed exchange without changing the local profile', async () => {
        (AppleAuthentication.signInAsync as jest.Mock).mockResolvedValueOnce({ identityToken: 'jwt', user: 'apple-user', fullName: { givenName: 'Ada' } });
        mockAuth.signInWithIdToken.mockResolvedValueOnce({ data: { session: null }, error: { message: 'Network failure' } });
        expect((await signInWithApple()).ok).toBe(false);
        expect(saveName).not.toHaveBeenCalled();
        expect(mockAuth.updateUser).not.toHaveBeenCalled();
        (AppleAuthentication.signInAsync as jest.Mock).mockResolvedValueOnce({ identityToken: 'jwt', user: 'apple-user', fullName: null });
        mockAuth.signInWithIdToken.mockResolvedValueOnce({ data: { session: { user: { id: USER } } }, error: null });
        expect((await signInWithApple()).ok).toBe(true);
        expect(mockAuth.updateUser).toHaveBeenCalledWith({ data: { full_name: 'Ada', given_name: 'Ada' } });
        expect(saveName).toHaveBeenCalledWith('Ada');
    });

    it('retries a failed metadata upload on the next Apple sign-in', async () => {
        (AppleAuthentication.signInAsync as jest.Mock).mockResolvedValueOnce({ identityToken: 'jwt', user: 'apple-user', fullName: { givenName: 'Ada' } });
        mockAuth.signInWithIdToken.mockResolvedValue({ data: { session: { user: { id: USER } } }, error: null });
        mockAuth.updateUser.mockRejectedValueOnce(new Error('Offline'));
        expect((await signInWithApple()).ok).toBe(true);
        expect(mockSecureProfile.size).toBe(1);
        (AppleAuthentication.signInAsync as jest.Mock).mockResolvedValueOnce({ identityToken: 'jwt', user: 'apple-user', fullName: null });
        await signInWithApple();
        expect(mockAuth.updateUser).toHaveBeenCalledTimes(2);
        expect(mockSecureProfile.size).toBe(0);
    });

    it('does not attach another Apple account’s pending name', async () => {
        mockSecureProfile.set('habyss_apple_pending_profile', JSON.stringify({ user: 'someone-else', profile: { full_name: 'Ada', given_name: 'Ada' } }));
        (AppleAuthentication.signInAsync as jest.Mock).mockResolvedValueOnce({ identityToken: 'jwt', user: 'apple-user', fullName: null });
        mockAuth.signInWithIdToken.mockResolvedValue({ data: { session: { user: { id: USER } } }, error: null });
        await signInWithApple();
        expect(mockAuth.updateUser).not.toHaveBeenCalled();
        expect(saveName).not.toHaveBeenCalled();
    });

    it('restores the greeting from verified metadata on a new device', async () => {
        (AppleAuthentication.signInAsync as jest.Mock).mockResolvedValueOnce({ identityToken: 'jwt', fullName: null });
        mockAuth.signInWithIdToken.mockResolvedValueOnce({ data: { session: { user: { id: USER, user_metadata: { given_name: 'Ada' } } } }, error: null });
        await signInWithApple();
        expect(saveName).toHaveBeenCalledWith('Ada');
    });

    it('rejects a missing identity token without linking or changing a profile', async () => {
        (AppleAuthentication.signInAsync as jest.Mock).mockResolvedValueOnce({ identityToken: null, fullName: { givenName: 'Ada' } });
        expect((await signInWithApple()).ok).toBe(false);
        expect(mockAuth.signInWithIdToken).not.toHaveBeenCalled();
        expect(mockAuth.updateUser).not.toHaveBeenCalled();
        expect(saveName).not.toHaveBeenCalled();
        expect(finishSignIn).not.toHaveBeenCalled();
    });

    it('opens only one native sheet and exchanges once when tapped twice', async () => {
        (AppleAuthentication.signInAsync as jest.Mock).mockResolvedValueOnce({ identityToken: 'jwt' });
        mockAuth.signInWithIdToken.mockResolvedValueOnce({ data: { session: { user: { id: USER } } }, error: null });
        const results = await Promise.all([signInWithApple(), signInWithApple()]);
        expect(results.every(result => result.ok)).toBe(true);
        expect(AppleAuthentication.signInAsync).toHaveBeenCalledTimes(1);
        expect(mockAuth.signInWithIdToken).toHaveBeenCalledTimes(1);
    });
});

describe('Sign in with Google', () => {
    beforeEach(() => {
        mockAuth.signInWithOAuth.mockResolvedValue({ data: { url: 'https://x.supabase.co/auth/v1/authorize' }, error: null });
    });

    it('comes back to the app and exchanges the code', async () => {
        (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValue({ type: 'success', url: `${GOOGLE_REDIRECT}?code=abc123` });
        mockAuth.exchangeCodeForSession.mockResolvedValue({ data: { session: { user: { id: USER } } }, error: null });
        const result = await signInWithGoogle();
        expect(mockAuth.signInWithOAuth).toHaveBeenCalledWith(expect.objectContaining({
            provider: 'google',
            options: expect.objectContaining({ redirectTo: GOOGLE_REDIRECT, skipBrowserRedirect: true }),
        }));
        expect(mockAuth.exchangeCodeForSession).toHaveBeenCalledWith('abc123');
        expect(finishSignIn).toHaveBeenCalledWith(USER);
        expect(result.ok).toBe(true);
    });

    it('treats closing the browser as a cancel', async () => {
        (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValue({ type: 'cancel' });
        expect(await signInWithGoogle()).toMatchObject({ ok: false, cancelled: true });
    });

    it('shows the reason Google or Supabase gives', async () => {
        (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValue({
            type: 'success', url: `${GOOGLE_REDIRECT}#error=access_denied&error_description=Unsupported+provider`,
        });
        expect(await signInWithGoogle()).toEqual({ ok: false, error: 'Unsupported provider' });
        expect(mockAuth.exchangeCodeForSession).not.toHaveBeenCalled();
    });
});

describe('paramsFrom', () => {
    it('reads query and fragment parameters', () => {
        expect(paramsFrom('habyss://auth-callback?code=1&x=a%20b#y=2')).toEqual({ code: '1', x: 'a b', y: '2' });
    });
});

describe('recoverable sign-in failures and cold starts', () => {
    it('returns network failures so the Apple button can be retried', async () => {
        (AppleAuthentication.signInAsync as jest.Mock).mockResolvedValueOnce({ identityToken: 'token' });
        mockAuth.signInWithIdToken.mockRejectedValueOnce(new Error('Network request failed'));
        expect(await signInWithApple()).toMatchObject({ ok: false, error: 'Network request failed' });
    });
    it('completes a cold-start callback and exchanges duplicate deliveries once', async () => {
        const { completeOAuthSignIn } = require('../socialSignIn');
        mockAuth.exchangeCodeForSession.mockResolvedValueOnce({ data: { session: { user: { id: USER } } }, error: null });
        const url = `${GOOGLE_REDIRECT}?code=cold-start-code`;
        const results = await Promise.all([completeOAuthSignIn(url), completeOAuthSignIn(url)]);
        expect(results.every(result => result.ok)).toBe(true);
        expect(mockAuth.exchangeCodeForSession).toHaveBeenCalledTimes(1);
        expect(finishSignIn).toHaveBeenCalledTimes(1);
    });
    it('preserves equals signs in callback values and decodes spaces', () => {
        expect(paramsFrom('habyss://auth-callback?code=abc=def&error_description=Please+try+again')).toEqual({ code: 'abc=def', error_description: 'Please try again' });
    });
});

describe('email callbacks and callback safety', () => {
    const complete = (url: string) => require('../socialSignIn').completeOAuthSignIn(url);

    it('exchanges a magic-link PKCE code through the same account sync', async () => {
        mockAuth.exchangeCodeForSession.mockResolvedValueOnce({ data: { session: { user: { id: USER } } }, error: null });
        expect((await complete(`${GOOGLE_REDIRECT}?code=email-link-code`)).ok).toBe(true);
        expect(mockAuth.exchangeCodeForSession).toHaveBeenCalledWith('email-link-code');
        expect(finishSignIn).toHaveBeenCalledWith(USER);
    });

    it('surfaces expired email links from a fragment without exchanging a code', async () => {
        expect(await complete(`${GOOGLE_REDIRECT}#error=access_denied&error_code=otp_expired&error_description=Email+link+has+expired`))
            .toEqual({ ok: false, error: 'Email link has expired' });
        expect(mockAuth.exchangeCodeForSession).not.toHaveBeenCalled();
    });

    it('rejects other hosts even when their names start with the callback', async () => {
        expect((await complete('habyss://auth-callback.evil?code=stolen')).ok).toBe(false);
        expect((await complete('https://auth-callback?code=stolen')).ok).toBe(false);
        expect(mockAuth.exchangeCodeForSession).not.toHaveBeenCalled();
    });

    it('does not crash or exchange malformed callback parameters', async () => {
        expect((await complete(`${GOOGLE_REDIRECT}?code=%E0%A4%A`)).ok).toBe(false);
        expect(mockAuth.exchangeCodeForSession).not.toHaveBeenCalled();
    });

    it('explains how to recover when the email was requested on another device', async () => {
        mockAuth.exchangeCodeForSession.mockResolvedValueOnce({ data: { session: null },
            error: { code: 'flow_state_not_found', message: 'Flow state not found' } });
        const result = await complete(`${GOOGLE_REDIRECT}?code=other-phone`);
        expect(result).toMatchObject({ ok: false, error: expect.stringContaining('phone where you requested it') });
        expect(finishSignIn).not.toHaveBeenCalled();
    });

    it('does not overwrite the Google PKCE verifier on duplicate taps', async () => {
        mockAuth.signInWithOAuth.mockResolvedValueOnce({ data: { url: 'https://x.supabase.co/auth/v1/authorize' }, error: null });
        (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValueOnce({ type: 'success', url: `${GOOGLE_REDIRECT}?code=double-google` });
        mockAuth.exchangeCodeForSession.mockResolvedValueOnce({ data: { session: { user: { id: USER } } }, error: null });
        const results = await Promise.all([signInWithGoogle(), signInWithGoogle()]);
        expect(results.every(result => result.ok)).toBe(true);
        expect(mockAuth.signInWithOAuth).toHaveBeenCalledTimes(1);
        expect(WebBrowser.openAuthSessionAsync).toHaveBeenCalledTimes(1);
        expect(mockAuth.exchangeCodeForSession).toHaveBeenCalledTimes(1);
    });
});
