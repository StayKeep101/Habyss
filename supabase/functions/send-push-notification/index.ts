import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.89.0'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const { userId, title, body, data } = await req.json()

        if (!userId || !title || !body) {
            return new Response(
                JSON.stringify({ error: 'userId, title, and body are required' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Look up push token
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('push_token')
            .eq('id', userId)
            .single()

        if (profileError || !profile?.push_token) {
            return new Response(
                JSON.stringify({ error: 'User has no push token registered' }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Send via Expo Push API
        const pushResponse = await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                to: profile.push_token,
                sound: 'default',
                title,
                body,
                data: data ?? {},
            }),
        })

        const pushResult = await pushResponse.json()

        return new Response(
            JSON.stringify({ success: true, result: pushResult }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
