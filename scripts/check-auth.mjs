#!/usr/bin/env node
/** Check public auth settings and the actual OAuth return path without signing anyone in. */
import { readFileSync } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';

const env = {};
try {
    for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
        const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
} catch { /* Environment variables also work in CI. */ }
Object.assign(env, process.env);
const base = env.EXPO_PUBLIC_SUPABASE_URL;
const key = env.EXPO_PUBLIC_SUPABASE_KEY;
const redirect = 'habyss://auth-callback';
let failures = 0;
function check(ok, label) {
    console.log(`${ok ? 'ok' : 'FAIL'} — ${label}`);
    if (!ok) failures++;
}
const request = (url, init = {}) => fetch(url, {
    redirect: 'manual', signal: AbortSignal.timeout(15000), ...init,
});

try {
    if (!base || !key) throw new Error('Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_KEY.');
    const settings = await request(`${base}/auth/v1/settings`, { headers: { apikey: key } });
    if (!settings.ok) throw new Error(`Auth settings returned HTTP ${settings.status}.`);
    const { external = {} } = await settings.json();
    for (const provider of ['apple', 'google', 'email']) check(!!external[provider], `${provider} enabled`);

    const authorize = new URL('/auth/v1/authorize', base);
    authorize.search = new URLSearchParams({ provider: 'google', redirect_to: redirect,
        code_challenge: createHash('sha256').update(randomBytes(32)).digest('base64url'),
        code_challenge_method: 's256',
    }).toString();
    const response = await request(authorize, { headers: { apikey: key } });
    if (response.status !== 302 || !response.headers.get('location')) {
        throw new Error(`Google authorization did not redirect (HTTP ${response.status}). Check its Client ID and Secret.`);
    }
    const google = new URL(response.headers.get('location'));
    check(google.hostname === 'accounts.google.com', 'Google authorization endpoint');
    check(google.searchParams.get('redirect_uri') === `${base}/auth/v1/callback`, 'Google returns to Supabase');
    const state = google.searchParams.get('state');
    if (!state) throw new Error('Google authorization is missing OAuth state.');
    // Cancel this diagnostic flow before any user authorization or token exchange.
    // Supabase returns the saved destination and an error in the fragment.
    const callback = new URL('/auth/v1/callback', base);
    callback.search = new URLSearchParams({ state, error: 'access_denied', error_description: 'Habyss diagnostic cancellation' }).toString();
    const cookie = response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
    const cancelled = await request(callback, { headers: { cookie } });
    const location = cancelled.headers.get('location');
    if (!location) throw new Error(`OAuth callback did not redirect (HTTP ${cancelled.status}).`);
    const destination = new URL(location);
    const fragment = new URLSearchParams(destination.hash.slice(1));
    const target = `${destination.protocol}//${destination.host}${destination.pathname}`;
    check(target === redirect || target === `${redirect}/`, `Supabase returns to Habyss (${target})`);
    check(fragment.get('error_description') === 'Habyss diagnostic cancellation', 'OAuth state survived the round trip');
    if (failures) console.log(`Set Site URL and add Redirect URL ${redirect} in Supabase → Authentication → URL Configuration.`);
    console.log('No account was signed in. Real Apple, Google, and email authorization still require a device test.');
} catch (error) {
    check(false, error.message);
}
process.exitCode = failures ? 1 : 0;
