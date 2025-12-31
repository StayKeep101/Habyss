import { IntegrationService } from './integrationService';
import { supabase } from './supabase';

export const DuolingoService = {
  async connect(): Promise<void> {
    // Duolingo doesn't have a public OAuth, so we'll simulate a connection
    // In a real app, this might involve a username/password or a custom proxy
    console.log('Connecting to Duolingo...');
    
    // Simulate connection flow
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const mockTokens = {
      accessToken: 'mock-duolingo-session-token'
    };

    await IntegrationService.connectService('duolingo', mockTokens);
  },

  async syncData(): Promise<void> {
    console.log('Syncing Duolingo data...');
    
    try {
      await IntegrationService.withRetry(async () => {
        // Fetch learning progress
        const mockProgress = {
          username: 'habyss_user',
          streak: 15,
          total_xp: 1250,
          languages: [
            { name: 'Spanish', level: 5, points: 450 },
            { name: 'French', level: 3, points: 800 }
          ],
          last_lesson_at: new Date().toISOString()
        };

        await IntegrationService.recordActivity('duolingo', 'learning', mockProgress, `duo-streak-${Date.now()}`);

        // Update last sync status
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: integration } = await supabase
            .from('integrations')
            .select('id')
            .eq('user_id', user.id)
            .eq('service_name', 'duolingo')
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
      console.error('Duolingo sync error:', error);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('integrations')
          .update({ sync_status: 'error' })
          .eq('user_id', user.id)
          .eq('service_name', 'duolingo');
      }
      throw error;
    }
  }
};
