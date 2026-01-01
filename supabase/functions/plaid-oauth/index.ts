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
        const { public_token, userId } = await req.json()

        if (!public_token || !userId) {
            throw new Error('Missing public_token or userId')
        }

        const clientId = Deno.env.get('PLAID_CLIENT_ID')
        const secret = Deno.env.get('PLAID_SECRET')
        const env = Deno.env.get('PLAID_ENV') || 'sandbox'

        // Exchange public token for access token
        const tokenResponse = await fetch(`https://${env}.plaid.com/item/public_token/exchange`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                client_id: clientId,
                secret,
                public_token,
            }),
        })

        const tokenData = await tokenResponse.json()

        if (tokenData.access_token) {
            // Store integration in database
            const { error } = await supabaseClient
                .from('integrations')
                .upsert({
                    user_id: userId,
                    service_name: 'plaid',
                    is_connected: true,
                    last_sync: new Date().toISOString(),
                    sync_status: 'idle'
                })

            if (error) throw error

            return new Response(
                JSON.stringify({ success: true }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
            )
        } else {
            throw new Error('Failed to exchange public token')
        }
    } catch (error) {
        console.error('Plaid OAuth error:', error.message)
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
        )
    }
})
