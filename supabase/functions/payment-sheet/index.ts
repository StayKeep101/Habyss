// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from 'https://esm.sh/stripe@12.0.0?target=deno'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
        if (!stripeKey) {
            throw new Error('Missing STRIPE_SECRET_KEY');
        }

        const stripe = new Stripe(stripeKey, {
            apiVersion: '2023-10-16',
            httpClient: Stripe.createFetchHttpClient(),
        })

        const { email, priceId } = await req.json()
        if (!priceId) {
            throw new Error('Price ID is required');
        }

        // 1. Create or retrieve customer
        let customer;
        if (email) {
            const customers = await stripe.customers.list({ email, limit: 1 });
            if (customers.data.length > 0) {
                customer = customers.data[0];
            }
        }

        if (!customer) {
            customer = await stripe.customers.create({ email });
        }

        // 2. Create an Ephemeral Key
        const ephemeralKey = await stripe.ephemeralKeys.create(
            { customer: customer.id },
            { apiVersion: '2022-11-15' }
        );

        // 3. Determine if it's a subscription or one-time payment
        const price = await stripe.prices.retrieve(priceId);
        let paymentIntentClientSecret;

        if (price.type === 'recurring') {
            // Create Subscription
            const subscription = await stripe.subscriptions.create({
                customer: customer.id,
                items: [{ price: priceId }],
                payment_behavior: 'default_incomplete',
                payment_settings: { save_default_payment_method: 'on_subscription' },
                expand: ['latest_invoice.payment_intent'],
            });
            paymentIntentClientSecret = subscription.latest_invoice.payment_intent.client_secret;

        } else if (price.type === 'one_time') {
            // Create PaymentIntent
            const paymentIntent = await stripe.paymentIntents.create({
                amount: price.unit_amount,
                currency: price.currency,
                customer: customer.id,
                automatic_payment_methods: { enabled: true },
            });
            paymentIntentClientSecret = paymentIntent.client_secret;
        } else {
            throw new Error(`Unsupported price type: ${price.type}`);
        }

        // 4. Return the parameters to the client
        return new Response(
            JSON.stringify({
                paymentIntent: paymentIntentClientSecret,
                ephemeralKey: ephemeralKey.secret,
                customer: customer.id,
                publishableKey: Deno.env.get('EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY'),
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            },
        )
    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            },
        )
    }
})
