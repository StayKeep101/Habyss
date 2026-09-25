#!/usr/bin/env node
/**
 * Makes the "Secret Key" Supabase asks for on the Apple provider.
 *
 * You almost certainly do not need this. Habyss signs in with Apple natively
 * — the Face ID sheet, then `signInWithIdToken` — and that flow needs only the
 * bundle id in the provider's "Client IDs" field. Apple's client secret is for
 * the web OAuth flow, and it expires after six months at most, so anything
 * relying on it breaks twice a year.
 *
 * It is here for the case where Supabase will not save the provider without
 * one, or where a web sign-in is added later.
 *
 * What it needs, none of which is ever printed or committed:
 *   APPLE_TEAM_ID    developer.apple.com → Membership → Team ID (10 characters)
 *   APPLE_KEY_ID     the Key ID shown when the .p8 was created
 *   APPLE_CLIENT_ID  the Services ID for web, or com.habyss.app for native
 *   APPLE_P8_PATH    where the downloaded AuthKey_XXXXXXXXXX.p8 lives
 *
 * Put them in .env.local (gitignored) and run:
 *   node scripts/apple-client-secret.mjs
 */

import { Buffer } from 'node:buffer';
import { createPrivateKey, createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';

const base64url = (input) =>
    Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** Reads .env.local without pulling in a dependency, and without echoing it. */
function loadEnvLocal() {
    try {
        for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
            const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
            if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
        }
    } catch {
        // No .env.local is fine; the values can come from the environment.
    }
}

loadEnvLocal();

const teamId = process.env.APPLE_TEAM_ID;
const keyId = process.env.APPLE_KEY_ID;
const clientId = process.env.APPLE_CLIENT_ID;
const p8Path = process.env.APPLE_P8_PATH;

const missing = Object.entries({ APPLE_TEAM_ID: teamId, APPLE_KEY_ID: keyId, APPLE_CLIENT_ID: clientId, APPLE_P8_PATH: p8Path })
    .filter(([, value]) => !value)
    .map(([name]) => name);

if (missing.length) {
    console.error(`Missing: ${missing.join(', ')}\nPut them in .env.local, then run this again.`);
    console.error('\nSee the comment at the top of this file for where each one comes from.');
    process.exit(1);
}

let privateKey;
try {
    privateKey = createPrivateKey(readFileSync(p8Path, 'utf8'));
} catch (error) {
    console.error(`Could not read the key at ${p8Path}: ${error.message}`);
    process.exit(1);
}

// Apple caps the lifetime at six months and rejects anything longer.
const SIX_MONTHS = 60 * 60 * 24 * 180;
const now = Math.floor(Date.now() / 1000);

const header = base64url(JSON.stringify({ alg: 'ES256', kid: keyId }));
const payload = base64url(JSON.stringify({
    iss: teamId,
    iat: now,
    exp: now + SIX_MONTHS,
    aud: 'https://appleid.apple.com',
    sub: clientId,
}));

// JWS wants the raw r||s pair, not the DER envelope OpenSSL gives by default.
const signature = createSign('SHA256')
    .update(`${header}.${payload}`)
    .sign({ key: privateKey, dsaEncoding: 'ieee-p1363' });

console.log(`${header}.${payload}.${base64url(signature)}`);
console.error(`\nPaste that into Supabase → Authentication → Providers → Apple → Secret Key.`);
console.error(`It expires ${new Date((now + SIX_MONTHS) * 1000).toDateString()}, and must be replaced before then.`);
