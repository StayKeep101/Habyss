import { Linking, Platform } from 'react-native';
import type * as AppleAuthenticationModule from 'expo-apple-authentication';
import type * as CryptoModule from 'expo-crypto';
import type * as WebBrowserModule from 'expo-web-browser';
import { getSupabase } from './supabase';
import { finishSignIn, friendly, type Result } from './account';
import { getName, saveName } from './echo';
import { hasExpoModule } from './nativeModules';
import type { SyncReport } from './cloudSync';

/**
 * Sign in with Apple and with Google.
 *
 * Both end in a Supabase session and then finishSignIn, exactly like the
 * emailed code, so backup, restore and friends do not care which was used.
 *
 * Apple is native: the system sheet returns an identity token that Supabase
 * verifies. Google goes through Supabase's OAuth page in a secure in-app
 * browser and comes back to habyss://auth-callback with a one-time code.
 *
 * The native modules load on first use, not at import. A build made before
 * one of them was installed then only loses that button; importing them at the
 * top would crash every screen that imports this file.
 */

/** Loaded only when this build actually contains the native side. */
function load<T>(nativeName: string, get: () => T): T | null {
    if (!hasExpoModule(nativeName)) return null;
    try { return get(); } catch { return null; }
}
const apple = () => load<typeof AppleAuthenticationModule>('ExpoAppleAuthentication', () => require('expo-apple-authentication'));
const crypto = () => load<typeof CryptoModule>('ExpoCrypto', () => require('expo-crypto'));
const browser = () => load<typeof WebBrowserModule>('ExpoWebBrowser', () => require('expo-web-browser'));

const NOT_IN_BUILD: SocialResult = { ok: false, error: 'This version of the app needs updating to use this sign-in.' };

/** A cancelled sheet is not an error; the screen just stays as it was. */
export type SocialResult = Result<SyncReport> | { ok: false; cancelled: true; error: '' };

const CANCELLED: SocialResult = { ok: false, cancelled: true, error: '' };
export const GOOGLE_REDIRECT = 'habyss://auth-callback';

export async function isAppleSignInAvailable(): Promise<boolean> {
    if (Platform.OS !== 'ios' || !getSupabase()) return false;
    const AppleAuthentication = apple();
    // The nonce is a hardening step, not a requirement: a build without
    // expo-crypto still signs in, so the button is not hidden over it.
    if (!AppleAuthentication) return false;
    return AppleAuthentication.isAvailableAsync().catch(() => false);
}

/**
 * Google works in any build: with expo-web-browser it opens in the in-app
 * browser, and without it, in the phone's browser, returning through the
 * habyss://auth-callback link either way.
 */
export function isGoogleSignInAvailable(): boolean {
    return !!getSupabase();
}

export async function signInWithApple(): Promise<SocialResult> {
    try { return await performAppleSignIn(); }
    catch (error: any) { return { ok: false, error: friendly(error?.message || 'Sign in with Apple did not work. Try again.') }; }
}

async function performAppleSignIn(): Promise<SocialResult> {
    const sb = getSupabase();
    if (!sb) return { ok: false, error: 'Accounts are not set up in this build.' };
    const AppleAuthentication = apple();
    if (!AppleAuthentication) return NOT_IN_BUILD;

    // Apple signs a hash of this nonce into its token and Supabase checks the
    // original against it, so a stolen token cannot be replayed. A build
    // without expo-crypto simply signs in without one.
    const Crypto = crypto();
    const rawNonce = Crypto ? Crypto.randomUUID() : null;
    const hashedNonce = rawNonce && Crypto
        ? await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce)
        : undefined;

    let credential: AppleAuthenticationModule.AppleAuthenticationCredential;
    try {
        credential = await AppleAuthentication.signInAsync({
            requestedScopes: [
                AppleAuthentication.AppleAuthenticationScope.EMAIL,
                AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
            ],
            ...(hashedNonce ? { nonce: hashedNonce } : {}),
        });
    } catch (error: any) {
        if (error?.code === 'ERR_REQUEST_CANCELED') return CANCELLED;
        // Apple refuses outright when the app is not authorised to use it,
        // which is a setup step, not something the user can retry past.
        if (/not (enabled|authorized)/i.test(String(error?.message ?? ''))) {
            return { ok: false, error: 'Sign in with Apple is not enabled for this build yet.' };
        }
        if (error?.code === 'ERR_REQUEST_UNKNOWN') {
            return { ok: false, error: 'Apple could not start sign-in. Use the latest Habyss build on an iPhone signed in to your Apple Account, then try again.' };
        }
        return { ok: false, error: 'Sign in with Apple did not work. Try again.' };
    }
    if (!credential.identityToken) return { ok: false, error: 'Apple did not return a sign-in token.' };

    // Apple hands over the name only on the very first sign-in. Keep it, so the
    // app can greet them without asking again; never overwrite a name they set.
    const given = credential.fullName?.givenName?.trim();
    if (given && !(await getName())) await saveName(given).catch(() => undefined);

    const { data, error } = await sb.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
        ...(rawNonce ? { nonce: rawNonce } : {}),
    });
    if (error || !data.session?.user) {
        const message = String(error?.message ?? '');
        if (/provider is not enabled|unsupported provider/i.test(message)) {
            return { ok: false, error: 'Apple sign-in is not switched on for this app yet.' };
        }
        return { ok: false, error: friendly(message || 'Sign in with Apple did not work.') };
    }

    return finishSignIn(data.session.user.id);
}

