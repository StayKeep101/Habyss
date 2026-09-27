import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SQLite from 'expo-sqlite';
import { deleteAllLocalData } from '../accountDeletion';
import { closeDatabase, getDatabase } from '../database';
import { SecureTokenService } from '../secureStorage';
import SharedDefaults from '../SharedDefaults';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';

jest.mock('expo-notifications', () => ({ cancelAllScheduledNotificationsAsync: jest.fn(async () => undefined) }));
jest.mock('expo-secure-store', () => ({ deleteItemAsync: jest.fn(async () => undefined) }));
jest.mock('../notificationService', () => ({ NotificationService: { waitForReminderSync: jest.fn(async () => undefined) } }));
jest.mock('../widgetSync', () => ({ waitForWidgetSync: jest.fn(async () => undefined) }));
jest.mock('../scheduledActivities', () => ({ waitForScheduledActivitySync: jest.fn(async () => undefined) }));
jest.mock('../habitsSQLite', () => ({ clearHabitsCache: jest.fn() }));
jest.mock('@/modules/habyss-live-activity', () => ({ __esModule: true, default: null }));

jest.mock('expo-sqlite', () => ({ deleteDatabaseAsync: jest.fn(async () => undefined) }));
const mockDb = {
    getAllAsync: jest.fn(async () => [
        { name: 'habits' }, { name: 'completions' }, { name: 'schema_version' }, { name: 'sync_queue' },
    ]),
    execAsync: jest.fn(async (_sql: string) => undefined),
};
jest.mock('../database', () => ({
    closeDatabase: jest.fn(async () => undefined),
    getDatabase: jest.fn(async () => mockDb),
}));
jest.mock('../secureStorage', () => ({
    SecureTokenService: { clearServiceTokens: jest.fn(async () => undefined) },
}));
jest.mock('../SharedDefaults', () => ({
    __esModule: true,
    default: { remove: jest.fn(async () => true), reloadTimelines: jest.fn(async () => true),
        getPendingWidgetEvents: jest.fn(async () => [JSON.stringify({ eventId: 'pending' })]) },
}));
jest.mock('../RevenueCat', () => ({ __esModule: true, default: { logOut: jest.fn(async () => undefined) } }));
jest.mock('../LocalLLMService', () => ({ __esModule: true, default: { deleteModel: jest.fn(async () => undefined) } }));

const STEP_KEYS = ['reminders', 'purchases', 'aiModel', 'shared', 'database', 'tokens', 'settings'];

describe('deleteAllLocalData', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockDb.getAllAsync.mockResolvedValue([
            { name: 'habits' }, { name: 'completions' }, { name: 'schema_version' }, { name: 'sync_queue' },
        ]);
        mockDb.execAsync.mockResolvedValue(undefined);
    });

    it('clears every local store', async () => {
        const report = await deleteAllLocalData();

        expect(report.ok).toBe(true);
        expect(report.failed).toEqual([]);
        expect(report.steps.map(step => step.key)).toEqual(STEP_KEYS);

        expect(closeDatabase).toHaveBeenCalled();
        expect(SQLite.deleteDatabaseAsync).toHaveBeenCalledWith('habyss.db');
        expect(AsyncStorage.clear).toHaveBeenCalled();
        expect(SecureTokenService.clearServiceTokens).toHaveBeenCalledTimes(3);
        expect(SharedDefaults.remove).toHaveBeenCalledWith('widgetDashboard');
        expect(SharedDefaults.remove).toHaveBeenCalledWith('widget_event_pending');
        expect(SharedDefaults.remove).toHaveBeenCalledWith('siriHabitsData');
        expect(Notifications.cancelAllScheduledNotificationsAsync).toHaveBeenCalled();
        expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('habyss_apple_pending_profile');
    });

    it('empties every table found in the database', async () => {
        await deleteAllLocalData();

        expect(getDatabase).toHaveBeenCalled();
        const statements = mockDb.execAsync.mock.calls.map(call => call[0]);
        expect(statements).toEqual([
            'DELETE FROM "habits";',
            'DELETE FROM "completions";',
            'DELETE FROM "schema_version";',
            'DELETE FROM "sync_queue";',
        ]);
    });

    it('clears tables left behind by older versions too', async () => {
        mockDb.getAllAsync.mockResolvedValue([{ name: 'habits' }, { name: 'routines' }]);

        await deleteAllLocalData();

        expect(mockDb.execAsync).toHaveBeenCalledWith('DELETE FROM "routines";');
    });

    it('counts the wipe as done when rows are cleared but the file cannot be removed', async () => {
        (SQLite.deleteDatabaseAsync as jest.Mock).mockRejectedValueOnce(new Error('file busy'));

        const report = await deleteAllLocalData();

        // The data is gone, which is what the user was promised.
        expect(report.ok).toBe(true);
    });

    it('reports failure when neither the rows nor the file could be removed', async () => {
        mockDb.execAsync.mockRejectedValueOnce(new Error('disk I/O error'));
        (SQLite.deleteDatabaseAsync as jest.Mock).mockRejectedValueOnce(new Error('file busy'));

        const report = await deleteAllLocalData();

        expect(report.ok).toBe(false);
        expect(report.failed.map(step => step.key)).toContain('database');
    });

    it('closes the database before deleting it', async () => {
        const order: string[] = [];
        (closeDatabase as jest.Mock).mockImplementation(async () => { order.push('close'); });
        (SQLite.deleteDatabaseAsync as jest.Mock).mockImplementation(async () => { order.push('delete'); });

        await deleteAllLocalData();

        // Deleting a database that is still open fails on iOS.
        expect(order).toEqual(['close', 'delete']);
    });

    it('clears settings last, since earlier steps read from them', async () => {
        const order: string[] = [];
        (SQLite.deleteDatabaseAsync as jest.Mock).mockImplementation(async () => { order.push('database'); });
        (AsyncStorage.clear as jest.Mock).mockImplementation(async () => { order.push('settings'); });

        await deleteAllLocalData();

        expect(order).toEqual(['database', 'settings']);
    });

    it('keeps going when a step fails and reports which one', async () => {
        (SecureTokenService.clearServiceTokens as jest.Mock).mockRejectedValueOnce(new Error('keychain locked'));

        const report = await deleteAllLocalData();

        expect(report.ok).toBe(false);
        expect(report.failed).toHaveLength(1);
        expect(report.failed[0].key).toBe('tokens');
        expect(report.failed[0].detail).toContain('keychain locked');

        // The remaining stores are still cleared rather than left behind.
        expect(AsyncStorage.clear).toHaveBeenCalled();
        expect(SQLite.deleteDatabaseAsync).toHaveBeenCalled();
        expect(report.steps).toHaveLength(STEP_KEYS.length);
    });

    it('still deletes user data when optional cleanup is unavailable', async () => {
        const RevenueCat = require('../RevenueCat').default;
        const LocalLLM = require('../LocalLLMService').default;
        RevenueCat.logOut.mockRejectedValueOnce(new Error('not configured'));
        LocalLLM.deleteModel.mockRejectedValueOnce(new Error('no model'));

        const report = await deleteAllLocalData();

        expect(report.failed.map(step => step.key)).toEqual(['purchases', 'aiModel']);
        expect(SQLite.deleteDatabaseAsync).toHaveBeenCalledWith('habyss.db');
        expect(AsyncStorage.clear).toHaveBeenCalled();
    });
});
