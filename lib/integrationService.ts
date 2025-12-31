import { supabase } from './supabase';
import { SecureTokenService } from './secureStorage';

export interface Integration {
  id: string;
  user_id: string;
  service_name: string;
  is_connected: boolean;
  token_expiry: string | null;
  last_sync: string | null;
  sync_status: 'idle' | 'syncing' | 'error';
}

export interface SyncedActivity {
  id: string;
  integration_id: string;
  habit_id: string;
  external_id: string;
  activity_type: string;
  data: any;
  synced_at: string;
}

export const IntegrationService = {
  /**
   * Fetches all integrations for the current user.
   */
  async getIntegrations(): Promise<Integration[]> {
    const { data, error } = await supabase
      .from('integrations')
      .select('*');

    if (error) {
      console.error('Error fetching integrations:', error);
      return [];
    }

    return data as Integration[];
  },

  /**
   * Updates an integration's connection status and sync metadata.
   */
  async updateIntegration(id: string, updates: Partial<Integration>): Promise<void> {
    const { error } = await supabase
      .from('integrations')
      .update(updates)
      .eq('id', id);

    if (error) {
      console.error('Error updating integration:', error);
      throw error;
    }
  },

  /**
   * Records a synced activity in the database.
   */
  async recordActivity(serviceName: string, activityType: string, data: any, externalId?: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Find the integration record
    const { data: integration } = await supabase
      .from('integrations')
      .select('id')
      .eq('user_id', user.id)
      .eq('service_name', serviceName)
      .single();

    if (!integration) throw new Error(`Integration for ${serviceName} not found`);

    const { error } = await supabase
      .from('synced_activities')
      .insert({
        integration_id: integration.id,
        activity_type: activityType,
        data,
        external_id: externalId || `${serviceName}-${Date.now()}`
      });

    if (error) {
      console.error('Error recording synced activity:', error);
      throw error;
    }
  },

  /**
   * Handles the OAuth token storage and integration record update.
   */
  async connectService(serviceName: string, tokens: { accessToken: string; refreshToken?: string; expiry?: Date }): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // 1. Save tokens securely on device
    await SecureTokenService.saveToken(serviceName, 'access', tokens.accessToken);
    if (tokens.refreshToken) {
      await SecureTokenService.saveToken(serviceName, 'refresh', tokens.refreshToken);
    }

    // 2. Upsert integration record in Supabase
    const { data: existing } = await supabase
      .from('integrations')
      .select('id')
      .eq('user_id', user.id)
      .eq('service_name', serviceName)
      .single();

    const integrationData = {
      user_id: user.id,
      service_name: serviceName,
      is_connected: true,
      token_expiry: tokens.expiry?.toISOString() || null,
      last_sync: new Date().toISOString(),
      sync_status: 'idle' as const
    };

    if (existing) {
      await this.updateIntegration(existing.id, integrationData);
    } else {
      const { error } = await supabase
        .from('integrations')
        .insert(integrationData);
      if (error) throw error;
    }
  },

  /**
   * Performs an operation with exponential backoff retry logic.
   */
  async withRetry<T>(operation: () => Promise<T>, maxRetries = 3): Promise<T> {
    let lastError: any;
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        if (i < maxRetries - 1) {
          const delay = Math.pow(2, i) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    throw lastError;
  },

  /**
   * Disconnects a service and removes tokens.
   */
  async disconnectService(serviceName: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // 1. Remove tokens from secure storage
    await SecureTokenService.deleteToken(serviceName, 'access');
    await SecureTokenService.deleteToken(serviceName, 'refresh');

    // 2. Update integration record
    const { error } = await supabase
      .from('integrations')
      .update({
        is_connected: false,
        sync_status: 'idle',
        last_sync: null
      })
      .eq('user_id', user.id)
      .eq('service_name', serviceName);

    if (error) {
      console.error('Error disconnecting service:', error);
      throw error;
    }
  }
};
