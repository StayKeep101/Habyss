import { Platform } from 'react-native';
import AppleHealthKit, {
  HealthValue,
  HealthKitPermissions,
} from 'react-native-health';
import { IntegrationService } from './integrationService';
import { supabase } from './supabase';

const permissions: HealthKitPermissions = {
  permissions: {
    read: [
      AppleHealthKit.Constants.Permissions.Steps,
      AppleHealthKit.Constants.Permissions.HeartRate,
      AppleHealthKit.Constants.Permissions.SleepAnalysis,
      AppleHealthKit.Constants.Permissions.ActiveEnergyBurned,
    ],
    write: [],
  },
};

export const HealthService = {
  isAvailable(): boolean {
    return Platform.OS === 'ios';
  },

  async authorize(): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error('Apple Health is only available on iOS');
    }

    return new Promise((resolve, reject) => {
      AppleHealthKit.initHealthKit(permissions, (error: string) => {
        if (error) {
          reject(new Error(`HealthKit authorization failed: ${error}`));
          return;
        }
        resolve();
      });
    });
  },

  async syncData(): Promise<void> {
    if (!this.isAvailable()) return;

    try {
      await IntegrationService.withRetry(async () => {
        await this.authorize();

        const now = new Date();
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        // Get Steps
        const steps = await this.getSteps(yesterday, now);
        if (steps > 0) {
          await IntegrationService.recordActivity('apple-health', 'steps', { value: steps, unit: 'count' });
        }

        // Get Active Energy
        const energy = await this.getActiveEnergy(yesterday, now);
        if (energy > 0) {
          await IntegrationService.recordActivity('apple-health', 'active_energy', { value: energy, unit: 'kcal' });
        }

        // Get Sleep Data
        try {
          const sleep = await this.getSleepHours(yesterday, now);
          if (sleep > 0) {
            await IntegrationService.recordActivity('apple-health', 'sleep', { value: sleep, unit: 'hours' });
          }
        } catch (e) {
          console.log('Sleep data not available:', e);
        }

        // Get Distance
        try {
          const distance = await this.getWalkingRunningDistance(yesterday, now);
          if (distance > 0) {
            await IntegrationService.recordActivity('apple-health', 'distance', { value: distance, unit: 'meters' });
          }
        } catch (e) {
          console.log('Distance data not available:', e);
        }

        // Update last sync
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: integration } = await supabase
            .from('integrations')
            .select('id')
            .eq('user_id', user.id)
            .eq('service_name', 'apple-health')
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
      console.error('Apple Health sync error after retries:', error);
      // Update status to error in DB
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('integrations')
          .update({ sync_status: 'error' })
          .eq('user_id', user.id)
          .eq('service_name', 'apple-health');
      }
      throw error;
    }
  },


  getSteps(startDate: Date, endDate: Date): Promise<number> {
    return new Promise((resolve, reject) => {
      const options = {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      };
      AppleHealthKit.getStepCount(options, (err: Object, results: HealthValue) => {
        if (err) reject(err);
        else resolve(results.value);
      });
    });
  },

  getActiveEnergy(startDate: Date, endDate: Date): Promise<number> {
    return new Promise((resolve, reject) => {
      const options = {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      };
      AppleHealthKit.getActiveEnergyBurned(options, (err: Object, results: HealthValue[]) => {
        if (err) reject(err);
        else {
          const total = results.reduce((sum, item) => sum + item.value, 0);
          resolve(total);
        }
      });
    });
  },

  getSleepHours(startDate: Date, endDate: Date): Promise<number> {
    return new Promise((resolve, reject) => {
      const options = {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      };
      AppleHealthKit.getSleepSamples(options, (err: Object, results: any[]) => {
        if (err) reject(err);
        else {
          // Calculate total sleep time in hours
          const totalMinutes = results.reduce((sum, sample) => {
            const start = new Date(sample.startDate).getTime();
            const end = new Date(sample.endDate).getTime();
            return sum + (end - start) / (1000 * 60);
          }, 0);
          resolve(totalMinutes / 60);
        }
      });
    });
  },

  getWalkingRunningDistance(startDate: Date, endDate: Date): Promise<number> {
    return new Promise((resolve, reject) => {
      const options = {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      };
      AppleHealthKit.getDistanceWalkingRunning(options, (err: Object, results: HealthValue) => {
        if (err) reject(err);
        else resolve(results.value);
      });
    });
  }
};
