import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';

const LOCATION_TASK_NAME = 'HABYSS_GEOFENCING_TASK';

// Define the background task in the global scope
try {
    TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }: any) => {
        if (error) {
            console.error('[Geofencing] Task Error:', error);
            return;
        }
        if (data) {
            const { eventType, region } = data;
            if (eventType === Location.GeofencingEventType.Enter) {
                // Identifier format: "habitId::HabitName::LocationName"
                const parts = region.identifier.split('::');
                if (parts.length >= 3) {
                    const [habitId, habitName, locationName] = parts;
                    console.log('[Geofencing] Entered region:', region.identifier);

                    await Notifications.scheduleNotificationAsync({
                        content: {
                            title: "Arrived at " + locationName,
                            body: `Time to ${habitName}!`,
                            sound: 'default',
                            data: { habitId, url: `/home?habitId=${habitId}` }
                        },
                        trigger: null, // Immediate
                    });
                }
            }
        }
    });
} catch (e) {
    console.warn('Failed to define task (likely running in unsupported env):', e);
}

export class LocationService {
    static async requestPermissions(): Promise<boolean> {
        try {
            const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
            if (fgStatus !== 'granted') return false;

            const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
            return bgStatus === 'granted';
        } catch (e) {
            console.warn('Error requesting location permissions:', e);
            return false;
        }
    }

    /**
     * Refreshes all geofences based on current habits.
     * This is the source of truth - it stops everything and re-registers active reminders.
     * This handles addition, removal, and updates in one go.
     */
    static async refreshGeofences() {
        try {
            const hasPermission = await this.requestPermissions();
            if (!hasPermission) {
                console.warn('[Geofencing] Missing permissions');
                return;
            }

            // 1. Get all active habits
            // Import dynamically to avoid circular dependency issues if any (though LocationService is leaf mostly)
            const { getHabits } = require('./habitsSQLite');
            const habits = await getHabits();
            const activeHabits = habits.filter((h: any) => !h.isArchived && !h.deleted);

            // 2. Collect all regions
            const regions: Location.LocationRegion[] = [];

            for (const habit of activeHabits) {
                if (habit.locationReminders && habit.locationReminders.length > 0) {
                    habit.locationReminders.forEach((loc: any) => {
                        regions.push({
                            identifier: `${habit.id}::${habit.name}::${loc.name}`,
                            latitude: loc.latitude,
                            longitude: loc.longitude,
                            radius: loc.radius || 100, // Default 100m
                            notifyOnEnter: true,
                            notifyOnExit: false,
                        });
                    });
                }
            }

            // 3. Stop existing task to clear old regions? 
            // According to docs, startGeofencingAsync REPLACES regions for the task?
            // "You can call this function multiple times with the same task name to monitor different regions."
            // Wait, does it replace or append? 
            // "Monitoring a region with the same identifier... will replace it."
            // But what about removing ones that are no longer in the list?
            // Valid strategy: Stop the task completely, then start if we have regions.

            const hasStarted = await Location.hasStartedGeofencingAsync(LOCATION_TASK_NAME);
            if (hasStarted) {
                await Location.stopGeofencingAsync(LOCATION_TASK_NAME);
            }

            if (regions.length > 0) {
                await Location.startGeofencingAsync(LOCATION_TASK_NAME, regions);
                console.log(`[Geofencing] Refreshed: Monitoring ${regions.length} regions`);
            } else {
                console.log('[Geofencing] No regions to monitor.');
            }

        } catch (e) {
            console.warn('[Geofencing] Error refreshing geofences:', e);
        }
    }
}
