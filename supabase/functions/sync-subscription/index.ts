// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from 'https://esm.sh/stripe@12.0.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
    httpClient: Stripe.createFetchHttpClient(),
})

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
        // 0. CHECK ENV VARS
        const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
        const sbUrl = Deno.env.get('SUPABASE_URL');
        const sbKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

        if (!stripeKey || !sbUrl || !sbKey) {
            console.error('Missing env vars:', { stripeKey: !!stripeKey, sbUrl: !!sbUrl, sbKey: !!sbKey });
            throw new Error('Server misconfiguration: Missing environment variables.');
        }

        // 1. Get the user from the authorization header
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
            throw new Error('No authorization header')
        }

        const { data: { user }, error: userError } = await supabaseClient.auth.getUser(
            authHeader.replace('Bearer ', '')
        )

        if (userError || !user) {
            throw new Error('Invalid token')
        }

        const email = user.email
        if (!email) {
            throw new Error('User has no email')
        }

        console.log(`Syncing subscription for ${email}...`)

        // 2. Search for Stripe customer by email
        const customers = await stripe.customers.list({
            email: email,
            limit: 1,
            expand: ['data.subscriptions']
        })

        if (customers.data.length === 0) {
            return new Response(
                JSON.stringify({ message: 'No Stripe customer found', restored: false }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const customer = customers.data[0]
        // Check for active subscriptions in the expanded data
        // Note: 'subscriptions' is a list object on the customer if expanded, but might need separate call if not recent
        // Safer to list subscriptions for this customer explicitly to be sure
        const subscriptions = await stripe.subscriptions.list({
            customer: customer.id,
            status: 'all', // Get all to see what's going on
        })

        const activeSub = subscriptions.data.find(sub =>
            sub.status === 'active' || sub.status === 'trialing'
        )

        if (activeSub) {
            // 3. Update Supabase with Subscription
            const { error: upsertError } = await supabaseClient
                .from('subscriptions')
                .upsert({
                    user_id: user.id,
                    stripe_customer_id: customer.id,
                    stripe_subscription_id: activeSub.id,
                    plan_type: 'premium',
                    status: activeSub.status,
                    current_period_end: new Date(activeSub.current_period_end * 1000).toISOString()
                })

            if (upsertError) throw upsertError

            return new Response(
                JSON.stringify({ message: 'Subscription synced', restored: true, plan: 'premium' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // 3b. Check for One-Time Payments (Livetime)
        const paymentIntents = await stripe.paymentIntents.list({
            customer: customer.id,
            limit: 100 // Check last 100 payments to be safe
        });

        const lifetimePurchase = paymentIntents.data.find(pi =>
            pi.status === 'succeeded' &&
            (pi.metadata?.type === 'lifetime' || pi.metadata?.priceId === 'price_1SoRiYAzxf3pzNzA28oOqFTw')
        );

        if (lifetimePurchase) {
            // Upsert a "fake" subscription for lifetime access
            const { error: upsertError } = await supabaseClient
                .from('subscriptions')
                .upsert({
                    user_id: user.id,
                    stripe_customer_id: customer.id,
                    stripe_subscription_id: lifetimePurchase.id, // Use PaymentIntent ID as Subscription ID
                    plan_type: 'premium', // or 'lifetime'
                    status: 'active',
                    current_period_end: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString() // 100 years from now
                })

            if (upsertError) throw upsertError

            return new Response(
                JSON.stringify({ message: 'Lifetime purchase synced', restored: true, plan: 'premium' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // No active subscription or purchase found
        {
            // No active subscription found, ensure DB says inactive
            await supabaseClient
                .from('subscriptions')
                .upsert({
                    user_id: user.id,
                    stripe_customer_id: customer.id,
                    status: 'inactive',
                    plan_type: 'free'
                })

            return new Response(
                JSON.stringify({ message: 'No active subscription found', restored: false }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

    } catch (error) {
        console.error('Sync Error:', error)
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
    }
})
