import * as Notifications from 'expo-notifications';
import { NotificationService } from '../notificationService';
import { getHabits, getCompletions } from '../habitsSQLite';
import { LocationService } from '../LocationService';
import type { Habit } from '../habitsSQLite';

jest.mock('expo-notifications', () => ({
    setNotificationHandler: jest.fn(), setNotificationChannelAsync: jest.fn(),
    requestPermissionsAsync: jest.fn(), getPermissionsAsync: jest.fn(),
    getAllScheduledNotificationsAsync: jest.fn(), cancelScheduledNotificationAsync: jest.fn(),
    scheduleNotificationAsync: jest.fn(), SchedulableTriggerInputTypes: { DATE: 'date' },
    IosAuthorizationStatus: { PROVISIONAL: 3 },
}));
jest.mock('../habitsSQLite', () => ({ getHabits: jest.fn(), getCompletions: jest.fn() }));
jest.mock('../LocationService', () => ({ LocationService: { refreshGeofences: jest.fn() } }));

const habit = { id: 'read', name: 'Read', category: 'mind', startDate: '2026-01-01', createdAt: '2026-01-01', frequency: 'daily', reminders: ['09:00'], taskDays: [] } as unknown as Habit;

describe('native reminder refresh', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers().setSystemTime(new Date(2026, 8, 16, 8));
        (getHabits as jest.Mock).mockResolvedValue([habit]);
        (getCompletions as jest.Mock).mockResolvedValue({});
        (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
        (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([]);
        (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValue('id');
    });
    afterEach(() => jest.useRealTimers());
    it('refreshes using existing permission without prompting and routes to the habit', async () => {
        await NotificationService.refreshHabitReminders();
        expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
        expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(48);
        expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(expect.objectContaining({
            content: expect.objectContaining({ data: expect.objectContaining({ url: '/habit-detail?habitId=read' }) }),
            trigger: expect.objectContaining({ type: 'date' }),
        }));
    });
    it('removes old habit alerts when permission is denied, retaining timer alerts', async () => {
        (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false });
        (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([
            { identifier: 'legacy', content: { data: { habitId: 'read', url: '/home?habitId=read' } } },
            { identifier: 'timer', content: { data: { type: 'timer' } } },
        ]);
        await NotificationService.refreshHabitReminders();
        expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(1);
        expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('legacy');
        expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
        expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
        expect(LocationService.refreshGeofences).toHaveBeenCalled();
    });
    it('reserves capacity for unrelated notifications', async () => {
        (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue(Array.from({ length: 54 }, (_, id) => ({ identifier: 'timer-' + id, content: { data: { type: 'timer' } } })));
        await NotificationService.refreshHabitReminders();
        expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
        expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
    });
    it('recovers the serialized queue after a native scheduling failure', async () => {
        (Notifications.scheduleNotificationAsync as jest.Mock).mockRejectedValueOnce(new Error('Native error'));
        await expect(NotificationService.refreshHabitReminders()).rejects.toThrow('Native error');
        expect(LocationService.refreshGeofences).toHaveBeenCalledTimes(1);
        await expect(NotificationService.refreshHabitReminders()).resolves.toBeUndefined();
    });
    it('does not ask for notification permission after a habit completion', async () => {
        (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false });
        await NotificationService.sendCompletionNotification('Read');
        expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
        expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });
});
