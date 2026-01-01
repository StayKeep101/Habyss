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
        const code = url.searchParams.get('code')
        const state = url.searchParams.get('state') // Contains userId

        if (!code || !state) {
            throw new Error('Missing code or state parameter')
        }

        const clientId = Deno.env.get('STRAVA_CLIENT_ID')
        const clientSecret = Deno.env.get('STRAVA_CLIENT_SECRET')
        const redirectUri = Deno.env.get('STRAVA_REDIRECT_URI')

        // Exchange code for token
        const tokenResponse = await fetch('https://www.strava.com/oauth/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                client_id: clientId,
                client_secret: clientSecret,
                code,
                grant_type: 'authorization_code',
            }),
        })

        const tokenData = await tokenResponse.json()

        if (tokenData.access_token) {
            // Store integration in database
            const { error } = await supabaseClient
                .from('integrations')
                .upsert({
                    user_id: state,
                    service_name: 'strava',
                    is_connected: true,
                    token_expiry: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
                    last_sync: new Date().toISOString(),
                    sync_status: 'idle'
                })

            if (error) throw error

            // Redirect back to app
            return new Response(null, {
                status: 302,
                headers: {
                    ...corsHeaders,
                    'Location': `${Deno.env.get('APP_URL')}/(root)/settings?integration=strava&status=connected`,
                },
            })
        } else {
            throw new Error('Failed to get access token')
        }
    } catch (error) {
        console.error('Strava OAuth error:', error.message)
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
        )
    }
})
