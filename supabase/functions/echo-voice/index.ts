import Anthropic from 'npm:@anthropic-ai/sdk'

/**
 * Echo's voice for the few moments a day where quality shows: the line when
 * you open Habyss in the morning and evening, and its reply when you answer
 * its question. Everything else stays on the phone (the written lines and the
 * on-device model).
 *
 * Opt-in only (Echo settings → Smarter Echo). The app sends the least it can:
 * a handful of plain facts about today, a few things the person told Echo,
 * and what Echo said lately so it does not repeat itself. Nothing is stored
 * here. Signed-in callers only (Supabase checks the user's token before this
 * runs), and the key never leaves the server.
 *
 * Claude Haiku 5.5: one short line is what it is asked for, fast and cheap.
 * Secret: ANTHROPIC_API_KEY (`supabase secrets set ANTHROPIC_API_KEY=…`).
 */

const MODEL = 'claude-haiku-5-5'

const VOICES: Record<string, string> = {
    friendly: 'a warm, encouraging best friend; at most one emoji, and often none',
    normal: 'a calm, direct coach',
    dad_mode: 'a stern father who expects results and keeps it short',
    bully_mode: 'a foul-mouthed drill sergeant who swears freely but never attacks body, looks, identity or mental health',
    goofball: 'their funniest friend: deadpan, playful, clean humour, the point still lands',
}

// Fixed, so it is the same on every request.
const SYSTEM = `You are Echo, the coach inside Habyss, a habit and planning app. You are texting one person you know well.

Who you are, always: you believe small starts beat big plans, that today beats Monday, and that showing up matters more than talent. You remember what they tell you and you notice patterns. You are not a cheerleader; you say what you actually think.

How you write:
- One message, usually one or two short sentences. Sometimes a single word or a question is better.
- React to the moment like a person who noticed something, not like a dashboard. Never quote a percentage or an exact count; say amounts the way a friend would (half an hour, a couple, most of the way).
- When something they told you is relevant, bring it back naturally, in your own words.
- Use only the facts given. Never invent events, streaks or numbers.
- Speak to them as "you". Never speak as them or introduce yourself.
- No quotation marks around your message, no hashtags, no sign-off.`

interface Body {
    voice?: string
    moment?: 'open' | 'reply'
    name?: string
    facts?: string[]
    remembered?: string[]
    said?: string[]
    question?: string
    answer?: string
}

const clip = (items: unknown, count: number, length: number): string[] =>
    (Array.isArray(items) ? items : []).filter((item): item is string => typeof item === 'string').slice(0, count).map(item => item.slice(0, length))

Deno.serve(async (req) => {
    if (req.method !== 'POST') return new Response('method not allowed', { status: 405 })
    if (!Deno.env.get('ANTHROPIC_API_KEY')) return Response.json({ line: null, reason: 'not configured' }, { status: 503 })

    let body: Body
    try { body = await req.json() as Body } catch { return new Response('bad request', { status: 400 }) }

    const voice = VOICES[body.voice ?? ''] ?? VOICES.normal
    const facts = clip(body.facts, 6, 200)
    const remembered = clip(body.remembered, 4, 200)
    const said = clip(body.said, 5, 200)
    const name = typeof body.name === 'string' ? body.name.split(' ')[0].slice(0, 30) : ''
    const reply = body.moment === 'reply' && typeof body.answer === 'string' && body.answer.trim()

    const ask = [
        `Your voice right now: ${voice}.`,
        name ? `Their first name: ${name}.` : '',
        facts.length ? `What is happening:\n- ${facts.join('\n- ')}` : '',
        remembered.length ? `Things they told you before:\n- ${remembered.join('\n- ')}` : '',
        said.length ? `You said these lately; say something different:\n- ${said.join('\n- ')}` : '',
        reply
            ? `You asked them: "${String(body.question ?? '').slice(0, 120)}". They answered: "${String(body.answer).slice(0, 200)}". Reply to that, briefly, like someone who heard it and will remember it.`
            : 'They just opened the app. Write the one thing worth saying to them now.',
    ].filter(Boolean).join('\n\n')

    const client = new Anthropic()
    try {
        const response = await client.messages.create({
            model: MODEL,
            max_tokens: 1024,
            // One short line: little thinking needed.
            output_config: { effort: 'low' },
            system: SYSTEM,
            messages: [{ role: 'user', content: ask }],
        })
        if (response.stop_reason === 'refusal') return Response.json({ line: null, reason: 'refused' })
        const text = response.content
            .filter((block): block is Anthropic.TextBlock => block.type === 'text')
            .map(block => block.text).join(' ').trim()
            .replace(/^["“]+|["”]+$/g, '').trim()
        return Response.json({ line: text || null })
    } catch (error) {
        if (error instanceof Anthropic.RateLimitError) return Response.json({ line: null, reason: 'busy' }, { status: 429 })
        if (error instanceof Anthropic.APIError) return Response.json({ line: null, reason: `api ${error.status}` }, { status: 502 })
        return Response.json({ line: null, reason: 'failed' }, { status: 502 })
    }
})
