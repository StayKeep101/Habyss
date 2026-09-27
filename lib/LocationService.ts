import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { isHabitScheduledForDate, localDateKey } from './habitSchedule';

const LOCATION_TASK_NAME = 'HABYSS_GEOFENCING_TASK';
const REGIONS_KEY = 'habyss_geofence_regions';
let crossingQueue: Promise<void> = Promise.resolve();

/**
 * A geofence was crossed; tell them if that is the crossing they asked for.
 *
 * A place registers for one direction only, so a region that fires on exit
 * belongs to a "leaving" reminder — but the check is made anyway, because the
 * habit may have been turned round since the region was registered and the
 * stale one keeps reporting until the next refresh.
 */
async function notifyCrossing(identifier: string, direction: 'arrive' | 'leave') {
    // Defer loading because habit persistence also imports the notification service.
    const { getHabits, getCompletions }: typeof import('./habitsSQLite') = require('./habitsSQLite');
    const [habitId, index] = identifier.split('::');
    if (!/^\d+$/.test(index || '')) return;
    const habit = (await getHabits()).find(item => item.id === habitId);
    const now = new Date();
    const date = localDateKey(now);
    if (!habit || habit.isArchived || habit.isGoal || !isHabitScheduledForDate(habit, now)) return;
    if ((await getCompletions(date))[habitId]) return;
    const place = habit.locationReminders?.[Number(index)];
    if (!place || (place.trigger ?? 'arrive') !== direction) return;
    // Once a day per place and per direction: a habit with two places should
    // still be able to catch you at the second one.
    const dedupeKey = `habyss_crossing_${habitId}::${index}::${direction}`;
    if (await AsyncStorage.getItem(dedupeKey) === date) return;
    const permission = await Notifications.getPermissionsAsync();
    if (!permission.granted && permission.ios?.status !== Notifications.IosAuthorizationStatus.PROVISIONAL) return;
    await Notifications.scheduleNotificationAsync({
        content: {
            title: (direction === 'leave' ? 'Leaving ' : 'Arrived at ') + place.name,
            body: 'Time for ' + habit.name,
            sound: habit.ringtone === 'silent' || habit.ringtone === 'vibrate' ? false : 'default',
            data: { habitId, url: '/habit-detail?habitId=' + encodeURIComponent(habitId) },
        },
        trigger: null,
    });
    await AsyncStorage.setItem(dedupeKey, date);
}

// Define the background task in the global scope
try {
    TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }: any) => {
        if (error) {
            console.error('[Geofencing] Task Error:', error);
            return;
        }
        if (data) {
            const { eventType, region } = data;
            const direction = eventType === Location.GeofencingEventType.Enter ? 'arrive'
                : eventType === Location.GeofencingEventType.Exit ? 'leave' : null;
            if (direction) {
                // Native events can arrive together; serialize the daily dedupe check.
                crossingQueue = crossingQueue.then(() => notifyCrossing(String(region?.identifier), direction))
                    .catch(taskError => console.warn('[Geofencing] Place reminder failed:', taskError));
                await crossingQueue;
            }
        }
    });
} catch (e) {
    console.warn('Failed to define task (likely running in unsupported env):', e);
}

export class LocationService {
    static async requestPermissions(): Promise<boolean> {
        try {
            if (!await TaskManager.isAvailableAsync()) return false;
            const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
            if (fgStatus !== 'granted') return false;

            const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
            return bgStatus === 'granted';
        } catch (e) {
            console.warn('Error requesting location permissions:', e);
            return false;
        }
    }

    static async hasPermissions(): Promise<boolean> {
        try {
            const { status: fgStatus } = await Location.getForegroundPermissionsAsync();
            const { status: bgStatus } = await Location.getBackgroundPermissionsAsync();
            return fgStatus === 'granted' && bgStatus === 'granted';
        } catch (e) {
            console.warn('Error checking location permissions:', e);
            return false;
        }
    }

    /**
     * Refreshes all geofences based on current habits.
     * Only re-register when places change, avoiding repeated initial-region events
     * and unnecessary native work on every app foreground or habit completion.
     */
    static async refreshGeofences(options?: { requestPermissions?: boolean }) {
        try {
            const hasPermission = options?.requestPermissions
                ? await this.requestPermissions()
                : await this.hasPermissions();
            if (!hasPermission) {
                console.warn('[Geofencing] Missing permissions');
                return;
            }

            // 1. Get all active habits
            // Import dynamically to avoid circular dependency issues if any (though LocationService is leaf mostly)
            const { getHabits }: typeof import('./habitsSQLite') = require('./habitsSQLite');
            const habits = await getHabits();
            const activeHabits = habits.filter(h => !h.isArchived && !h.isGoal);

            // 2. Collect all regions
            const regions: Location.LocationRegion[] = [];

            for (const habit of activeHabits) {
                if (habit.locationReminders && habit.locationReminders.length > 0) {
                    habit.locationReminders.forEach((loc, index) => {
                        if (!Number.isFinite(loc.latitude) || !Number.isFinite(loc.longitude) || Math.abs(loc.latitude) > 90 || Math.abs(loc.longitude) > 180) return;
                        regions.push({
                            identifier: `${habit.id}::${index}`,
                            latitude: loc.latitude,
                            longitude: loc.longitude,
                            radius: Number.isFinite(loc.radius) ? Math.max(100, loc.radius!) : 150,
                            // One direction each: a region that woke us for both
                            // would fire the crossing the user did not ask for
                            // and then be thrown away in notifyCrossing.
                            notifyOnEnter: loc.trigger !== 'leave',
                            notifyOnExit: loc.trigger === 'leave',
                        });
                    });
                }
            }

            const monitoredRegions = regions.slice(0, Platform.OS === 'ios' ? 20 : 100);
            const signature = JSON.stringify(monitoredRegions);
            const hasStarted = await Location.hasStartedGeofencingAsync(LOCATION_TASK_NAME);
            if (hasStarted && await AsyncStorage.getItem(REGIONS_KEY) === signature) return;

            // Remove regions that no longer belong to an active habit.
            if (hasStarted) {
                await Location.stopGeofencingAsync(LOCATION_TASK_NAME);
            }

            if (monitoredRegions.length > 0) {
                await Location.startGeofencingAsync(LOCATION_TASK_NAME, monitoredRegions);
            }
            await AsyncStorage.setItem(REGIONS_KEY, signature);

        } catch (e) {
            console.warn('[Geofencing] Error refreshing geofences:', e);
        }
    }
}
