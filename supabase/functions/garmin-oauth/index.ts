import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const url = new URL(req.url)
        const oauth_token = url.searchParams.get('oauth_token')
        const oauth_verifier = url.searchParams.get('oauth_verifier')
        const state = url.searchParams.get('state') // Contains userId

        if (!oauth_token || !oauth_verifier || !state) {
            throw new Error('Missing OAuth parameters')
        }

        const consumerKey = Deno.env.get('GARMIN_CONSUMER_KEY')
        const consumerSecret = Deno.env.get('GARMIN_CONSUMER_SECRET')

        // Garmin uses OAuth 1.0a - this is simplified
        // In production, you'd use a proper OAuth 1.0a library

        // Store integration in database
        const { error } = await supabaseClient
            .from('integrations')
            .upsert({
                user_id: state,
                service_name: 'garmin',
                is_connected: true,
                last_sync: new Date().toISOString(),
                sync_status: 'idle'
            })

        if (error) throw error

        // Redirect back to app
        return new Response(null, {
            status: 302,
            headers: {
                ...corsHeaders,
                'Location': `${Deno.env.get('APP_URL')}/(root)/settings?integration=garmin&status=connected`,
            },
        })
    } catch (error) {
        console.error('Garmin OAuth error:', error.message)
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
        )
    }
})
