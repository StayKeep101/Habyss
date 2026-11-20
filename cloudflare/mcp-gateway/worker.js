/**
 * mcp.<domain>: the short address for Habyss's MCP server, so Claude and
 * ChatGPT connect to "mcp.habyss.app" instead of a 100-character Supabase link.
 *
 *   /.well-known/oauth-protected-resource   how to sign in (RFC 9728): this address
 *   /.well-known/oauth-authorization-server  Supabase Auth's metadata, with this address in front
 *   /oauth/authorize, /oauth/token, /oauth/register
 *                                            passed on to Supabase Auth's OAuth server, so the
 *                                            sign-in prompt on the phone names habyss.app, not supabase.co
 *   /oauth/consent                           "Connect Habyss": Open Habyss to allow (or an emailed code);
 *                                            Supabase's OAuth server sends people here
 *   /oauth/handoff/<authorization_id>        POST from the app (signed in): allow or deny, answered by
 *                                            Supabase; GET from the consent page: where to go next
 *
 *   everything else                          forwarded to the mcp edge function
 *
 * The server itself (supabase/functions/mcp) checks every request; this only
 * forwards and serves the one page Supabase functions cannot (HTML).
 */
import { consentPage } from './consent.js';

/**
 * One sign-in's answer, from the app to the page waiting in Claude: the
 * redirect Supabase gave, kept 10 minutes. Useless without the code verifier
 * the assistant holds, and only ever set from Supabase's own reply.
 */
export class Handoff {
    constructor(state) { this.state = state; }
    async fetch(request) {
        if (request.method === 'PUT') {
            await this.state.storage.put('redirect', await request.text());
            await this.state.storage.setAlarm(Date.now() + 10 * 60 * 1000);
            return new Response(null, { status: 204 });
        }
        const redirect = await this.state.storage.get('redirect');
        return redirect ? new Response(redirect) : new Response(null, { status: 204 });
    }
    async alarm() { await this.state.storage.deleteAll(); }
}

const AUTH_ID = /^[A-Za-z0-9_-]{8,128}$/;

