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
  },

  /**
   * Manually syncs the subscription status from Stripe to Supabase.
   * Useful if the webhook failed or for "Restore Purchase" functionality.
   */
  async restorePurchases(): Promise<boolean> {
    try {
      const { data, error } = await supabase.functions.invoke('sync-subscription');

      if (error) {
        // Specifically check for 404 or connection issues
        if (error.message?.includes('FunctionsHttpError') || error.message?.includes('404')) {
          console.error('Sync function not found or unreachable:', error);
          throw new Error('The restoration service is currently unavailable. Please ensure you are online and try again.');
        }
        throw error;
      }

      return data?.restored || false;
    } catch (error: any) {
      console.warn('Silent warning - Error restoring purchases:', error);

      // Try to log the backend error message if available
      if (error && typeof error === 'object') {
        if ('message' in error) console.warn('Error Message:', error.message);
        if ('context' in error) {
          // For FunctionsHttpError, context often contains the response
          console.warn('Error Context:', JSON.stringify(error.context, null, 2));
        }
      }
      return false;
    }
  }
};
