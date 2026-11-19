/**
 * mcp.<domain>: the short address for Habyss's MCP server, so Claude and
 * ChatGPT connect to "mcp.habyss.app" instead of a 100-character Supabase link.
 *
 *   /.well-known/oauth-protected-resource   how to sign in (RFC 9728): Supabase Auth
 *   /.well-known/oauth-authorization-server  Supabase Auth's own metadata, mirrored here
 *   /oauth/consent                           "Allow Claude to use Habyss?" (Supabase's OAuth server sends people here)
 *   everything else                          forwarded to the mcp edge function
 *
 * The server itself (supabase/functions/mcp) checks every request; this only
 * forwards and serves the one page Supabase functions cannot (HTML).
 */
import { consentPage } from './consent.js';

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
                authorization_servers: [issuer],
                bearer_methods_supported: ['header'],
            });
        }
        if (url.pathname.startsWith('/.well-known/oauth-authorization-server') || url.pathname.startsWith('/.well-known/openid-configuration')) {
            const upstream = await fetch(`${issuer}${url.pathname.startsWith('/.well-known/openid') ? '/.well-known/openid-configuration' : '/.well-known/oauth-authorization-server'}`);
            return new Response(upstream.body, { status: upstream.status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
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