export async function signInWithGoogle(): Promise<SocialResult> {
    try { return await performGoogleSignIn(); }
    catch (error: any) { return { ok: false, error: friendly(error?.message || 'Sign in with Google did not work. Try again.') }; }
}

async function performGoogleSignIn(): Promise<SocialResult> {
    const sb = getSupabase();
    if (!sb) return { ok: false, error: 'Accounts are not set up in this build.' };
    const { data, error } = await sb.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: GOOGLE_REDIRECT,
            skipBrowserRedirect: true,
            queryParams: { prompt: 'select_account' },
        },
    });
    if (error || !data?.url) {
        const message = String(error?.message ?? '');
        if (/provider is not enabled|unsupported provider/i.test(message)) {
            return { ok: false, error: 'Google sign-in is not switched on for this app yet.' };
        }
        return { ok: false, error: friendly(message || 'Google sign-in is not available.') };
    }

    const returned = await openForSignIn(data.url);
    if (!returned) return CANCELLED;

    return completeOAuthSignIn(returned);
}

// Both the browser and the callback route can receive this one-time code.
const exchanges = new Map<string, Promise<SocialResult>>();
export async function completeOAuthSignIn(url: string): Promise<SocialResult> {
    const sb = getSupabase();
    if (!sb) return { ok: false, error: 'Accounts are not set up in this build.' };
    const params = paramsFrom(url);
    if (params.error) {
        return { ok: false, error: params.error_description?.replace(/\+/g, ' ') || 'Google sign-in was refused.' };
    }
    if (!params.code) return { ok: false, error: 'Google did not return a sign-in code.' };

    const existing = exchanges.get(params.code);
    if (existing) return existing;
    const exchange = (async (): Promise<SocialResult> => {
        try {
            const result = await sb.auth.exchangeCodeForSession(params.code);
            if (result.error || !result.data.session?.user) return { ok: false, error: friendly(result.error?.message ?? 'Google sign-in did not work.') };
            return finishSignIn(result.data.session.user.id);
        } catch (error: any) {
            return { ok: false, error: friendly(error?.message || 'Sign-in could not finish. Please try again.') };
        }
    })();
    exchanges.set(params.code, exchange);
    return exchange;
}

/**
 * Opens the sign-in page and waits for the app to be handed back the callback.
 *
 * The in-app browser does this in one call. Without it, the page opens in the
 * phone's browser and the app listens for habyss://auth-callback instead, so a
 * build made before expo-web-browser existed can still sign in with Google.
 */
async function openForSignIn(url: string): Promise<string | null> {
    const WebBrowser = browser();
    if (WebBrowser) {
        const result = await WebBrowser.openAuthSessionAsync(url, GOOGLE_REDIRECT);
        return result.type === 'success' ? result.url : null;
    }

    return new Promise<string | null>(resolve => {
        let done = false;
        const finish = (value: string | null) => {
            if (done) return;
            done = true;
            subscription.remove();
            clearTimeout(timer);
            resolve(value);
        };
        const subscription = Linking.addEventListener('url', event => {
            if (event.url?.startsWith(GOOGLE_REDIRECT)) finish(event.url);
        });
        // Five minutes is long enough to sign in and far short of forever.
        const timer = setTimeout(() => finish(null), 5 * 60 * 1000);
        Linking.openURL(url).catch(() => finish(null));
    });
}

/** Reads both ?query and #fragment parameters from the callback URL. */
export function paramsFrom(url: string): Record<string, string> {
    const out: Record<string, string> = {};
    const parts = url.split(/[?#]/).slice(1);
    for (const part of parts) {
        for (const pair of part.split('&')) {
            const separator = pair.indexOf('=');
            const key = separator < 0 ? pair : pair.slice(0, separator);
            const value = separator < 0 ? '' : pair.slice(separator + 1);
            if (key) out[decodeURIComponent(key)] = decodeURIComponent(value.replace(/\+/g, ' '));
        }
    }
    return out;
}
