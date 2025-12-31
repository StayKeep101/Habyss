import { IntegrationService } from './integrationService';
import { supabase } from './supabase';

export const StravaService = {
  async connect(): Promise<void> {
    // In a real app, this would use expo-auth-session to redirect to Strava OAuth
    console.log('Connecting to Strava...');
    
    // Simulate OAuth flow
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const mockTokens = {
      accessToken: 'mock-strava-access-token',
      refreshToken: 'mock-strava-refresh-token',
      expiry: new Date(Date.now() + 6 * 3600 * 1000) // Strava tokens usually last 6 hours
    };

    await IntegrationService.connectService('strava', mockTokens);
  },

  async syncData(): Promise<void> {
    console.log('Syncing Strava data...');
    
    try {
      await IntegrationService.withRetry(async () => {
        // Fetch recent activities from Strava API
        // This is where we would call GET https://www.strava.com/api/v3/athlete/activities
        
        const mockActivity = {
          id: `strava-${Date.now()}`,
          type: 'Run',
          distance: 8050.5, // meters
          moving_time: 2400, // seconds
          start_date: new Date().toISOString()
        };

        await IntegrationService.recordActivity('strava', 'workout', mockActivity, mockActivity.id);

        // Update last sync status
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: integration } = await supabase
            .from('integrations')
            .select('id')
            .eq('user_id', user.id)
            .eq('service_name', 'strava')
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
      console.error('Strava sync error:', error);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('integrations')
          .update({ sync_status: 'error' })
          .eq('user_id', user.id)
          .eq('service_name', 'strava');
      }
      throw error;
    }
  }
};
