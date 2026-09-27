import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getHabits, getCompletions } from '../habitsSQLite';
import { LocationService } from '../LocationService';

jest.mock('expo-task-manager', () => ({ defineTask: jest.fn(), isAvailableAsync: jest.fn().mockResolvedValue(true) }));
jest.mock('expo-location', () => ({
    GeofencingEventType: { Enter: 1, Exit: 2 },
    getForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
    getBackgroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
    hasStartedGeofencingAsync: jest.fn().mockResolvedValue(true),
    stopGeofencingAsync: jest.fn(), startGeofencingAsync: jest.fn(),
}));
jest.mock('expo-notifications', () => ({
    getPermissionsAsync: jest.fn(), scheduleNotificationAsync: jest.fn(),
    IosAuthorizationStatus: { PROVISIONAL: 3 },
}));
jest.mock('../habitsSQLite', () => ({ getHabits: jest.fn(), getCompletions: jest.fn() }));

const habit = { id: 'read', name: 'Read', startDate: '2026-01-01', frequency: 'weekly', taskDays: ['wed'], locationReminders: [{ name: 'Home', latitude: 45, longitude: -73, radius: 150 }] };
const task = (TaskManager.defineTask as jest.Mock).mock.calls[0][1];
const enter = () => task({ data: { eventType: 1, region: { identifier: 'read::0' } } });
const leave = () => task({ data: { eventType: 2, region: { identifier: 'read::0' } } });
const leaving = { ...habit, locationReminders: [{ ...habit.locationReminders[0], trigger: 'leave' as const }] };

describe('habit place reminders', () => {
    beforeEach(async () => {
        jest.clearAllMocks();
        jest.useFakeTimers().setSystemTime(new Date(2026, 8, 16, 10));
        await AsyncStorage.clear();
        (getHabits as jest.Mock).mockResolvedValue([habit]);
        (getCompletions as jest.Mock).mockResolvedValue({});
        (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
    });
    afterEach(() => jest.useRealTimers());

    it('deduplicates simultaneous arrivals and links to the matching habit', async () => {
        await Promise.all([enter(), enter()]);
        expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
        expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(expect.objectContaining({
            content: expect.objectContaining({ title: 'Arrived at Home', data: { habitId: 'read', url: '/habit-detail?habitId=read' } }),
        }));
    });
    it('does not remind on rest days', async () => {
        jest.setSystemTime(new Date(2026, 8, 17, 10));
        await enter();
        expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });
    it('does not remind after a habit is complete', async () => {
        (getCompletions as jest.Mock).mockResolvedValue({ read: true });
        await enter();
        expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });
    it('ignores deleted, archived, and removed places', async () => {
        for (const habits of [[], [{ ...habit, isArchived: true }], [{ ...habit, locationReminders: [] }]]) {
            (getHabits as jest.Mock).mockResolvedValue(habits);
            await enter();
        }
        expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });
    it('does not notify without existing permission', async () => {
        (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false });
        await enter();
        expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });
    it('reminds on the way out when that is the crossing asked for', async () => {
        (getHabits as jest.Mock).mockResolvedValue([leaving]);
        await leave();
        expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(expect.objectContaining({
            content: expect.objectContaining({ title: 'Leaving Home' }),
        }));
    });
    it('ignores the crossing the habit did not ask for', async () => {
        await leave();
        (getHabits as jest.Mock).mockResolvedValue([leaving]);
        await enter();
        expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });
    it('still catches the second place after the first has fired', async () => {
        (getHabits as jest.Mock).mockResolvedValue([{ ...habit, locationReminders: [habit.locationReminders[0], { name: 'Gym', latitude: 46, longitude: -73 }] }]);
        await enter();
        await task({ data: { eventType: 1, region: { identifier: 'read::1' } } });
        expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
    });
    it('watches each region in one direction only', async () => {
        (getHabits as jest.Mock).mockResolvedValue([leaving]);
        await LocationService.refreshGeofences();
        expect(Location.startGeofencingAsync).toHaveBeenCalledWith('HABYSS_GEOFENCING_TASK',
            [expect.objectContaining({ notifyOnEnter: false, notifyOnExit: true })]);
    });
    it('registers coordinates rather than placeholder places and removes old regions', async () => {
        await LocationService.refreshGeofences();
        expect(Location.stopGeofencingAsync).toHaveBeenCalledWith('HABYSS_GEOFENCING_TASK');
        expect(Location.startGeofencingAsync).toHaveBeenCalledWith('HABYSS_GEOFENCING_TASK', [expect.objectContaining({ identifier: 'read::0', latitude: 45, longitude: -73, radius: 150 })]);
    });
    it('does not restart unchanged places on each foreground refresh', async () => {
        await LocationService.refreshGeofences();
        await LocationService.refreshGeofences();
        expect(Location.startGeofencingAsync).toHaveBeenCalledTimes(1);
    });
    it('stops monitoring when the last place is removed', async () => {
        (getHabits as jest.Mock).mockResolvedValue([{ ...habit, locationReminders: [] }]);
        await LocationService.refreshGeofences();
        expect(Location.stopGeofencingAsync).toHaveBeenCalledTimes(1);
        expect(Location.startGeofencingAsync).not.toHaveBeenCalled();
    });
});
