import { IntegrationService } from './integrationService';
import { supabase } from './supabase';

export const KindleService = {
  async connect(): Promise<void> {
    // Kindle doesn't have a public OAuth, so we'll simulate a connection
    console.log('Connecting to Kindle...');
    
    // Simulate connection flow
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const mockTokens = {
      accessToken: 'mock-kindle-access-token'
    };

    await IntegrationService.connectService('kindle', mockTokens);
  },

  async syncData(): Promise<void> {
    console.log('Syncing Kindle data...');
    
    try {
      await IntegrationService.withRetry(async () => {
        // Fetch reading progress
        const mockReading = {
          current_book: 'The Atomic Habits',
          progress_percent: 65,
          pages_read_today: 42,
          reading_time_minutes: 35,
          last_read_at: new Date().toISOString()
        };

        await IntegrationService.recordActivity('kindle', 'reading', mockReading, `kindle-read-${Date.now()}`);

        // Update last sync status
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: integration } = await supabase
            .from('integrations')
            .select('id')
            .eq('user_id', user.id)
            .eq('service_name', 'kindle')
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
      console.error('Kindle sync error:', error);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('integrations')
          .update({ sync_status: 'error' })
          .eq('user_id', user.id)
          .eq('service_name', 'kindle');
      }
      throw error;
    }
  }
};
