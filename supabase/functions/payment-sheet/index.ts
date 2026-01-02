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
        const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string, {
            apiVersion: '2023-10-16', // Deno stripe version usually differs, but keeping as modern as possible or default
            httpClient: Stripe.createFetchHttpClient(),
        })

        const { email } = await req.json()

        // 1. Create or retrieve customer
        // Simplification: In a real app, you'd look up the customer ID from your Supabase `users` table
        // For now, we'll create a new one or use a dummy one if not provided.
        // In production: const customer = await findOrCreateCustomer(email);

        // For this implementation, we'll just create a new customer for every request request or search by email
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
            { apiVersion: '2022-11-15' } // Stripe-React-Native typically needs a specific apiVersion match
        );

        // 3. Create a PaymentIntent or Subscription
        // The user guide creates a SUBSCRIPTION. 
        // "items: [{ price: 'price_your_product_id' }]"
        const priceId = Deno.env.get('STRIPE_PREMIUM_PRICE_ID');

        if (!priceId) {
            throw new Error('STRIPE_PREMIUM_PRICE_ID is not configured on the server');
        }

        const subscription = await stripe.subscriptions.create({
            customer: customer.id,
            items: [{ price: priceId }],
            payment_behavior: 'default_incomplete',
            payment_settings: { save_default_payment_method: 'on_subscription' },
            expand: ['latest_invoice.payment_intent'],
        });

        const paymentIntent = subscription.latest_invoice.payment_intent;

        // 4. Return the parameters to the client
        return new Response(
            JSON.stringify({
                paymentIntent: paymentIntent.client_secret,
                ephemeralKey: ephemeralKey.secret,
                customer: customer.id,
                publishableKey: Deno.env.get('EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY'), // Optional, client usually has it
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
