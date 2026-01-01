import { supabase } from './supabase';

export interface SubscriptionStatus {
  premium: boolean;
  status: string;
  expires: string | null;
}

export const StripeService = {
  /**
   * Fetches the current user's subscription status from Supabase.
   */
  async getSubscriptionStatus(): Promise<SubscriptionStatus> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { premium: false, status: 'inactive', expires: null };
    }

    const { data, error } = await supabase
      .from('subscriptions')
      .select('plan_type, status, current_period_end')
      .eq('user_id', user.id)
      .single();

    if (error || !data) {
      return { premium: false, status: 'inactive', expires: null };
    }

    const isPremium = data.plan_type === 'premium' && data.status === 'active';

    return {
      premium: isPremium,
      status: data.status,
      expires: data.current_period_end
    };
  },

  /**
   * Creates a checkout session by calling the backend function.
   */
  async createCheckoutSession(): Promise<string | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Please log in to upgrade your account');

      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: { userId: user.id, email: user.email }
      });

      if (error) {
        console.error('Stripe checkout error:', error);

        // Check if it's a deployment issue
        if (error.message?.includes('FunctionsHttpError') || error.message?.includes('Edge Function')) {
          throw new Error('Payment system is being configured. Please try again in a few minutes or contact support.');
        }

        // Try to extract a meaningful error message
        let message = error.message;
        if (error.context?.error) {
          message = error.context.error;
        }

        throw new Error(message || 'Failed to start checkout. Please try again.');
      }

      if (!data?.url) {
        throw new Error('No checkout URL received. Please try again or contact support.');
      }

      return data.url;
    } catch (error: any) {
      console.error('Error in createCheckoutSession:', error);
      throw error;
    }
  }
};
