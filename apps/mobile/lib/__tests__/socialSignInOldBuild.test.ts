// A build made before expo-crypto and expo-web-browser were added.
jest.mock('../nativeModules', () => ({
    hasExpoModule: (name: string) => name === 'ExpoAppleAuthentication',
    hasTurboModule: () => false,
}));

const mockAuth = { signInWithOAuth: jest.fn(), exchangeCodeForSession: jest.fn(), signInWithIdToken: jest.fn() };
jest.mock('../supabase', () => ({ getSupabase: () => ({ auth: mockAuth }) }));
jest.mock('../account', () => ({
    finishSignIn: jest.fn(async () => ({ ok: true, value: { ok: true, uploaded: 0, downloaded: 0, failed: 0 } })),
    friendly: (message: string) => message,
}));
jest.mock('../echo', () => ({ getName: jest.fn(async () => undefined), saveName: jest.fn() }));
jest.mock('expo-apple-authentication', () => ({
    isAvailableAsync: jest.fn(async () => true),
    signInAsync: jest.fn(async () => ({ identityToken: 'apple-jwt' })),
    AppleAuthenticationScope: { EMAIL: 1, FULL_NAME: 0 },
}));
jest.mock('expo-crypto', () => { throw new Error("Cannot find native module 'ExpoCrypto'"); });
jest.mock('expo-web-browser', () => { throw new Error("Cannot find native module 'ExpoWebBrowser'"); });

import { Linking } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { isAppleSignInAvailable, isGoogleSignInAvailable, signInWithApple, signInWithGoogle } from '../socialSignIn';
import { finishSignIn } from '../account';

const USER = 'aaaaaaaa-0000-4000-8000-000000000001';

// The phone's browser and the link back into the app, without mocking all of
// React Native, which the Expo test preset needs intact.
const listeners: ((event: { url: string }) => void)[] = [];
const mockOpenURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as never);
jest.spyOn(Linking, 'addEventListener').mockImplementation(((_event: string, handler: (event: { url: string }) => void) => {
    listeners.push(handler);
    return { remove: () => listeners.splice(listeners.indexOf(handler), 1) };
}) as never);

beforeEach(() => { mockOpenURL.mockClear(); listeners.length = 0; jest.clearAllMocks(); });

describe('an app built before expo-crypto and expo-web-browser', () => {
    it('still offers both buttons', async () => {
        expect(await isAppleSignInAvailable()).toBe(true);
        expect(isGoogleSignInAvailable()).toBe(true);
    });

    it('signs in with Apple without a nonce rather than refusing', async () => {
        mockAuth.signInWithIdToken.mockResolvedValue({ data: { session: { user: { id: USER } } }, error: null });
        const result = await signInWithApple();
        expect(result.ok).toBe(true);
        expect(AppleAuthentication.signInAsync).toHaveBeenCalledWith(expect.not.objectContaining({ nonce: expect.anything() }));
        expect(mockAuth.signInWithIdToken).toHaveBeenCalledWith(expect.not.objectContaining({ nonce: expect.anything() }));
    });

    it('sends Google through the phone browser and waits for the app to come back', async () => {
        mockAuth.signInWithOAuth.mockResolvedValue({ data: { url: 'https://x.supabase.co/authorize' }, error: null });
        mockAuth.exchangeCodeForSession.mockResolvedValue({ data: { session: { user: { id: USER } } }, error: null });

        const pending = signInWithGoogle();
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(mockOpenURL).toHaveBeenCalledWith('https://x.supabase.co/authorize');

        listeners.forEach(handler => handler({ url: 'habyss://auth-callback?code=abc123' }));
        const result = await pending;

        expect(mockAuth.exchangeCodeForSession).toHaveBeenCalledWith('abc123');
        expect(finishSignIn).toHaveBeenCalledWith(USER);
        expect(result.ok).toBe(true);
    });
});
