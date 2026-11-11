import * as Notifications from 'expo-notifications';
import { NotificationService } from '../notificationService';
import { getHabits, getCompletions, getSkipped, setCompletionValue } from '../habitsSQLite';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LocationService } from '../LocationService';
import type { Habit } from '../habitsSQLite';

jest.mock('expo-notifications', () => ({
    setNotificationHandler: jest.fn(), setNotificationChannelAsync: jest.fn(), setNotificationCategoryAsync: jest.fn(),
    requestPermissionsAsync: jest.fn(), getPermissionsAsync: jest.fn(),
    getAllScheduledNotificationsAsync: jest.fn(), cancelScheduledNotificationAsync: jest.fn(),
    scheduleNotificationAsync: jest.fn(), SchedulableTriggerInputTypes: { DATE: 'date' },
    IosAuthorizationStatus: { PROVISIONAL: 3 },
}));
jest.mock('../habitsSQLite', () => ({ getHabits: jest.fn(), getCompletions: jest.fn(), getSkipped: jest.fn(async () => ({})), setCompletionValue: jest.fn() }));
jest.mock('../LocationService', () => ({ LocationService: { refreshGeofences: jest.fn() } }));
const tasksForTest: any[] = [];
jest.mock('../tasks', () => ({
    ...jest.requireActual('../tasks'),
    getTasks: jest.fn(async () => tasksForTest),
    setTaskStatus: jest.fn(async (id: string, status: string) => { const task = tasksForTest.find(task => task.id === id); if (task) task.status = status; }),
}));
const echoForTest = { morning: false, evening: false, useName: true, alive: false, aliveFollowUp: true };
jest.mock('../echo', () => ({
    getEchoConfig: jest.fn(async () => echoForTest),
    getDayWindow: jest.fn(async () => ({ wake: '07:00', sleep: '23:00' })),
    suggestedReminder: () => '07:30',
    morningCheckIn: () => '07:30',
    eveningCheckIn: () => '22:00',
    getEchoPersonality: jest.fn(async () => 'normal'),
    getName: jest.fn(async () => 'Erwan'),
    minutesOf: (time: string) => { const [hour, minute] = time.split(':').map(Number); return hour * 60 + minute; },
}));

