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
    // A task's place ("task:<id>::<n>"): reminded while it is still open, once a day per place and way.
    if (identifier.startsWith('task:')) { await notifyTaskCrossing(identifier, direction); return; }
    const { getHabits, getCompletions }: typeof import('./habitsSQLite') = require('./habitsSQLite');
    const [habitId, index] = identifier.split('::');
    if (!/^\d+$/.test(index || '')) return;
    const habit = (await getHabits()).find(item => item.id === habitId);
    const now = new Date();
    const date = localDateKey(now);
    if (!habit || habit.isArchived || habit.isGoal || !isHabitScheduledForDate(habit, now)) return;
    if ((await getCompletions(date))[habitId]) return;
    const place = habit.locationReminders?.[Number(index)];
    if (place?.trigger === 'stay') { await stayCrossing(identifier, direction, place, { kind: 'habit', id: habitId }); return; }
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

async function notifyTaskCrossing(identifier: string, direction: 'arrive' | 'leave') {
    const { getTasks }: typeof import('./tasks') = require('./tasks');
    const [key, index] = identifier.split('::');
    const taskId = key.slice('task:'.length);
    if (!/^\d+$/.test(index || '')) return;
    const task = (await getTasks()).find(item => item.id === taskId);
    if (!task || task.status !== 'open') return;
    const place = task.locationReminders?.[Number(index)];
    if (place?.trigger === 'stay') { await stayCrossing(identifier, direction, place, { kind: 'task', id: taskId }); return; }
    if (!place || (place.trigger ?? 'arrive') !== direction) return;
    const date = localDateKey(new Date());
    const dedupeKey = `habyss_crossing_task_${taskId}::${index}::${direction}`;
    if (await AsyncStorage.getItem(dedupeKey) === date) return;
    const permission = await Notifications.getPermissionsAsync();
    if (!permission.granted && permission.ios?.status !== Notifications.IosAuthorizationStatus.PROVISIONAL) return;
    await Notifications.scheduleNotificationAsync({
        content: {
            title: (direction === 'leave' ? 'Leaving ' : 'Arrived at ') + place.name,
            body: 'Time for ' + task.title,
            sound: 'default',
            data: { taskId, url: '/(root)/(tabs)/roadmap' },
        },
        trigger: null,
    });
    await AsyncStorage.setItem(dedupeKey, date);
}

/* -------------------------------------------------------------------------- */
/*  Time at a place: ticks itself                                              */
/* -------------------------------------------------------------------------- */

type StayPlace = { name: string; latitude: number; longitude: number; radius?: number; stayMinutes?: number };
type StayItem = { kind: 'habit' | 'task'; id: string };
const ARRIVED_KEY = 'habyss_place_arrivals';
/** Longer than this without a "left" means a missed exit, not a stay. */
const STAY_CEILING_MS = 14 * 60 * 60 * 1000;

const stayMs = (place: StayPlace) => Math.max(5, Math.min(600, place.stayMinutes ?? 30)) * 60 * 1000;

type Arrival = { at: number; item: StayItem; place: StayPlace };
async function arrivals(): Promise<Record<string, Arrival>> {
    try { return JSON.parse((await AsyncStorage.getItem(ARRIVED_KEY)) ?? '{}'); } catch { return {}; }
}
async function setArrivals(next: Record<string, Arrival>) {
    await AsyncStorage.setItem(ARRIVED_KEY, JSON.stringify(next)).catch(() => undefined);
}

/** Arriving starts the clock; leaving after long enough ticks it. */
async function stayCrossing(identifier: string, direction: 'arrive' | 'leave', place: StayPlace, item: StayItem) {
    const all = await arrivals();
    if (direction === 'arrive') {
        if (!all[identifier]) { all[identifier] = { at: Date.now(), item, place }; await setArrivals(all); }
        return;
    }
    const arrival = all[identifier];
    delete all[identifier];
    await setArrivals(all);
    if (!arrival) return;
    const stayed = Date.now() - arrival.at;
    if (stayed >= stayMs(place) && stayed <= STAY_CEILING_MS) await tickForStay(item, place, stayed, new Date(arrival.at));
}

async function tickForStay(item: StayItem, place: StayPlace, stayedMs: number, arrivedAt: Date) {
    const { autoTickHabit, autoTickTask, tellAutoTicked, minutesLabel }: typeof import('./autoTrack') = require('./autoTrack');
    const outcome = item.kind === 'habit' ? await autoTickHabit(item.id, localDateKey(arrivedAt)) : await autoTickTask(item.id);
    if (outcome.result !== 'done' || !outcome.name) return;
    await tellAutoTicked(`${item.kind}:${item.id}`, `${outcome.name}: done.`, `${minutesLabel(stayedMs / 60000)} at ${place.name}. Not a single tap.`);
}

/** Metres between two points (haversine). */
function metresBetween(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
    const rad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = rad(b.latitude - a.latitude), dLon = rad(b.longitude - a.longitude);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
    return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

/**
 * Still there and long enough: ticked now rather than on leaving (run when
 * Habyss comes to the front). Only with a fresh enough fix that puts you
 * inside the place; otherwise it waits for the exit.
 */
export async function checkStays(): Promise<void> {
    const all = await arrivals();
    const due = Object.entries(all).filter(([, arrival]) => Date.now() - arrival.at >= stayMs(arrival.place));
    if (!due.length) return;
    let here: { latitude: number; longitude: number } | null = null;
    try {
        const fix = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60 * 1000 });
        if (fix) here = { latitude: fix.coords.latitude, longitude: fix.coords.longitude };
    } catch { /* no fix: wait for the exit */ }
    for (const [identifier, arrival] of due) {
        if (Date.now() - arrival.at > STAY_CEILING_MS) { delete all[identifier]; continue; }
        if (!here || metresBetween(here, arrival.place) > Math.max(100, arrival.place.radius ?? 150) + 50) continue;
        delete all[identifier];
        await tickForStay(arrival.item, arrival.place, Date.now() - arrival.at, new Date(arrival.at));
    }
    await setArrivals(all);
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
                            // A stay is timed from arriving to leaving, so it needs both.
                            notifyOnExit: loc.trigger === 'leave' || loc.trigger === 'stay',
                        });
                    });
                }
            }

            // And open tasks' places, the same way.
            const { getTasks }: typeof import('./tasks') = require('./tasks');
            for (const task of await getTasks().catch(() => [])) {
                if (task.status !== 'open') continue;
                (task.locationReminders ?? []).forEach((loc, index) => {
                    if (!Number.isFinite(loc.latitude) || !Number.isFinite(loc.longitude) || Math.abs(loc.latitude) > 90 || Math.abs(loc.longitude) > 180) return;
                    regions.push({
                        identifier: `task:${task.id}::${index}`, latitude: loc.latitude, longitude: loc.longitude,
                        radius: Number.isFinite(loc.radius) ? Math.max(100, loc.radius!) : 150,
                        notifyOnEnter: loc.trigger !== 'leave', notifyOnExit: loc.trigger === 'leave' || loc.trigger === 'stay',
                    });
                });
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
