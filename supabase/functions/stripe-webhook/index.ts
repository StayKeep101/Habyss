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

serve(async (req) => {
  const signature = req.headers.get('stripe-signature')

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  if (!stripeKey) throw new Error('Missing STRIPE_SECRET_KEY');

  try {
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) throw new Error('Missing STRIPE_WEBHOOK_SECRET');

    const body = await req.text()
    const event = stripe.webhooks.constructEvent(
      body,
      signature!,
      webhookSecret
    )

    console.log(`🔔 Webhook received: ${event.type}`);

    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object as Stripe.Checkout.Session
        const userId = session.metadata?.userId
        const stripeCustomerId = session.customer as string
        const stripeSubscriptionId = session.subscription as string

        if (userId && stripeSubscriptionId) {
          // Fetch actual subscription to get accurate period end
          const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);

          const { error } = await supabaseClient
            .from('subscriptions')
            .upsert({
              user_id: userId,
              stripe_customer_id: stripeCustomerId,
              stripe_subscription_id: stripeSubscriptionId,
              plan_type: 'premium',
              status: subscription.status,
              current_period_end: new Date(subscription.current_period_end * 1000).toISOString()
            })

          if (error) throw error
        }
        break

      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object as Stripe.PaymentIntent;

        // Only process if it's a lifetime purchase (has metadata)
        if (paymentIntent.metadata?.type === 'lifetime' || paymentIntent.metadata?.priceId) {
          const userId = paymentIntent.metadata.userId;
          const customerId = paymentIntent.customer as string;

          if (userId) {
            const { error } = await supabaseClient
              .from('subscriptions')
              .upsert({
                user_id: userId,
                stripe_customer_id: customerId,
                stripe_subscription_id: paymentIntent.id,
                plan_type: 'premium',
                status: 'active',
                current_period_end: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString()
              })

            if (error) throw error
          }
        }
        break
      case 'customer.subscription.updated':
        const subscription = event.data.object as Stripe.Subscription
        const status = subscription.status === 'active' ? 'active' : 'inactive'

        await supabaseClient
          .from('subscriptions')
          .update({
            status,
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString()
          })
          .eq('stripe_subscription_id', subscription.id)
        break
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400 })
  }
})
