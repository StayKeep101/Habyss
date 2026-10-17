import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.89.0'

/**
 * Emails each piece of feedback to the team the moment it is saved.
 *
 * Called only by the database (the `feedback_email` trigger, through pg_net),
 * never by the app: the request must carry the shared hook secret, so nobody
 * who finds the URL can send mail through it. The mail goes out through
 * Resend; the row is already saved either way, so a failed send loses nothing.
 */

const TO = 'erwin88peter@gmail.com'
const FROM = Deno.env.get('FEEDBACK_FROM') ?? 'Habyss feedback <onboarding@resend.dev>'

const escape = (text: string) => text.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))

Deno.serve(async (req) => {
    if (req.method !== 'POST') return new Response('method not allowed', { status: 405 })
    const secret = Deno.env.get('FEEDBACK_HOOK_SECRET')
    if (!secret || req.headers.get('x-feedback-secret') !== secret) return new Response('forbidden', { status: 403 })
    const key = Deno.env.get('RESEND_API_KEY')
    if (!key) return new Response('email is not configured', { status: 503 })

    const { id, user_id, message, context } = await req.json() as {
        id: string; user_id: string | null; message: string; context: Record<string, unknown> | null
    }
    if (!message) return new Response('no message', { status: 400 })

    // Who sent it, when they were signed in: the name friends see and the @username.
    let sender = 'Signed out'
    if (user_id) {
        const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
        const { data } = await admin.from('profiles').select('name, username').eq('id', user_id).maybeSingle()
        sender = [data?.name, data?.username ? `@${data.username}` : null].filter(Boolean).join(' ') || user_id
    }
    const details = Object.entries(context ?? {}).map(([k, v]) => `${k}: ${String(v)}`).join(' · ')
    const firstLine = message.split('\n')[0].slice(0, 60)

    const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            from: FROM,
            to: [TO],
            subject: `Habyss feedback: ${firstLine}`,
            text: `${message}\n\n— ${sender}\n${details}\n${id}`,
            html: `<p style="font-size:16px;white-space:pre-wrap">${escape(message)}</p><hr><p style="color:#666;font-size:13px">${escape(sender)}<br>${escape(details)}<br>${escape(id)}</p>`,
        }),
    })
    if (!response.ok) return new Response(await response.text(), { status: 502 })
    return new Response('sent')
})
