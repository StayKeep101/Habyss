import { IntegrationService } from './integrationService';
import { supabase } from './supabase';

export const PlaidService = {
  async connect(): Promise<void> {
    // In a real app, this would use Plaid Link SDK
    console.log('Connecting to Plaid...');
    
    // Simulate Plaid Link flow
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const mockTokens = {
      accessToken: 'mock-plaid-access-token'
    };

    await IntegrationService.connectService('plaid', mockTokens);
  },

  async syncData(): Promise<void> {
    console.log('Syncing Plaid data...');
    
    try {
      await IntegrationService.withRetry(async () => {
        // Fetch financial transactions
        const mockTransaction = {
          id: `plaid-${Date.now()}`,
          merchant: 'Starbucks',
          amount: 5.50,
          category: 'Food and Drink',
          date: new Date().toISOString()
        };

        await IntegrationService.recordActivity('plaid', 'spending', mockTransaction, mockTransaction.id);

        // Update last sync status
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: integration } = await supabase
            .from('integrations')
            .select('id')
            .eq('user_id', user.id)
            .eq('service_name', 'plaid')
            .single();
          
          if (integration) {
            await IntegrationService.updateIntegration(integration.id, {
              last_sync: new Date().toISOString(),
              sync_status: 'idle'
            });
          }
        }
      });
    } catch (error) {
      console.error('Plaid sync error:', error);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('integrations')
          .update({ sync_status: 'error' })
          .eq('user_id', user.id)
          .eq('service_name', 'plaid');
      }
      throw error;
    }
  }
};