const json = (body, status = 200) => new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=300' },
});

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const publicUrl = env.PUBLIC_URL.replace(/\/$/, '');
        const issuer = `${env.SUPABASE_URL}/auth/v1`;

        if (url.pathname.startsWith('/.well-known/oauth-protected-resource')) {
            return json({
                resource: publicUrl,
                resource_name: 'Habyss',
                authorization_servers: [publicUrl],
                bearer_methods_supported: ['header'],
            });
        }
        if (url.pathname.startsWith('/.well-known/oauth-authorization-server') || url.pathname.startsWith('/.well-known/openid-configuration')) {
            const upstream = await fetch(`${issuer}${url.pathname.startsWith('/.well-known/openid') ? '/.well-known/openid-configuration' : '/.well-known/oauth-authorization-server'}`);
            if (!upstream.ok) return new Response(upstream.body, { status: upstream.status, headers: { 'Content-Type': 'application/json' } });
            const meta = await upstream.json();
            return json({
                ...meta,
                issuer: publicUrl,
                authorization_endpoint: `${publicUrl}/oauth/authorize`,
                token_endpoint: `${publicUrl}/oauth/token`,
                registration_endpoint: `${publicUrl}/oauth/register`,
            });
        }
        if (request.method === 'OPTIONS' && url.pathname.startsWith('/oauth/')) {
            return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Max-Age': '86400' } });
        }
        // The first page the phone opens to sign in: straight on to Supabase Auth.
        if (url.pathname === '/oauth/authorize') {
            return Response.redirect(`${issuer}/oauth/authorize${url.search}`, 302);
        }
        if (url.pathname === '/oauth/token' || url.pathname === '/oauth/register') {
            const target = `${issuer}${url.pathname === '/oauth/token' ? '/oauth/token' : '/oauth/clients/register'}${url.search}`;
            const headers = new Headers();
            for (const name of ['content-type', 'authorization', 'accept']) { const value = request.headers.get(name); if (value) headers.set(name, value); }
            headers.set('apikey', env.SUPABASE_KEY);
            const upstream = await fetch(target, { method: request.method, headers, body: request.method === 'GET' ? undefined : request.body });
            const out = new Headers(upstream.headers);
            out.set('Access-Control-Allow-Origin', '*');
            return new Response(upstream.body, { status: upstream.status, headers: out });
        }
        const handoff = url.pathname.match(/^\/oauth\/handoff\/([^/]+)$/);
        if (handoff) {
            const id = handoff[1];
            if (!AUTH_ID.test(id)) return json({ error: 'Unknown sign-in.' }, 400);
            const box = env.HANDOFF.get(env.HANDOFF.idFromName(id));
            if (request.method === 'GET') {
                const answer = await box.fetch('https://handoff/');
                if (answer.status === 204) return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' } });
                return json({ redirect_url: await answer.text() });
            }
            if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
            const auth = request.headers.get('authorization') ?? '';
            if (!/^Bearer\s+\S+/.test(auth)) return json({ error: 'Sign in to Habyss first.' }, 401);
            const action = (await request.json().catch(() => ({}))).action === 'deny' ? 'deny' : 'approve';
            const headers = { apikey: env.SUPABASE_KEY, Authorization: auth, 'Content-Type': 'application/json', 'X-Supabase-Api-Version': '2024-01-01' };
            // Allowed before: Supabase answers the details with where to go.
            const details = await fetch(`${issuer}/oauth/authorizations/${id}`, { headers });
            const known = await details.json().catch(() => ({}));
            if (!details.ok) return json({ error: known.msg || known.message || 'That sign-in has expired. Start again in Claude.' }, details.status);
            let redirect = action === 'approve' ? known.redirect_url : undefined;
            if (!redirect) {
                const consent = await fetch(`${issuer}/oauth/authorizations/${id}/consent`, { method: 'POST', headers, body: JSON.stringify({ action }) });
                const answer = await consent.json().catch(() => ({}));
                if (!consent.ok || !answer.redirect_url) return json({ error: answer.msg || answer.message || 'That did not work. Start again in Claude.' }, consent.ok ? 502 : consent.status);
                redirect = answer.redirect_url;
            }
            await box.fetch('https://handoff/', { method: 'PUT', body: redirect });
            return json({ ok: true, client: known.client?.name || known.client?.client_name || null });
        }
        if (url.pathname === '/oauth/consent') {
            return new Response(consentPage({ supabaseUrl: env.SUPABASE_URL, supabaseKey: env.SUPABASE_KEY }), {
                headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer' },
            });
        }
        // Someone opening the address in a browser: say what it is for.
        if (url.pathname === '/' && request.method === 'GET' && (request.headers.get('accept') ?? '').includes('text/html')) {
            return new Response(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Habyss for AI assistants</title><body style="background:#0B1220;color:#E6ECF5;font:17px -apple-system,system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;padding:16px;text-align:center"><div><h1 style="font-size:24px">Habyss</h1><p>Add <b>${url.host}</b> as a connector in Claude or ChatGPT, then sign in.</p></div>`, {
                headers: { 'Content-Type': 'text/html; charset=utf-8' },
            });
        }

        // The MCP server: "/" and "/mcp", and the older key links ("/<hby_ key>").
        const rest = url.pathname.replace(/^\/mcp\/?/, '/').replace(/^\/$/, '');
        const target = `${env.SUPABASE_URL}/functions/v1/mcp${rest}${url.search}`;
        const headers = new Headers(request.headers);
        headers.delete('host');
        const upstream = await fetch(target, { method: request.method, headers, body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body });
        return new Response(upstream.body, { status: upstream.status, headers: upstream.headers });
    },
};
