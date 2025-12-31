import { IntegrationService } from './integrationService';
import { supabase } from './supabase';

export const SpotifyService = {
  async connect(): Promise<void> {
    // In a real app, this would use expo-auth-session for Spotify OAuth
    console.log('Connecting to Spotify...');
    
    // Simulate OAuth flow
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const mockTokens = {
      accessToken: 'mock-spotify-access-token',
      refreshToken: 'mock-spotify-refresh-token',
      expiry: new Date(Date.now() + 3600 * 1000)
    };

    await IntegrationService.connectService('spotify', mockTokens);
  },

  async syncData(): Promise<void> {
    console.log('Syncing Spotify data...');
    
    try {
      await IntegrationService.withRetry(async () => {
        // Fetch recently played tracks from Spotify API
        // GET https://api.spotify.com/v1/me/player/recently-played
        
        const mockTrack = {
          id: `spotify-${Date.now()}`,
          name: 'Deep Focus',
          artist: 'Ambient Music',
          duration_ms: 180000,
          played_at: new Date().toISOString()
        };

        await IntegrationService.recordActivity('spotify', 'listening', mockTrack, mockTrack.id);

        // Update last sync status
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: integration } = await supabase
            .from('integrations')
            .select('id')
            .eq('user_id', user.id)
            .eq('service_name', 'spotify')
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
      console.error('Spotify sync error:', error);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('integrations')
          .update({ sync_status: 'error' })
          .eq('user_id', user.id)
          .eq('service_name', 'spotify');
      }
      throw error;
    }
  }
};