beforeEach(async () => {
    await AsyncStorage.clear();
    echoForTest.alive = false;
    echoForTest.aliveFollowUp = true;
    echoForTest.morning = false;
    echoForTest.evening = false;
    tasksForTest.length = 0;
    (getSkipped as jest.Mock).mockResolvedValue({});
});

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
        // 48 reminders, then the note that says they have run out.
        expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(49);
        const requests = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls.map(([request]) => request);
        expect(requests[48].identifier).toBe('reminders-keep-alive');
        expect(requests[48].trigger.date.getTime()).toBeGreaterThan(requests[47].trigger.date.getTime());
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
    it('cancels the repeating reminders older builds left behind', async () => {
        (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([
            { identifier: 'old-daily', content: { title: 'Habyss Reminder', data: { habitId: 'read' } } },
            { identifier: 'old-motivation', content: { data: { habitId: 'read', type: 'motivation' } } },
            { identifier: 'timer', content: { data: { type: 'timer' } } },
        ]);
        await NotificationService.refreshHabitReminders();
        expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('old-daily');
        expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('old-motivation');
        expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith('timer');
    });
    it('sends one notification when two copies of a habit share a time', async () => {
        (getHabits as jest.Mock).mockResolvedValue([habit, { ...habit, id: 'read-copy' }]);
        await NotificationService.refreshHabitReminders();
        const times = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls.map(([request]) => request.trigger.date.getTime());
        expect(new Set(times).size).toBe(times.length);
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

describe('task reminders', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers().setSystemTime(new Date(2026, 8, 16, 8));
        (getHabits as jest.Mock).mockResolvedValue([]);
        (getCompletions as jest.Mock).mockResolvedValue({});
        (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
        (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValue('id');
        tasksForTest.length = 0;
    });
    afterEach(() => jest.useRealTimers());

    const task = {
        id: 'task-1', title: 'Send the proposal', priority: 2, status: 'open', source: 'app',
        dueDate: '2026-09-17', dueTime: '15:00', createdAt: '2026-09-01', updatedAt: '2026-09-01',
    };

    it('cancels the reminder once the task is done, and schedules nothing new', async () => {
        tasksForTest.push({ ...task, status: 'done' });
        (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([
            { identifier: 'task:task-1:123', content: { data: { kind: 'task-reminder', taskId: 'task-1' } } },
        ]);

        await NotificationService.refreshReminders();

        expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('task:task-1:123');
        expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });
});


describe("Echo's check-ins", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers().setSystemTime(new Date(2026, 8, 16, 6));
        (getHabits as jest.Mock).mockResolvedValue([]);
        (getCompletions as jest.Mock).mockResolvedValue({});
        (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
        (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([]);
        (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValue('id');
        tasksForTest.length = 0;
        echoForTest.morning = false;
        echoForTest.evening = false;
    });
    afterEach(() => jest.useRealTimers());

    it('schedules none while the user has asked for none', async () => {
        await NotificationService.refreshReminders();
        expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.objectContaining({ data: expect.objectContaining({ kind: 'echo-check-in' }) }) }),
        );
    });

    it('cancels the ones the user has turned back off', async () => {
        (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([
            { identifier: 'echo:evening:2026-09-16', content: { data: { kind: 'echo-check-in' } } },
        ]);
        await NotificationService.refreshReminders();
        expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('echo:evening:2026-09-16');
    });
});

describe('Echo Alive native scheduling and actions', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers().setSystemTime(new Date(2026, 8, 16, 7));
        (getHabits as jest.Mock).mockResolvedValue([{ ...habit, startTime: '08:00', reminders: ['08:00'], durationMinutes: 30 }]);
        (getCompletions as jest.Mock).mockResolvedValue({});
        (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
        (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([]);
        (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValue('id');
        echoForTest.alive = true;
    });
    afterEach(() => jest.useRealTimers());
    it('respects the master switch and the habit-reminder switch', async () => {
        await AsyncStorage.setItem('app_settings', JSON.stringify({ notificationsEnabled: false }));
        await NotificationService.refreshReminders();
        expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
        await AsyncStorage.removeItem('app_settings');
        await AsyncStorage.setItem('notif_habits', 'false');
        await NotificationService.refreshReminders();
        // Nothing about a habit; Echo's own energy question and evening review are not habit reminders.
        const kinds = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls.map(([request]) => request.content.data.kind);
        expect(kinds.filter(kind => !['keep-alive', 'echo-energy', 'day-review'].includes(kind))).toEqual([]);
    });
    it('answers energy from the notification without opening anything', async () => {
        const { currentCheckIns } = require('../checkIns');
        await NotificationService.handleEchoResponse({ actionIdentifier: 'ECHO_ENERGY_HIGH', notification: { date: Date.now(), request: {
            identifier: 'echo-energy:2026-09-16', content: { data: { kind: 'echo-energy' } } } } } as any);
        expect(currentCheckIns().entries.at(-1)).toMatchObject({ kind: 'energy', value: 5 });
    });
    it('marks the original date complete using the fractional measurement target', async () => {
        (getHabits as jest.Mock).mockResolvedValue([{ ...habit, goalValue: 0.5, unit: 'km', trackingMethod: 'numeric' }]);
        const refresh = jest.spyOn(NotificationService, 'refreshReminders').mockResolvedValueOnce(undefined);
        await NotificationService.handleEchoResponse({ actionIdentifier: 'ECHO_DONE', notification: { request: {
            identifier: 'echo', content: { data: { kind: 'echo-alive', habitId: 'read', scheduledDate: '2026-09-15' } },
        } } } as any);
        expect(setCompletionValue).toHaveBeenCalledWith('read', 0.5, '2026-09-15');
        refresh.mockRestore();
    });
    it('does not double-log an already completed habit', async () => {
        (getCompletions as jest.Mock).mockResolvedValue({ read: true });
        const refresh = jest.spyOn(NotificationService, 'refreshReminders').mockResolvedValueOnce(undefined);
        await NotificationService.handleEchoResponse({ actionIdentifier: 'ECHO_DONE', notification: { request: {
            identifier: 'echo', content: { data: { kind: 'echo-alive', habitId: 'read', scheduledDate: '2026-09-16' } },
        } } } as any);
        expect(setCompletionValue).not.toHaveBeenCalled();
        refresh.mockRestore();
    });
});
