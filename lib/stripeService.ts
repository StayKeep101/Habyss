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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase.functions.invoke('create-checkout-session', {
      body: { userId: user.id, email: user.email }
    });

    if (error) {
      // Try to extract error message from the response
      let message = error.message;
      try {
        if (error.context?.error) {
          message = error.context.error;
        }
      } catch (e) {
        // Fallback to original error message
      }
      
      console.error('Error creating checkout session:', message, error);
      throw new Error(message);
    }

    return data?.url || null;
  }
};
