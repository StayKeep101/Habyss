import { supabase } from './supabase';
import { IntegrationService } from './integrationService';
import { HealthService } from './healthService';
import { StravaService } from './stravaService';
import { SpotifyService } from './spotifyService';
import { DuolingoService } from './duolingoService';
import { PlaidService } from './plaidService';
import { GarminService } from './garminService';
import { KindleService } from './kindleService';
import { toggleCompletion, getCompletions } from './habits';

export interface HabitIntegrationMapping {
  id: string;
  habit_id: string;
  integration_id: string;
  data_type: string;
  config: any;
  auto_complete: boolean;
}

export const SyncCoordinator = {
  /**
   * Syncs all connected integrations for the current user
   */
  async syncAllIntegrations(): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    try {
      // Get all connected integrations
      const { data: integrations, error } = await supabase
        .from('integrations')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_connected', true);

      if (error) throw error;
      if (!integrations || integrations.length === 0) return;

      // Update sync status to 'syncing'
      const integrationIds = integrations.map(i => i.id);
      await supabase
        .from('integrations')
        .update({ sync_status: 'syncing' })
        .in('id', integrationIds);

      // Sync each integration
      const syncPromises = integrations.map(async (integration) => {
        try {
          await this.syncIntegration(integration.service_name);
        } catch (err) {
          console.error(`Error syncing ${integration.service_name}:`, err);
          await supabase
            .from('integrations')
            .update({ sync_status: 'error' })
            .eq('id', integration.id);
        }
      });

      await Promise.allSettled(syncPromises);

      // Process habit mappings and auto-complete
      await this.processHabitMappings();
    } catch (error) {
      console.error('Error in syncAllIntegrations:', error);
      throw error;
    }
  },

  /**
   * Syncs a specific integration by service name
   */
  async syncIntegration(serviceName: string): Promise<void> {
    switch (serviceName) {
      case 'apple-health':
        if (HealthService.isAvailable()) {
          await HealthService.syncData();
        }
        break;
      case 'strava':
        await StravaService.syncData();
        break;
      case 'spotify':
        await SpotifyService.syncData();
        break;
      case 'duolingo':
        await DuolingoService.syncData();
        break;
      case 'plaid':
        await PlaidService.syncData();
        break;
      case 'garmin':
        await GarminService.syncData();
        break;
      case 'kindle':
        await KindleService.syncData();
        break;
      default:
        console.warn(`Unknown service: ${serviceName}`);
    }
  },

  /**
   * Processes habit mappings and auto-completes habits based on synced data
   */
  async processHabitMappings(): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get all habit mappings with auto-complete enabled
    const { data: mappings, error } = await supabase
      .from('habit_integration_mappings')
      .select(`
        *,
        habits!inner(id, user_id, goal_value, unit, goal_period),
        integrations!inner(id, service_name, user_id)
      `)
      .eq('auto_complete', true)
      .eq('habits.user_id', user.id);

    if (error) {
      console.error('Error fetching habit mappings:', error);
      return;
    }

    if (!mappings || mappings.length === 0) return;

    // Get today's completions
    const completions = await getCompletions();
    const today = new Date().toISOString().split('T')[0];

    // Process each mapping
    for (const mapping of mappings) {
      try {
        const habit = mapping.habits;
        const integration = mapping.integrations;

        // Skip if already completed today
        if (completions[habit.id]) continue;

        // Check if synced data meets the habit goal
        const shouldComplete = await this.checkDataMeetsGoal(
          mapping.integration_id,
          habit.id,
          mapping.data_type,
          habit.goal_value,
          habit.unit,
          habit.goal_period,
          mapping.config
        );

        if (shouldComplete) {
          // Auto-complete the habit
          await toggleCompletion(habit.id, today);
          console.log(`Auto-completed habit ${habit.id} from ${integration.service_name}`);
        }
      } catch (err) {
        console.error('Error processing mapping:', err);
      }
    }
  },

  /**
   * Checks if synced data meets the habit goal
   */
  async checkDataMeetsGoal(
    integrationId: string,
    habitId: string,
    dataType: string,
    goalValue: number,
    unit: string,
    goalPeriod: string,
    config: any
  ): Promise<boolean> {
    const today = new Date().toISOString().split('T')[0];
    
    // Determine date range based on goal period
    let startDate = today;
    if (goalPeriod === 'weekly') {
      const date = new Date();
      date.setDate(date.getDate() - date.getDay()); // Start of week
      startDate = date.toISOString().split('T')[0];
    } else if (goalPeriod === 'monthly') {
      const date = new Date();
      date.setDate(1); // Start of month
      startDate = date.toISOString().split('T')[0];
    }

    // Query synced activities for this period
    const { data: activities, error } = await supabase
      .from('synced_activities')
      .select('*')
      .eq('integration_id', integrationId)
      .eq('activity_type', dataType)
      .gte('synced_at', startDate + 'T00:00:00')
      .lte('synced_at', today + 'T23:59:59');

    if (error || !activities || activities.length === 0) {
      return false;
    }

    // Calculate total based on data type
    let total = 0;
    
    switch (dataType) {
      case 'steps':
        total = activities.reduce((sum, a) => sum + (a.data?.value || 0), 0);
        break;
      case 'workout':
        // Check workout type if specified in config
        const filteredWorkouts = config?.workout_type
          ? activities.filter(a => a.data?.type?.toLowerCase() === config.workout_type.toLowerCase())
          : activities;
        
        // For workouts, we can count occurrences or total distance/duration
        if (unit === 'count') {
          total = filteredWorkouts.length;
        } else if (unit === 'meters' || unit === 'km') {
          total = filteredWorkouts.reduce((sum, a) => sum + (a.data?.distance || 0), 0);
          if (unit === 'km') total = total / 1000;
        } else if (unit === 'minutes') {
          total = filteredWorkouts.reduce((sum, a) => sum + (a.data?.duration || a.data?.moving_time || 0), 0) / 60;
        }
        break;
      case 'active_energy':
        total = activities.reduce((sum, a) => sum + (a.data?.value || 0), 0);
        break;
      case 'listening':
        if (unit === 'minutes') {
          total = activities.reduce((sum, a) => sum + ((a.data?.duration_ms || 0) / 60000), 0);
        } else {
          total = activities.length; // Count of songs
        }
        break;
      case 'learning':
        total = activities.reduce((sum, a) => sum + (a.data?.total_xp || 0), 0);
        break;
      case 'reading':
        if (unit === 'minutes') {
          total = activities.reduce((sum, a) => sum + (a.data?.reading_time_minutes || 0), 0);
        } else if (unit === 'pages') {
          total = activities.reduce((sum, a) => sum + (a.data?.pages_read_today || 0), 0);
        }
        break;
      case 'spending':
        total = activities.reduce((sum, a) => sum + (a.data?.amount || 0), 0);
        break;
      default:
        return false;
    }

    return total >= goalValue;
  },

  /**
   * Links a habit to an integration data source
   */
  async linkHabitToIntegration(
    habitId: string,
    serviceName: string,
    dataType: string,
    config: any = {},
    autoComplete: boolean = true
  ): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Get integration ID
    const { data: integration } = await supabase
      .from('integrations')
      .select('id')
      .eq('user_id', user.id)
      .eq('service_name', serviceName)
      .single();

    if (!integration) {
      throw new Error(`Integration not found: ${serviceName}`);
    }

    // Create mapping
    const { error } = await supabase
      .from('habit_integration_mappings')
      .upsert({
        habit_id: habitId,
        integration_id: integration.id,
        data_type: dataType,
        config,
        auto_complete: autoComplete
      });

    if (error) throw error;
  },

  /**
   * Unlinks a habit from an integration
   */
  async unlinkHabitFromIntegration(habitId: string, serviceName: string, dataType: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Get integration ID
    const { data: integration } = await supabase
      .from('integrations')
      .select('id')
      .eq('user_id', user.id)
      .eq('service_name', serviceName)
      .single();

    if (!integration) return;

    // Delete mapping
    await supabase
      .from('habit_integration_mappings')
      .delete()
      .eq('habit_id', habitId)
      .eq('integration_id', integration.id)
      .eq('data_type', dataType);
  },

  /**
   * Gets all integration mappings for a habit
   */
  async getHabitIntegrations(habitId: string): Promise<HabitIntegrationMapping[]> {
    const { data, error } = await supabase
      .from('habit_integration_mappings')
      .select(`
        *,
        integrations(service_name, is_connected, last_sync)
      `)
      .eq('habit_id', habitId);

    if (error) {
      console.error('Error fetching habit integrations:', error);
      return [];
    }

    return data as any;
  }
};
