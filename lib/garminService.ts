import { IntegrationService } from './integrationService';

export const GarminService = {
  async connect(): Promise<void> {
    // In a real app, this would redirect to Garmin OAuth
    // Since we don't have a backend for OAuth callback yet, 
    // we'll simulate a successful connection for now.
    
    console.log('Connecting to Garmin...');
    
    // Simulate OAuth flow
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const mockTokens = {
      accessToken: 'mock-garmin-access-token',
      refreshToken: 'mock-garmin-refresh-token',
      expiry: new Date(Date.now() + 3600 * 1000)
    };

    await IntegrationService.connectService('garmin', mockTokens);
  },

  async syncData(): Promise<void> {
    // This would fetch data from Garmin API
    console.log('Syncing Garmin data...');
    
    // Example: Recording a mock activity
    await IntegrationService.recordActivity('garmin', 'workout', {
      type: 'run',
      distance: 5000,
      duration: 1800,
      calories: 400
    }, 'garmin-activity-123');
    
    // Update last sync
    const { data: { user } } = await (await import('./supabase')).supabase.auth.getUser();
    if (user) {
      const { data: integration } = await (await import('./supabase')).supabase
        .from('integrations')
        .select('id')
        .eq('user_id', user.id)
        .eq('service_name', 'garmin')
        .single();
      
      if (integration) {
        await IntegrationService.updateIntegration(integration.id, {
          last_sync: new Date().toISOString(),
          sync_status: 'idle'
        });
      }
    }
  }
};
