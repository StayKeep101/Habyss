import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from 'https://esm.sh/stripe@12.0.0?target=deno'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  httpClient: Stripe.createFetchHttpClient(),
})

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { userId, email } = await req.json()

    if (!userId) {
      throw new Error('User ID is required')
    }

    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
    const priceId = Deno.env.get('STRIPE_PREMIUM_PRICE_ID')
    const appUrl = Deno.env.get('APP_URL') || 'https://habyss.app' // Fallback to a default if not set

    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY is not set')
    }

    if (!priceId) {
      throw new Error('STRIPE_PREMIUM_PRICE_ID is not set')
    }

    const session = await stripe.checkout.sessions.create({
      customer_email: email || undefined,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${appUrl}/(root)/settings?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/(root)/settings`,
      metadata: {
        userId,
      },
    })

    return new Response(
      JSON.stringify({ url: session.url }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    )
  } catch (error) {
    console.error('Checkout error:', error.message)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
    )
  }
})
